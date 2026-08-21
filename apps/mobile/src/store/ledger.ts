import { create } from 'zustand';

import {
  emptyLedger,
  emptySnapshot,
  type LedgerMeta,
  type LedgerSnapshot,
  type PlanningBucket,
  type PlanningItem,
} from '@/data/ledgers';
import {
  money,
  setActiveMoneyCurrency,
  type Account,
  type Envelope,
  type Transaction,
} from '@/data/demo';
import { isWealthAsset, isWealthDebt } from '@/lib/accounts';
import {
  addWorkspaceMember,
  removeWorkspaceMember,
  buildSummary,
  createLedgerTransaction,
  createResource,
  createWorkspace,
  deleteWorkspace,
  ensureWorkspaceDefaults,
  listMembers,
  listWorkspaces,
  loadWorkspaceSnapshot,
  mapApiMembers,
  mapEnvelopeResource,
  mapWorkspaceToLedger,
  objectId,
  reverseLedgerTransaction,
  toMinor,
  deleteResource,
  updateResource,
  updateWorkspace,
} from '@/services/ledgers-api';
import { localStorage } from '@/services/persistence';
import { recordActivity } from '@/store/notifications';

type NewTransaction = Omit<Transaction, 'id' | 'date' | 'icon'> & {
  date?: string;
  icon?: string;
};
type NewEnvelope = {
  name: string;
  kind: Envelope['kind'];
  budget: number;
  icon?: string;
  color?: string;
  rollover?: boolean;
  rule?: string;
  goalId?: string;
};
type NewAccount = {
  name: string;
  kind: string;
  balance?: number;
  icon?: string;
  color?: string;
  lastFour?: string;
};
type NewPlanningItem = {
  name: string;
  amount: number;
  bucket: PlanningBucket;
  icon?: string;
  subtitle?: string;
};

type LedgerState = {
  ledgers: LedgerMeta[];
  activeLedgerId: string;
  snapshots: Record<string, LedgerSnapshot>;
  clearingIds: Record<string, string>;
  pendingIds: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Reload a single book into memory (avoids full multi-workspace hydrate on create). */
  refreshLedger: (ledgerId: string) => Promise<void>;
  resetToDefaultHogar: () => Promise<void>;
  setActiveLedger: (id: string) => Promise<void>;
  createLedger: (name: string, color?: string) => Promise<string>;
  deleteLedger: (ledgerId: string) => Promise<string>;
  inviteMember: (
    ledgerId: string,
    email: string,
    name?: string,
  ) => Promise<{ pendingSignup?: boolean; delivered?: boolean }>;
  removeMember: (ledgerId: string, memberId: string) => Promise<void>;
  renameLedger: (ledgerId: string, name: string) => Promise<void>;
  updateLedger: (
    ledgerId: string,
    patch: { name?: string; color?: string; icon?: string },
  ) => Promise<void>;
  setLedgerCurrency: (currency: string) => Promise<void>;
  addTransaction: (value: NewTransaction) => Promise<Transaction>;
  /** Correct a movement: reverse the ledger row and create the replacement. */
  updateTransaction: (
    transactionId: string,
    value: NewTransaction,
  ) => Promise<Transaction>;
  /** Void a movement (reverse only). */
  voidTransaction: (transactionId: string) => Promise<void>;
  addAccount: (value: NewAccount) => Promise<Account>;
  updateAccount: (
    accountId: string,
    patch: Partial<Omit<Account, 'id'>>,
  ) => Promise<Account>;
  removeAccount: (accountId: string) => Promise<void>;
  addEnvelope: (value: NewEnvelope) => Promise<Envelope>;
  updateEnvelope: (
    envelopeId: string,
    patch: Partial<Omit<Envelope, 'id' | 'kind' | 'spent'>>,
  ) => Promise<Envelope>;
  removeEnvelope: (envelopeId: string) => Promise<void>;
  addPlanningItem: (value: NewPlanningItem) => Promise<PlanningItem>;
  updatePlanningItem: (
    planningId: string,
    value: NewPlanningItem,
  ) => Promise<PlanningItem>;
  removePlanningItem: (planningId: string) => Promise<void>;
};

function planningResourceKind(
  bucket: PlanningBucket,
): 'bill' | 'subscription' {
  return bucket === 'subscription' ? 'subscription' : 'bill';
}

function planningDefaults(bucket: PlanningBucket) {
  const icon =
    bucket === 'income'
      ? 'arrow.down.circle.fill'
      : bucket === 'bill'
        ? 'doc.text.fill'
        : bucket === 'subscription'
          ? 'repeat'
          : 'arrow.clockwise';
  const subtitle =
    bucket === 'income'
      ? 'Ingreso recurrente'
      : bucket === 'bill'
        ? 'Factura'
        : bucket === 'subscription'
          ? 'Suscripción'
          : 'Gasto recurrente';
  return { icon, subtitle };
}

const colors = ['#F5C518', '#F04438', '#06AED4', '#0878F9', '#12B76A', '#7F56D9', '#EE46BC'];

function activeSlice(state: Pick<LedgerState, 'snapshots' | 'activeLedgerId'>) {
  return state.snapshots[state.activeLedgerId] ?? emptySnapshot();
}

async function currentUserId() {
  return localStorage.get<string | null>('auth-user-id', null);
}

async function currencyFor(ledger: LedgerMeta | undefined) {
  return (ledger?.baseCurrency || 'COP').toUpperCase();
}

function syncDisplayCurrency(
  ledgers: LedgerMeta[],
  activeLedgerId: string,
) {
  const active = ledgers.find((item) => item.id === activeLedgerId) ?? ledgers[0];
  setActiveMoneyCurrency(active?.baseCurrency || 'COP');
}

/** Serialize full hydrates so create + AppState poll never overlap on the JS thread. */
let hydrateChain: Promise<void> = Promise.resolve();

async function fetchLedgersFromApi(): Promise<{
  ledgers: LedgerMeta[];
  snapshots: Record<string, LedgerSnapshot>;
  clearingIds: Record<string, string>;
  activeLedgerId: string;
}> {
  const selfId = await currentUserId();
  const workspaces = await listWorkspaces();
  if (!workspaces.length) {
    const created = await createWorkspace({
      name: 'Hogar',
      type: 'personal',
      baseCurrency: 'COP',
      color: '#F5C518',
      icon: 'house.fill',
    });
    workspaces.push(created);
  }

  const ledgers: LedgerMeta[] = [];
  const snapshots: Record<string, LedgerSnapshot> = {};
  const clearingIds: Record<string, string> = {};

  for (const workspace of workspaces) {
    const id = objectId(workspace);
    if (!id) continue;
    const membersRaw = await listMembers(id);
    const members = mapApiMembers(membersRaw, selfId);
    const meta = mapWorkspaceToLedger(workspace, members);
    meta.baseCurrency = (workspace.baseCurrency || 'COP').toUpperCase();
    ledgers.push(meta);
    const loaded = await loadWorkspaceSnapshot(id, meta.baseCurrency, {
      members,
      selfUserId: selfId,
    });
    snapshots[id] = loaded.snapshot;
    clearingIds[id] = loaded.clearingId;
  }

  if (!ledgers.length) {
    throw new Error('No pudimos cargar tus libros desde el servidor.');
  }

  return {
    ledgers,
    snapshots,
    clearingIds,
    activeLedgerId: ledgers[0].id,
  };
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  ledgers: [],
  activeLedgerId: '',
  snapshots: {},
  clearingIds: {},
  pendingIds: [],
  hydrated: false,

  hydrate: async () => {
    const run = async () => {
      const demo = await localStorage.get('demo-session', false);
      if (demo) {
        // Demo mode keeps seed data in memory only (never written as product truth).
        const { seedLedgers, seedSnapshots } = await import('@/data/ledgers');
        const activeLedgerId = seedLedgers[0]?.id ?? 'hogar';
        syncDisplayCurrency(seedLedgers, activeLedgerId);
        set({
          ledgers: seedLedgers,
          activeLedgerId,
          snapshots: seedSnapshots,
          clearingIds: {},
          pendingIds: [],
          hydrated: true,
        });
        void import('@/store/notifications').then(({ useNotificationsStore }) =>
          useNotificationsStore.getState().syncBadge(),
        );
        return;
      }

      const userId = await currentUserId();
      if (!userId) {
        set({
          ledgers: [],
          activeLedgerId: '',
          snapshots: {},
          clearingIds: {},
          pendingIds: [],
          hydrated: true,
        });
        return;
      }

      try {
        const next = await fetchLedgersFromApi();
        const previousActive = get().activeLedgerId;
        const activeLedgerId = next.ledgers.some((item) => item.id === previousActive)
          ? previousActive
          : next.activeLedgerId;
        syncDisplayCurrency(next.ledgers, activeLedgerId);
        set({ ...next, activeLedgerId, pendingIds: [], hydrated: true });
        void import('@/store/notifications').then(({ useNotificationsStore }) =>
          useNotificationsStore.getState().syncBadge(),
        );
        void import('@/services/collaboration-api').then(
          ({ notifyNewTeamTransactions, notifyNewTeamEnvelopes }) => {
            notifyNewTeamTransactions().catch(() => undefined);
            notifyNewTeamEnvelopes().catch(() => undefined);
          },
        );
      } catch (error) {
        const status =
          error && typeof error === 'object' && 'status' in error
            ? Number((error as { status?: number }).status)
            : 0;
        if (status === 401 || status === 403) {
          // Session is dead — leave empty books; auth store clears authenticated via API hook.
          set({
            ledgers: [],
            activeLedgerId: '',
            snapshots: {},
            clearingIds: {},
            pendingIds: [],
            hydrated: true,
          });
          return;
        }
        // Keep prior in-memory state if the API is briefly unavailable.
        set({ hydrated: true });
      }
    };

    const queued = hydrateChain.then(run, run);
    hydrateChain = queued.catch(() => undefined);
    await queued;
  },

  refreshLedger: async (ledgerId) => {
    if (!ledgerId) return;
    const existing = get().ledgers.find((item) => item.id === ledgerId);
    if (!existing) return;
    try {
      const selfId = await currentUserId();
      const membersRaw = await listMembers(ledgerId);
      const members = mapApiMembers(membersRaw, selfId);
      const baseCurrency = (existing.baseCurrency || 'COP').toUpperCase();
      const loaded = await loadWorkspaceSnapshot(ledgerId, baseCurrency, {
        members,
        selfUserId: selfId,
      });
      const meta: LedgerMeta = {
        ...existing,
        members,
        type: members.length > 1 ? 'shared' : existing.type,
        baseCurrency,
      };
      set((state) => ({
        ledgers: state.ledgers.map((item) => (item.id === ledgerId ? meta : item)),
        snapshots: { ...state.snapshots, [ledgerId]: loaded.snapshot },
        clearingIds: { ...state.clearingIds, [ledgerId]: loaded.clearingId },
      }));
    } catch {
      // Soft refresh must never undo a successful local create.
    }
  },

  resetToDefaultHogar: async () => {
    // Source of truth is Mongo: ensure at least Hogar exists, then reload.
    const workspaces = await listWorkspaces();
    if (!workspaces.length) {
      await createWorkspace({
        name: 'Hogar',
        type: 'personal',
        baseCurrency: 'COP',
        color: '#F5C518',
        icon: 'house.fill',
      });
    } else {
      const first = workspaces[0];
      const id = objectId(first);
      if (id && first.name !== 'Hogar') {
        // Only auto-rename the legacy default wallet name.
        if (/'s Wallet$/i.test(first.name)) {
          await updateWorkspace(id, {
            name: 'Hogar',
            color: '#F5C518',
            icon: 'house.fill',
          });
        }
      }
    }
    await get().hydrate();
  },

  setActiveLedger: async (id) => {
    if (!get().snapshots[id]) return;
    syncDisplayCurrency(get().ledgers, id);
    set({ activeLedgerId: id });
  },

  createLedger: async (name, color) => {
    const workspace = await createWorkspace({
      name: name.trim() || 'Nuevo libro',
      type: 'personal',
      baseCurrency: 'COP',
      color: color ?? colors[get().ledgers.length % colors.length],
      icon: 'wallet.pass.fill',
    });
    const id = objectId(workspace);
    await get().hydrate();
    if (id) set({ activeLedgerId: id });
    return id;
  },

  deleteLedger: async (ledgerId) => {
    if (get().ledgers.length <= 1) {
      throw new Error('Debes conservar al menos un libro.');
    }
    await deleteWorkspace(ledgerId);
    await get().hydrate();
    return get().activeLedgerId;
  },

  inviteMember: async (ledgerId, email) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) throw new Error('Correo inválido.');
    const result = (await addWorkspaceMember(ledgerId, trimmed, 'member')) as {
      pendingSignup?: boolean;
      delivered?: boolean;
    };
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    return {
      pendingSignup: Boolean(result?.pendingSignup),
      delivered: result?.delivered,
    };
  },

  removeMember: async (ledgerId, memberId) => {
    if (memberId === 'me') return;
    await removeWorkspaceMember(ledgerId, memberId);
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
  },

  renameLedger: async (ledgerId, name) => {
    await get().updateLedger(ledgerId, { name });
  },

  updateLedger: async (ledgerId, patch) => {
    const body: { name?: string; color?: string; icon?: string } = {};
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return;
      body.name = trimmed;
    }
    if (patch.color !== undefined) body.color = patch.color.trim();
    if (patch.icon !== undefined) body.icon = patch.icon.trim();
    if (!Object.keys(body).length) return;
    await updateWorkspace(ledgerId, body);
    set({
      ledgers: get().ledgers.map((ledger) =>
        ledger.id === ledgerId ? { ...ledger, ...body } : ledger,
      ),
    });
  },

  setLedgerCurrency: async (currency) => {
    const ledgerId = get().activeLedgerId;
    if (!ledgerId) throw new Error('No hay un libro activo.');
    const code = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) throw new Error('Divisa inválida.');
    await updateWorkspace(ledgerId, { baseCurrency: code });
    const ledgers = get().ledgers.map((ledger) =>
      ledger.id === ledgerId ? { ...ledger, baseCurrency: code } : ledger,
    );
    syncDisplayCurrency(ledgers, ledgerId);
    set({ ledgers });
  },

  addTransaction: async (value) => {
    const ledgerId = get().activeLedgerId;
    const slice = activeSlice(get());
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);
    let clearingId = get().clearingIds[ledgerId];
    const account = slice.accounts.find((item) => item.name === value.account);
    if (!account) throw new Error('Selecciona una cuenta válida.');
    if (!clearingId) {
      await ensureWorkspaceDefaults(ledgerId, currency);
      await get().refreshLedger(ledgerId);
      clearingId = get().clearingIds[ledgerId];
    }
    if (!clearingId) throw new Error('El libro aún no está listo. Recarga e intenta de nuevo.');

    const kind = value.amount >= 0 ? 'income' : 'expense';
    const envelope = slice.envelopes.find((item) => item.name === value.category);
    const idempotencyKey =
      globalThis.crypto?.randomUUID?.() ?? `tx-${Date.now()}-${Math.random()}`;
    const occurredAt =
      value.date && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
        ? new Date(`${value.date}T12:00:00`).toISOString()
        : new Date().toISOString();
    const created = await createLedgerTransaction({
      workspaceId: ledgerId,
      kind,
      description: value.title.trim() || 'Movimiento',
      occurredAt,
      accountId: account.id,
      clearingAccountId: clearingId,
      amountMajor: value.amount,
      currency,
      envelopeId: envelope?.id,
      idempotencyKey,
    });

    const result: Transaction = {
      ...value,
      id: objectId(created) || idempotencyKey,
      date: value.date ?? 'Ahora',
      icon: value.icon ?? (value.amount > 0 ? 'arrow.down.circle.fill' : 'banknote.fill'),
      envelopeId: envelope?.id,
      occurredAt,
    };

    const nextBalance = account.balance + value.amount;
    const nextSpent = envelope
      ? Math.max(0, envelope.spent + Math.abs(value.amount))
      : 0;

    set((state) => {
      const snap = state.snapshots[ledgerId];
      if (!snap) return { activeLedgerId: ledgerId };
      const accounts = snap.accounts.map((item) =>
        item.id === account.id ? { ...item, balance: nextBalance } : item,
      );
      const envelopes = envelope
        ? snap.envelopes.map((item) =>
            item.id === envelope.id ? { ...item, spent: nextSpent } : item,
          )
        : snap.envelopes;
      const transactions = [
        result,
        ...snap.transactions.filter((item) => item.id !== result.id),
      ];
      return {
        activeLedgerId: ledgerId,
        snapshots: {
          ...state.snapshots,
          [ledgerId]: {
            ...snap,
            accounts,
            envelopes,
            transactions,
            summary: buildSummary(accounts, envelopes, transactions),
          },
        },
      };
    });

    void Promise.all([
      updateResource('account', account.id, {
        balanceMinor: toMinor(nextBalance),
        currency,
        kind: account.kind,
        icon: account.icon,
        color: account.color,
        lastFour: account.lastFour,
      }),
      envelope
        ? updateResource(
            'envelope',
            envelope.id,
            {
              kind: envelope.kind,
              budgetMinor: toMinor(Math.max(0, envelope.budget)),
              spentMinor: toMinor(nextSpent),
              balanceMinor: toMinor(nextSpent),
              currency,
              icon: envelope.icon,
              color: envelope.color,
              rollover: envelope.rollover,
              rule: envelope.rule,
              ...(envelope.goalId ? { goalId: envelope.goalId } : {}),
            },
            envelope.name,
          )
        : Promise.resolve(),
    ])
      .catch(() => undefined)
      .then(() => get().refreshLedger(ledgerId));
    const isIncome = value.amount >= 0;
    void recordActivity({
      kind: isIncome ? 'income' : 'expense',
      title: isIncome ? 'Ingreso registrado' : 'Gasto registrado',
      body: `${result.title} · ${money(Math.abs(value.amount))} · ${ledger?.name ?? 'Libro'}`,
      icon: isIncome ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill',
      route: '/(tabs)/movimientos',
    });
    return result;
  },

  updateTransaction: async (transactionId, value) => {
    const id = transactionId.trim();
    if (!id) throw new Error('Movimiento no válido.');
    await get().voidTransaction(id);
    return get().addTransaction(value);
  },

  voidTransaction: async (transactionId) => {
    const id = transactionId.trim();
    if (!id) throw new Error('Movimiento no válido.');
    const ledgerId = get().activeLedgerId;
    const slice = activeSlice(get());
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);
    const existing = slice.transactions.find((item) => item.id === id);
    if (!existing) throw new Error('No encontramos ese movimiento.');

    await reverseLedgerTransaction(
      id,
      `Anulación: ${existing.title.trim() || 'Movimiento'}`,
    );

    // Account balances live on resources (not derived from the ledger).
    const account = slice.accounts.find((item) => item.name === existing.account);
    if (account) {
      await updateResource('account', account.id, {
        balanceMinor: toMinor(account.balance - existing.amount),
        currency,
        kind: account.kind,
        icon: account.icon,
        color: account.color,
        lastFour: account.lastFour,
      });
    }

    void get().refreshLedger(ledgerId);
    set({ activeLedgerId: ledgerId });
  },

  addAccount: async (value) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);
    const palette = ['#0878F9', '#12B76A', '#F79009', '#7F56D9', '#06AED4', '#F04438', '#EE46BC'];
    const digits = value.lastFour?.replace(/\D/g, '').slice(-4) ?? '';
    const balance = Number.isFinite(value.balance) ? (value.balance as number) : 0;
    const created = await createResource('account', ledgerId, value.name.trim(), {
      balanceMinor: toMinor(balance),
      currency,
      kind: value.kind.trim() || 'Cuenta corriente',
      icon: value.icon ?? 'creditcard.fill',
      color: value.color ?? palette[activeSlice(get()).accounts.length % palette.length],
      lastFour: digits.length === 4 ? digits : '—',
    });
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const mapped = get().snapshots[ledgerId]?.accounts.find(
      (item) => item.id === objectId(created),
    );
    if (!mapped) throw new Error('No se pudo crear la cuenta.');
    const label = isWealthDebt(mapped)
      ? 'Deuda'
      : isWealthAsset(mapped)
        ? 'Activo'
        : 'Cuenta';
    void recordActivity({
      kind: 'account',
      title: `${label} agregada`,
      body: `${mapped.name} · ${ledger?.name ?? 'Libro'}`,
      icon: mapped.icon || 'creditcard.fill',
      sound: 'sobres',
      route: `/(tabs)/account/${mapped.id}`,
    });
    return mapped;
  },

  updateAccount: async (accountId, patch) => {
    const ledgerId = get().activeLedgerId;
    const slice = activeSlice(get());
    const current = slice.accounts.find((item) => item.id === accountId);
    if (!current) throw new Error('La cuenta no existe.');
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);

    const nextName = patch.name?.trim() || current.name;
    const digits =
      patch.lastFour !== undefined
        ? patch.lastFour.replace(/\D/g, '').slice(-4)
        : current.lastFour === '—'
          ? ''
          : current.lastFour;
    const balance =
      patch.balance !== undefined && Number.isFinite(patch.balance)
        ? patch.balance
        : current.balance;

    await updateResource(
      'account',
      accountId,
      {
        balanceMinor: toMinor(balance),
        currency,
        kind: patch.kind?.trim() || current.kind,
        icon: patch.icon ?? current.icon,
        color: patch.color ?? current.color,
        lastFour: digits.length === 4 ? digits : '—',
      },
      nextName,
    );
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const updated = get().snapshots[ledgerId]?.accounts.find((item) => item.id === accountId);
    if (!updated) throw new Error('No se pudo actualizar la cuenta.');
    return updated;
  },

  removeAccount: async (accountId) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const slice = activeSlice(get());
    const current = slice.accounts.find((item) => item.id === accountId);
    if (!current) throw new Error('La cuenta no existe.');
    const label = isWealthDebt(current)
      ? 'Deuda'
      : isWealthAsset(current)
        ? 'Activo'
        : 'Cuenta';
    await deleteResource('account', accountId);
    // Optimistic: drop the account and its movements so Inicio totals match immediately.
    const accounts = slice.accounts.filter((item) => item.id !== accountId);
    const transactions = slice.transactions.filter(
      (item) => item.account !== current.name,
    );
    set((state) => ({
      activeLedgerId: ledgerId,
      snapshots: {
        ...state.snapshots,
        [ledgerId]: {
          ...slice,
          accounts,
          transactions,
          summary: buildSummary(accounts, slice.envelopes, transactions),
        },
      },
    }));
    void get().refreshLedger(ledgerId);
    void recordActivity({
      kind: 'account',
      title: `${label} eliminada`,
      body: `${current.name} · ${ledger?.name ?? 'Libro'}`,
      icon: 'trash',
      tone: 'red',
      sound: 'default',
      route: '/(tabs)/cuentas',
    });
  },

  addEnvelope: async (value) => {
    const ledgerId = get().activeLedgerId;
    if (!ledgerId) throw new Error('No hay un libro activo.');
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);
    const palette = ['#0878F9', '#12B76A', '#F79009', '#7F56D9', '#06AED4', '#F04438', '#EE46BC'];
    const defaultIcon =
      value.kind === 'income'
        ? 'arrow.down.circle.fill'
        : value.kind === 'savings'
          ? 'leaf.fill'
          : 'cart.fill';
    const defaultRule =
      value.kind === 'income'
        ? 'Meta del mes'
        : value.kind === 'savings'
          ? 'Sobre de ahorros · Meta'
          : 'Presupuesto mensual';
    const icon = value.icon ?? defaultIcon;
    const color =
      value.color ?? palette[activeSlice(get()).envelopes.length % palette.length];
    const rule = value.rule?.trim() || defaultRule;
    const rollover = value.rollover ?? value.kind !== 'income';
    const budget = Math.max(0, value.budget);
    const created = await createResource('envelope', ledgerId, value.name.trim(), {
      kind: value.kind,
      budgetMinor: toMinor(budget),
      spentMinor: 0,
      balanceMinor: 0,
      currency,
      icon,
      color,
      rollover,
      rule,
      ...(value.goalId ? { goalId: value.goalId } : {}),
    });
    // Optimistic local insert — never await a full multi-book hydrate here (freezes phones).
    const mapped: Envelope = {
      ...mapEnvelopeResource(created),
      name: value.name.trim(),
      kind: value.kind,
      budget,
      spent: 0,
      icon,
      color,
      rollover,
      rule,
      ...(value.goalId ? { goalId: value.goalId } : {}),
    };
    const slice = activeSlice(get());
    const envelopes = [
      mapped,
      ...slice.envelopes.filter((item) => item.id !== mapped.id),
    ];
    const nextSlice = {
      ...slice,
      envelopes,
      summary: buildSummary(slice.accounts, envelopes, slice.transactions),
    };
    set((state) => ({
      activeLedgerId: ledgerId,
      snapshots: { ...state.snapshots, [ledgerId]: nextSlice },
    }));
    void get().refreshLedger(ledgerId);
    // Goal flow already notifies for the meta; skip duplicate envelope ping.
    if (!value.goalId) {
      void recordActivity({
        kind: 'envelope',
        title: 'Sobre creado',
        body: `${mapped.name} · ${ledger?.name ?? 'Libro'}`,
        icon: mapped.icon || 'envelope.fill',
        sound: 'sobres',
        route: `/(tabs)/envelope/${mapped.id}`,
      });
    }
    return mapped;
  },

  updateEnvelope: async (envelopeId, patch) => {
    const ledgerId = get().activeLedgerId;
    const slice = activeSlice(get());
    const current = slice.envelopes.find((item) => item.id === envelopeId);
    if (!current) throw new Error('El sobre no existe.');
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);
    const budget =
      patch.budget !== undefined ? Math.max(0, patch.budget) : current.budget;
    const nextName = patch.name?.trim() || current.name;
    const nextIcon = patch.icon ?? current.icon;
    const nextColor = patch.color ?? current.color;
    const nextRollover = budget > 0 ? (patch.rollover ?? current.rollover) : false;
    const nextRule =
      patch.rule !== undefined
        ? patch.rule.trim() || current.rule
        : current.rule;

    await updateResource(
      'envelope',
      envelopeId,
      {
        kind: current.kind,
        budgetMinor: toMinor(budget),
        spentMinor: toMinor(current.spent),
        balanceMinor: toMinor(current.spent),
        currency,
        icon: nextIcon,
        color: nextColor,
        rollover: nextRollover,
        rule: nextRule,
        ...(current.goalId ? { goalId: current.goalId } : {}),
      },
      nextName,
    );
    const updated: Envelope = {
      ...current,
      name: nextName,
      budget,
      icon: nextIcon,
      color: nextColor,
      rollover: nextRollover,
      rule: nextRule,
    };
    const envelopes = slice.envelopes.map((item) =>
      item.id === envelopeId ? updated : item,
    );
    set((state) => ({
      activeLedgerId: ledgerId,
      snapshots: {
        ...state.snapshots,
        [ledgerId]: {
          ...slice,
          envelopes,
          summary: buildSummary(slice.accounts, envelopes, slice.transactions),
        },
      },
    }));
    void get().refreshLedger(ledgerId);
    return updated;
  },

  removeEnvelope: async (envelopeId) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const slice = activeSlice(get());
    const current = slice.envelopes.find((item) => item.id === envelopeId);
    if (!current) throw new Error('El sobre no existe.');
    await deleteResource('envelope', envelopeId);
    const envelopes = slice.envelopes.filter((item) => item.id !== envelopeId);
    set((state) => ({
      activeLedgerId: ledgerId,
      snapshots: {
        ...state.snapshots,
        [ledgerId]: {
          ...slice,
          envelopes,
          summary: buildSummary(slice.accounts, envelopes, slice.transactions),
        },
      },
    }));
    void get().refreshLedger(ledgerId);
    void recordActivity({
      kind: 'envelope',
      title: 'Sobre eliminado',
      body: `${current.name} · ${ledger?.name ?? 'Libro'}`,
      icon: 'trash',
      tone: 'red',
      sound: 'default',
      route: '/(tabs)/sobres',
    });
  },

  addPlanningItem: async (value) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const currency = await currencyFor(ledger);
    const bucket = value.bucket;
    const resourceKind = planningResourceKind(bucket);
    const defaults = planningDefaults(bucket);
    const created = await createResource(resourceKind, ledgerId, value.name.trim(), {
      amountMinor: toMinor(Math.abs(value.amount)),
      currency,
      frequency: 'monthly',
      cashflow: bucket === 'income' ? 'income' : 'expense',
      bucket,
      icon: value.icon ?? defaults.icon,
      subtitle: value.subtitle?.trim() || defaults.subtitle,
    });
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const mapped = get().snapshots[ledgerId]?.planning.find(
      (item) => item.id === objectId(created),
    );
    if (!mapped) throw new Error('No se pudo crear el ítem de planificación.');
    const isIncomePlan = bucket === 'income';
    void recordActivity({
      kind: 'planning',
      title: isIncomePlan ? 'Ingreso recurrente creado' : 'Gasto recurrente creado',
      body: `${mapped.name} · ${money(Math.abs(value.amount))} · ${ledger?.name ?? 'Libro'}`,
      icon: mapped.icon || (isIncomePlan ? 'arrow.down.circle.fill' : 'repeat'),
      sound: 'sobres',
      route: '/(tabs)/salud-financiera',
    });
    return mapped;
  },

  updatePlanningItem: async (planningId, value) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const current = activeSlice(get()).planning.find((item) => item.id === planningId);
    if (!current) throw new Error('El ítem de planificación no existe.');
    const currency = await currencyFor(ledger);
    const bucket = value.bucket;
    const oldKind = planningResourceKind(current.bucket);
    const newKind = planningResourceKind(bucket);
    const defaults = planningDefaults(bucket);
    const data = {
      amountMinor: toMinor(Math.abs(value.amount)),
      currency,
      frequency: 'monthly',
      cashflow: bucket === 'income' ? 'income' : 'expense',
      bucket,
      icon: value.icon ?? current.icon ?? defaults.icon,
      subtitle: value.subtitle?.trim() || current.subtitle || defaults.subtitle,
    };
    const name = value.name.trim();
    if (oldKind !== newKind) {
      await deleteResource(oldKind, planningId);
      await createResource(newKind, ledgerId, name, data);
    } else {
      await updateResource(newKind, planningId, data, name);
    }
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const mapped =
      get().snapshots[ledgerId]?.planning.find((item) => item.id === planningId) ??
      get().snapshots[ledgerId]?.planning.find(
        (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
      );
    if (!mapped) throw new Error('No se pudo actualizar el ítem de planificación.');
    void recordActivity({
      kind: 'planning',
      title: bucket === 'income' ? 'Ingreso recurrente actualizado' : 'Gasto recurrente actualizado',
      body: `${mapped.name} · ${money(Math.abs(value.amount))} · ${ledger?.name ?? 'Libro'}`,
      icon: mapped.icon || defaults.icon,
      sound: 'sobres',
      route: '/(tabs)/salud-financiera',
    });
    return mapped;
  },

  removePlanningItem: async (planningId) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const current = activeSlice(get()).planning.find((item) => item.id === planningId);
    if (!current) throw new Error('El ítem de planificación no existe.');
    await deleteResource(planningResourceKind(current.bucket), planningId);
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    void recordActivity({
      kind: 'planning',
      title:
        current.bucket === 'income'
          ? 'Ingreso recurrente eliminado'
          : 'Gasto recurrente eliminado',
      body: `${current.name} · ${ledger?.name ?? 'Libro'}`,
      icon: 'trash',
      tone: 'red',
      sound: 'default',
      route: '/(tabs)/salud-financiera',
    });
  },
}));

export function useActiveLedger() {
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const ledger =
    ledgers.find((item) => item.id === activeLedgerId) ?? ledgers[0] ?? emptyLedger;
  const data = snapshots[activeLedgerId] ?? emptySnapshot();
  return { ledger, ...data, activeLedgerId };
}
