import { create } from 'zustand';

import {
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
  createLedgerTransaction,
  createResource,
  createWorkspace,
  deleteWorkspace,
  ensureWorkspaceDefaults,
  listMembers,
  listWorkspaces,
  loadWorkspaceSnapshot,
  mapApiMember,
  mapWorkspaceToLedger,
  objectId,
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
  setLedgerCurrency: (currency: string) => Promise<void>;
  addTransaction: (value: NewTransaction) => Promise<Transaction>;
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
};

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
    const members = membersRaw.map((member) => mapApiMember(member, selfId));
    const meta = mapWorkspaceToLedger(workspace, members);
    meta.baseCurrency = (workspace.baseCurrency || 'COP').toUpperCase();
    ledgers.push(meta);
    const loaded = await loadWorkspaceSnapshot(id, meta.baseCurrency);
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
    const trimmed = name.trim();
    if (!trimmed) return;
    await updateWorkspace(ledgerId, { name: trimmed });
    set({
      ledgers: get().ledgers.map((ledger) =>
        ledger.id === ledgerId ? { ...ledger, name: trimmed } : ledger,
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
      // Ensure clearing exists after fresh hydrate races.
      await ensureWorkspaceDefaults(ledgerId, currency);
      await get().hydrate();
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

    // Keep account balance in Mongo resource in sync with the UI model.
    const nextBalanceMinor = toMinor(account.balance + value.amount);
    await updateResource('account', account.id, {
      balanceMinor: nextBalanceMinor,
      currency,
      kind: account.kind,
      icon: account.icon,
      color: account.color,
      lastFour: account.lastFour,
    });

    if (envelope) {
      const nextSpent = Math.max(0, envelope.spent + Math.abs(value.amount));
      await updateResource(
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
      );
    }

    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const mapped = get().snapshots[ledgerId]?.transactions.find(
      (item) => item.id === objectId(created),
    );
    const result =
      mapped ?? {
        ...value,
        id: objectId(created),
        date: value.date ?? 'Ahora',
        icon: value.icon ?? (value.amount > 0 ? 'arrow.down.circle.fill' : 'banknote.fill'),
        envelopeId: envelope?.id,
        occurredAt: occurredAt,
      };
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
    const current = activeSlice(get()).accounts.find((item) => item.id === accountId);
    if (!current) throw new Error('La cuenta no existe.');
    const label = isWealthDebt(current)
      ? 'Deuda'
      : isWealthAsset(current)
        ? 'Activo'
        : 'Cuenta';
    await deleteResource('account', accountId);
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
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
    const created = await createResource('envelope', ledgerId, value.name.trim(), {
      kind: value.kind,
      budgetMinor: toMinor(Math.max(0, value.budget)),
      spentMinor: 0,
      balanceMinor: 0,
      currency,
      icon: value.icon ?? defaultIcon,
      color: value.color ?? palette[activeSlice(get()).envelopes.length % palette.length],
      rollover: value.rollover ?? value.kind !== 'income',
      rule: value.rule?.trim() || defaultRule,
      ...(value.goalId ? { goalId: value.goalId } : {}),
    });
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const mapped = get().snapshots[ledgerId]?.envelopes.find(
      (item) => item.id === objectId(created),
    );
    if (!mapped) throw new Error('No se pudo crear el sobre.');
    // Goal flow already notifies for the meta; skip duplicate envelope ping.
    if (!value.goalId) {
      void recordActivity({
        kind: 'envelope',
        title: 'Sobre creado',
        body: `${mapped.name} · ${ledger?.name ?? 'Libro'}`,
        icon: mapped.icon || 'envelope.fill',
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

    await updateResource(
      'envelope',
      envelopeId,
      {
        kind: current.kind,
        budgetMinor: toMinor(budget),
        spentMinor: toMinor(current.spent),
        balanceMinor: toMinor(current.spent),
        currency,
        icon: patch.icon ?? current.icon,
        color: patch.color ?? current.color,
        rollover: budget > 0 ? (patch.rollover ?? current.rollover) : false,
        rule:
          patch.rule !== undefined
            ? patch.rule.trim() || current.rule
            : current.rule,
        ...(current.goalId ? { goalId: current.goalId } : {}),
      },
      patch.name?.trim() || current.name,
    );
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
    const updated = get().snapshots[ledgerId]?.envelopes.find(
      (item) => item.id === envelopeId,
    );
    if (!updated) throw new Error('No se pudo actualizar el sobre.');
    return updated;
  },

  removeEnvelope: async (envelopeId) => {
    const ledgerId = get().activeLedgerId;
    const ledger = get().ledgers.find((item) => item.id === ledgerId);
    const current = activeSlice(get()).envelopes.find((item) => item.id === envelopeId);
    if (!current) throw new Error('El sobre no existe.');
    await deleteResource('envelope', envelopeId);
    await get().hydrate();
    set({ activeLedgerId: ledgerId });
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
    const resourceKind = bucket === 'subscription' ? 'subscription' : 'bill';
    const defaultIcon =
      bucket === 'income'
        ? 'arrow.down.circle.fill'
        : bucket === 'bill'
          ? 'doc.text.fill'
          : bucket === 'subscription'
            ? 'repeat'
            : 'arrow.clockwise';
    const defaultSubtitle =
      bucket === 'income'
        ? 'Ingreso recurrente'
        : bucket === 'bill'
          ? 'Factura'
          : bucket === 'subscription'
            ? 'Suscripción'
            : 'Gasto recurrente';
    const created = await createResource(resourceKind, ledgerId, value.name.trim(), {
      amountMinor: toMinor(Math.abs(value.amount)),
      currency,
      frequency: 'monthly',
      cashflow: bucket === 'income' ? 'income' : 'expense',
      bucket,
      icon: value.icon ?? defaultIcon,
      subtitle: value.subtitle?.trim() || defaultSubtitle,
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
      route: '/(tabs)/salud-financiera',
    });
    return mapped;
  },
}));

export function useActiveLedger() {
  const activeLedgerId = useLedgerStore((state) => state.activeLedgerId);
  const ledgers = useLedgerStore((state) => state.ledgers);
  const snapshots = useLedgerStore((state) => state.snapshots);
  const ledger = ledgers.find((item) => item.id === activeLedgerId) ?? ledgers[0];
  const data = snapshots[activeLedgerId] ?? emptySnapshot();
  return { ledger, ...data, activeLedgerId };
}
