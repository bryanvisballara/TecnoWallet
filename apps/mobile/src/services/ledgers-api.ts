import { apiRequest } from '@/services/api';
import type { Account, Envelope, Transaction } from '@/data/demo';
import {
  emptySnapshot,
  type LedgerMember,
  type LedgerMeta,
  type LedgerSnapshot,
  type LedgerSummary,
  type PlanningBucket,
  type PlanningItem,
} from '@/data/ledgers';

type ResourceKind = 'account' | 'envelope' | 'bill' | 'subscription';

export type ApiWorkspace = {
  _id?: string;
  id?: string;
  name: string;
  type: 'personal' | 'shared';
  baseCurrency?: string;
  color?: string;
  icon?: string;
  shareCode?: string;
};

export type ApiMember = {
  userId: string;
  role: string;
  name?: string;
  email?: string;
};

export type ApiResource = {
  _id?: string;
  id?: string;
  name: string;
  ownerId?: string;
  data?: Record<string, unknown>;
  version?: number;
  createdAt?: string;
};

export type ApiTransaction = {
  _id?: string;
  id?: string;
  description: string;
  kind: string;
  occurredAt: string;
  entries: Array<{
    accountId: string;
    currency: string;
    amountMinor: number;
    envelopeId?: string;
  }>;
  ownerId?: string;
  /** Set when this transaction was corrected/voided via reverse. */
  reversedById?: string;
};

const CLEARING_NAME = '__clearing__';

export function objectId(value: { _id?: string; id?: string } | string | null | undefined) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id ?? value.id ?? '');
}

export function toMinor(amount: number) {
  return Math.round(amount * 100);
}

export function fromMinor(amountMinor: number) {
  return amountMinor / 100;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBool(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

export function mapWorkspaceToLedger(
  workspace: ApiWorkspace,
  members: LedgerMember[],
): LedgerMeta {
  const id = objectId(workspace);
  return {
    id,
    name: workspace.name || 'Libro',
    color: workspace.color || '#F5C518',
    icon: workspace.icon || 'wallet.pass.fill',
    type: members.length > 1 ? 'shared' : workspace.type === 'shared' ? 'shared' : 'personal',
    baseCurrency: (workspace.baseCurrency || 'COP').toUpperCase(),
    shareCode: workspace.shareCode?.trim().toUpperCase() || undefined,
    members,
  };
}

export function mapApiMember(member: ApiMember, selfUserId?: string | null): LedgerMember {
  const role = (['owner', 'admin', 'member', 'viewer'].includes(member.role)
    ? member.role
    : 'member') as LedgerMember['role'];
  const userId = String(member.userId ?? '').trim();
  return {
    id: selfUserId && userId && userId === String(selfUserId) ? 'me' : userId,
    name: member.name?.trim() || member.email?.split('@')[0] || 'Miembro',
    email: (member.email || '').toLowerCase(),
    role,
  };
}

/** Unique people only — avoids inflated “3 personas” when the same user appears twice. */
export function mapApiMembers(
  members: ApiMember[],
  selfUserId?: string | null,
): LedgerMember[] {
  const seenIds = new Set<string>();
  const seenEmails = new Set<string>();
  const mapped: LedgerMember[] = [];
  for (const member of members) {
    const userId = String(member.userId ?? '').trim();
    if (!userId) continue;
    const email = (member.email || '').trim().toLowerCase();
    if (seenIds.has(userId)) continue;
    if (email && seenEmails.has(email)) continue;
    seenIds.add(userId);
    if (email) seenEmails.add(email);
    mapped.push(mapApiMember(member, selfUserId));
  }
  mapped.sort((a, b) => {
    if (a.role === 'owner' && b.role !== 'owner') return -1;
    if (b.role === 'owner' && a.role !== 'owner') return 1;
    return a.name.localeCompare(b.name, 'es');
  });
  return mapped;
}

export function mapAccountResource(resource: ApiResource): Account | null {
  const data = resource.data ?? {};
  if (data.system === true || resource.name === CLEARING_NAME) return null;
  const ownerId = resource.ownerId ? String(resource.ownerId) : undefined;
  return {
    id: objectId(resource),
    name: resource.name,
    kind: asString(data.kind, 'Cuenta corriente'),
    balance: fromMinor(asNumber(data.balanceMinor, 0)),
    icon: asString(data.icon, 'creditcard.fill'),
    color: asString(data.color, '#0878F9'),
    lastFour: asString(data.lastFour, '—') || '—',
    createdByUserId: ownerId,
    createdAt:
      typeof resource.createdAt === 'string' ? resource.createdAt : undefined,
  };
}

export function mapEnvelopeResource(resource: ApiResource): Envelope {
  const data = resource.data ?? {};
  const kindRaw = asString(data.kind, 'expense');
  const kind =
    kindRaw === 'income' || kindRaw === 'savings' || kindRaw === 'expense'
      ? kindRaw
      : 'expense';
  const ownerId = resource.ownerId ? String(resource.ownerId) : undefined;
  return {
    id: objectId(resource),
    name: resource.name,
    kind,
    spent: fromMinor(asNumber(data.spentMinor, asNumber(data.balanceMinor, 0))),
    budget: fromMinor(asNumber(data.budgetMinor, 0)),
    icon: asString(data.icon, 'cart.fill'),
    color: asString(data.color, '#0878F9'),
    rollover: asBool(data.rollover, kind !== 'income'),
    rule: asString(data.rule, 'Sin regla aún'),
    goalId: asString(data.goalId) || undefined,
    createdByUserId: ownerId,
    createdAt:
      typeof resource.createdAt === 'string' ? resource.createdAt : undefined,
  };
}

function normalizePlanningBucket(
  value: string,
  fallback: PlanningBucket,
): PlanningBucket {
  if (value === 'income' || value === 'bill' || value === 'subscription' || value === 'recurring') {
    return value;
  }
  return fallback;
}

export function mapPlanningResource(
  resource: ApiResource,
  resourceKind: 'bill' | 'subscription',
): PlanningItem {
  const data = resource.data ?? {};
  const cashflow = asString(data.cashflow, resourceKind === 'bill' ? '' : 'expense');
  const defaultBucket: PlanningBucket =
    cashflow === 'income' ? 'income' : resourceKind === 'subscription' ? 'subscription' : 'bill';
  const bucket = normalizePlanningBucket(asString(data.bucket, defaultBucket), defaultBucket);
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
  return {
    id: objectId(resource),
    name: resource.name,
    amount: fromMinor(asNumber(data.amountMinor, 0)),
    bucket,
    icon: asString(data.icon, defaultIcon),
    subtitle: asString(data.subtitle, defaultSubtitle) || defaultSubtitle,
    createdByUserId: resource.ownerId ? String(resource.ownerId) : undefined,
    createdAt:
      typeof resource.createdAt === 'string' ? resource.createdAt : undefined,
  };
}

export function mapTransaction(
  tx: ApiTransaction,
  accountsById: Map<string, Account>,
  envelopesById?: Map<string, Envelope>,
  authorByUserId?: Map<string, string>,
): Transaction {
  const userFacing = tx.entries.find((entry) => {
    const account = accountsById.get(String(entry.accountId));
    return Boolean(account);
  });
  const amountMinor = userFacing?.amountMinor ?? tx.entries[0]?.amountMinor ?? 0;
  const account = userFacing
    ? accountsById.get(String(userFacing.accountId))
    : undefined;
  const envelopeIdRaw =
    userFacing?.envelopeId ??
    tx.entries.find((entry) => entry.envelopeId)?.envelopeId;
  const envelopeId = envelopeIdRaw ? String(envelopeIdRaw) : undefined;
  const envelope = envelopeId ? envelopesById?.get(envelopeId) : undefined;
  const occurred = new Date(tx.occurredAt);
  const dateLabel = Number.isNaN(occurred.getTime())
    ? tx.occurredAt
    : occurred.toLocaleString('es', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
  const createdByUserId = tx.ownerId ? String(tx.ownerId) : undefined;
  const createdBy = createdByUserId
    ? authorByUserId?.get(createdByUserId)?.trim() || undefined
    : undefined;
  return {
    id: objectId(tx),
    title: tx.description,
    // Sobres UI matches spent by envelope name — never use tx.kind here.
    category: envelope?.name ?? (tx.kind === 'income' || tx.kind === 'expense' ? tx.kind : 'Movimiento'),
    account: account?.name ?? 'Cuenta',
    amount: fromMinor(amountMinor),
    date: dateLabel,
    icon: amountMinor >= 0 ? 'arrow.down.circle.fill' : 'banknote.fill',
    envelopeId,
    occurredAt: Number.isNaN(occurred.getTime()) ? undefined : occurred.toISOString(),
    createdBy,
    createdByUserId,
  };
}

export function buildSummary(
  accounts: Account[],
  envelopes: Envelope[],
  transactions: Transaction[],
): LedgerSummary {
  const total = accounts.reduce((sum, item) => sum + item.balance, 0);
  const income = transactions
    .filter((item) => item.amount > 0)
    .reduce((sum, item) => sum + item.amount, 0);
  const expenses = transactions
    .filter((item) => item.amount < 0)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const savings = envelopes
    .filter((item) => item.kind === 'savings')
    .reduce((sum, item) => sum + item.spent, 0);
  return {
    total,
    income,
    expenses,
    remaining: income - expenses,
    savings,
    daily: 0,
    goal: 0,
    goalCurrent: 0,
    comparison: 0,
  };
}

export async function listWorkspaces() {
  return apiRequest<ApiWorkspace[]>('/workspaces');
}

export async function createWorkspace(input: {
  name: string;
  type?: 'personal' | 'shared';
  baseCurrency?: string;
  color?: string;
  icon?: string;
}) {
  return apiRequest<ApiWorkspace>('/workspaces', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? 'personal',
      baseCurrency: input.baseCurrency ?? 'COP',
      color: input.color,
      icon: input.icon,
    }),
  });
}

export async function updateWorkspace(
  workspaceId: string,
  patch: {
    name?: string;
    type?: 'personal' | 'shared';
    baseCurrency?: string;
    color?: string;
    icon?: string;
  },
) {
  return apiRequest<ApiWorkspace>(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteWorkspace(workspaceId: string) {
  return apiRequest<{ deleted: boolean }>(`/workspaces/${workspaceId}`, {
    method: 'DELETE',
  });
}

export async function listMembers(workspaceId: string) {
  return apiRequest<ApiMember[]>(`/workspaces/${workspaceId}/members`);
}

export async function fetchWorkspaceShareCode(workspaceId: string) {
  return apiRequest<{ shareCode: string }>(
    `/workspaces/${encodeURIComponent(workspaceId)}/share-code`,
  ).then((result) => result.shareCode?.trim().toUpperCase() || '');
}

export async function addWorkspaceMember(
  workspaceId: string,
  email: string,
  role: 'admin' | 'member' | 'viewer' = 'member',
) {
  return apiRequest(`/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string,
) {
  return apiRequest<{ removed: boolean }>(
    `/workspaces/${workspaceId}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
}

export async function listResources(kind: ResourceKind, workspaceId: string) {
  return apiRequest<ApiResource[]>(
    `/resources/${kind}?workspaceId=${encodeURIComponent(workspaceId)}&limit=100`,
  );
}

export async function createResource(
  kind: ResourceKind,
  workspaceId: string,
  name: string,
  data: Record<string, unknown>,
) {
  return apiRequest<ApiResource>(`/resources/${kind}`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId,
      name,
      privacy: 'workspace',
      data,
    }),
  });
}

export async function updateResource(
  kind: ResourceKind,
  id: string,
  data: Record<string, unknown>,
  name?: string,
  baseVersion?: number,
) {
  return apiRequest<ApiResource>(`/resources/${kind}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(name ? { name } : {}),
      data,
      ...(baseVersion !== undefined ? { baseVersion } : {}),
    }),
  });
}

export async function deleteResource(kind: ResourceKind, id: string) {
  return apiRequest<{ deletedAt?: string } | ApiResource>(`/resources/${kind}/${id}`, {
    method: 'DELETE',
  });
}

export async function listTransactions(workspaceId: string) {
  return apiRequest<ApiTransaction[]>(
    `/transactions?workspaceId=${encodeURIComponent(workspaceId)}`,
  );
}

export async function createLedgerTransaction(input: {
  workspaceId: string;
  kind: 'income' | 'expense';
  description: string;
  occurredAt: string;
  accountId: string;
  clearingAccountId: string;
  amountMajor: number;
  currency: string;
  envelopeId?: string;
  idempotencyKey?: string;
}) {
  const amountMinor = toMinor(Math.abs(input.amountMajor));
  const signed = input.kind === 'income' ? amountMinor : -amountMinor;
  return apiRequest<ApiTransaction>('/transactions', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId,
      kind: input.kind,
      occurredAt: input.occurredAt,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      entries: [
        {
          accountId: input.accountId,
          currency: input.currency,
          amountMinor: signed,
          ...(input.envelopeId ? { envelopeId: input.envelopeId } : {}),
        },
        {
          accountId: input.clearingAccountId,
          currency: input.currency,
          amountMinor: -signed,
        },
      ],
    }),
  });
}

/** Ledger rows are immutable — corrections create an opposite refund entry. */
export async function reverseLedgerTransaction(
  transactionId: string,
  description?: string,
) {
  return apiRequest<ApiTransaction>(
    `/transactions/${encodeURIComponent(transactionId)}/reverse`,
    {
      method: 'POST',
      body: JSON.stringify(
        description?.trim() ? { description: description.trim() } : {},
      ),
    },
  );
}

/** Ensure cash + envelopes + clearing exist in Mongo for a book. */
export async function ensureWorkspaceDefaults(workspaceId: string, currency: string) {
  const [accounts, envelopes] = await Promise.all([
    listResources('account', workspaceId),
    listResources('envelope', workspaceId),
  ]);

  let clearing = accounts.find(
    (item) => item.name === CLEARING_NAME || item.data?.system === true,
  );
  if (!clearing) {
    clearing = await createResource('account', workspaceId, CLEARING_NAME, {
      system: true,
      balanceMinor: 0,
      currency,
      kind: 'Sistema',
      icon: 'gearshape.fill',
      color: '#98A2B3',
      lastFour: '—',
    });
  }

  const userAccounts = accounts.filter(
    (item) => item.name !== CLEARING_NAME && item.data?.system !== true,
  );
  if (userAccounts.length === 0) {
    await createResource('account', workspaceId, 'Efectivo', {
      balanceMinor: 0,
      currency,
      kind: 'Efectivo',
      icon: 'banknote.fill',
      color: '#F79009',
      lastFour: '—',
    });
  }

  if (envelopes.length === 0) {
    await Promise.all([
      createResource('envelope', workspaceId, 'Ingresos', {
        kind: 'income',
        budgetMinor: 0,
        spentMinor: 0,
        balanceMinor: 0,
        currency,
        icon: 'arrow.down.circle.fill',
        color: '#12B76A',
        rollover: false,
        rule: 'Sin regla aún',
      }),
      createResource('envelope', workspaceId, 'Gastos generales', {
        kind: 'expense',
        budgetMinor: 0,
        spentMinor: 0,
        balanceMinor: 0,
        currency,
        icon: 'cart.fill',
        color: '#0878F9',
        rollover: true,
        rule: 'Presupuesto inicial',
      }),
    ]);
  }

  return { clearingId: objectId(clearing) };
}

/** Resolve display names for transaction authors (API ownerId → name). */
export function authorNameByUserId(
  members: LedgerMember[],
  selfUserId?: string | null,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const member of members) {
    const name = member.name?.trim();
    if (!name) continue;
    if (member.id === 'me') {
      if (selfUserId) map.set(String(selfUserId), name);
      continue;
    }
    map.set(String(member.id), name);
  }
  return map;
}

export async function loadWorkspaceSnapshot(
  workspaceId: string,
  currency: string,
  options?: {
    members?: LedgerMember[];
    selfUserId?: string | null;
  },
): Promise<{ snapshot: LedgerSnapshot; clearingId: string }> {
  const { clearingId } = await ensureWorkspaceDefaults(workspaceId, currency);
  const [accountResources, envelopeResources, billResources, subscriptionResources, transactions] =
    await Promise.all([
      listResources('account', workspaceId),
      listResources('envelope', workspaceId),
      listResources('bill', workspaceId),
      listResources('subscription', workspaceId),
      listTransactions(workspaceId),
    ]);

  const authors = authorNameByUserId(
    options?.members ?? [],
    options?.selfUserId,
  );
  const accounts = accountResources
    .map(mapAccountResource)
    .filter((item): item is Account => Boolean(item))
    .map((item) => ({
      ...item,
      createdBy: item.createdByUserId
        ? authors.get(item.createdByUserId)?.trim() || undefined
        : undefined,
    }));
  const accountsById = new Map(accounts.map((item) => [item.id, item]));
  const envelopes = envelopeResources.map((resource) => {
    const mapped = mapEnvelopeResource(resource);
    const authorId = mapped.createdByUserId;
    return {
      ...mapped,
      createdBy: authorId
        ? authors.get(authorId)?.trim() || undefined
        : undefined,
    };
  });
  const envelopesById = new Map(envelopes.map((item) => [item.id, item]));
  const planning = [
    ...billResources.map((item) => mapPlanningResource(item, 'bill')),
    ...subscriptionResources.map((item) =>
      mapPlanningResource(item, 'subscription'),
    ),
  ].map((item) => ({
    ...item,
    createdBy: item.createdByUserId
      ? authors.get(item.createdByUserId)?.trim() || undefined
      : undefined,
  }));
  const mappedTx = transactions
    .filter((tx) => {
      if (tx.reversedById) return false;
      if (tx.kind === 'refund') return false;
      if (tx.entries.every((entry) => String(entry.accountId) === clearingId)) {
        return false;
      }
      // Drop orphans from deleted accounts (user-facing entry no longer exists).
      const hasLiveUserAccount = tx.entries.some((entry) => {
        const accountId = String(entry.accountId);
        return accountId !== clearingId && accountsById.has(accountId);
      });
      return hasLiveUserAccount;
    })
    .map((tx) => mapTransaction(tx, accountsById, envelopesById, authors));

  // Derive envelope spent from ledger entries so UI stays correct even if
  // spentMinor on the resource was never incremented.
  const spentByEnvelopeId = new Map<string, number>();
  for (const tx of mappedTx) {
    if (!tx.envelopeId) continue;
    spentByEnvelopeId.set(
      tx.envelopeId,
      (spentByEnvelopeId.get(tx.envelopeId) ?? 0) + Math.abs(tx.amount),
    );
  }
  const envelopesWithSpent = envelopes.map((item) => ({
    ...item,
    spent: spentByEnvelopeId.has(item.id)
      ? spentByEnvelopeId.get(item.id)!
      : item.spent,
  }));

  const snapshot: LedgerSnapshot = {
    ...emptySnapshot(),
    accounts,
    envelopes: envelopesWithSpent,
    transactions: mappedTx,
    summary: buildSummary(accounts, envelopesWithSpent, mappedTx),
    upcoming: [],
    planning,
  };
  return { snapshot, clearingId };
}
