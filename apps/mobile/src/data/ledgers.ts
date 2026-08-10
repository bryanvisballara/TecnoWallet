import {
  accounts as hogarAccounts,
  envelopes as hogarEnvelopes,
  summary as hogarSummary,
  transactions as hogarTransactions,
  upcoming as hogarUpcoming,
  type Account,
  type Envelope,
  type Transaction,
} from '@/data/demo';

export type LedgerMemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export type LedgerMember = {
  id: string;
  name: string;
  email: string;
  role: LedgerMemberRole;
};

export type LedgerSummary = {
  total: number;
  income: number;
  expenses: number;
  remaining: number;
  savings: number;
  daily: number;
  goal: number;
  goalCurrent: number;
  comparison: number;
};

export type PlanningBucket = 'income' | 'bill' | 'subscription' | 'recurring';

export type PlanningItem = {
  id: string;
  name: string;
  amount: number;
  bucket: PlanningBucket;
  icon: string;
  subtitle?: string;
};

export type LedgerSnapshot = {
  summary: LedgerSummary;
  accounts: Account[];
  envelopes: Envelope[];
  transactions: Transaction[];
  upcoming: Array<{ name: string; date: string; amount: number; color: string }>;
  /** Proyección mensual de planificación (ingresos/gastos recurrentes). */
  planning: PlanningItem[];
};

export type LedgerMeta = {
  id: string;
  name: string;
  color: string;
  icon: string;
  type: 'personal' | 'shared';
  members: LedgerMember[];
  /** ISO 4217 from Mongo workspace (source of truth). */
  baseCurrency?: string;
  /** Short join-by-ID code for owners (e.g. TW8F3K2M1Q). */
  shareCode?: string;
};

export const ownerSelf: LedgerMember = {
  id: 'me',
  name: 'Alex Rivera',
  email: 'alex@tecnowallet.app',
  role: 'owner',
};

export function emptySnapshot(): LedgerSnapshot {
  const stamp = Date.now();
  return {
    summary: {
      total: 0,
      income: 0,
      expenses: 0,
      remaining: 0,
      savings: 0,
      daily: 0,
      goal: 0,
      goalCurrent: 0,
      comparison: 0,
    },
    accounts: [
      {
        id: `cash-${stamp}`,
        name: 'Efectivo',
        kind: 'Efectivo',
        balance: 0,
        icon: 'banknote.fill',
        color: '#F79009',
        lastFour: '—',
      },
    ],
    envelopes: [
      {
        id: `inc-${stamp}`,
        name: 'Ingresos',
        kind: 'income',
        spent: 0,
        budget: 0,
        icon: 'arrow.down.circle.fill',
        color: '#12B76A',
        rollover: false,
        rule: 'Sin regla aún',
      },
      {
        id: `exp-${stamp}`,
        name: 'Gastos generales',
        kind: 'expense',
        spent: 0,
        budget: 0,
        icon: 'cart.fill',
        color: '#0878F9',
        rollover: true,
        rule: 'Presupuesto inicial',
      },
    ],
    transactions: [],
    upcoming: [],
    planning: [],
  };
}

/** Default book for a brand-new account: only Hogar, empty, owned by the user. */
export function defaultHogarState(owner: {
  name: string;
  email: string;
}): {
  ledgers: LedgerMeta[];
  activeLedgerId: string;
  snapshots: Record<string, LedgerSnapshot>;
} {
  const member: LedgerMember = {
    id: 'me',
    name: owner.name.trim() || 'Usuario',
    email: owner.email.trim().toLowerCase(),
    role: 'owner',
  };
  return {
    ledgers: [
      {
        id: 'hogar',
        name: 'Hogar',
        color: '#F5C518',
        icon: 'house.fill',
        type: 'personal',
        members: [member],
      },
    ],
    activeLedgerId: 'hogar',
    snapshots: {
      hogar: emptySnapshot(),
    },
  };
}

export const seedLedgers: LedgerMeta[] = [
  {
    id: 'hogar',
    name: 'Hogar',
    color: '#F5C518',
    icon: 'house.fill',
    type: 'shared',
    members: [
      ownerSelf,
      { id: 'sam', name: 'Sam Rivera', email: 'sam@tecnowallet.app', role: 'member' },
    ],
  },
  {
    id: 'teach-me',
    name: 'Teach Me',
    color: '#F04438',
    icon: 'laptopcomputer',
    type: 'shared',
    members: [
      ownerSelf,
      { id: 'dani', name: 'Daniela Vergel', email: 'dani@teachme.app', role: 'admin' },
    ],
  },
  {
    id: 'amazon',
    name: 'Amazon kunkka',
    color: '#06AED4',
    icon: 'laptopcomputer',
    type: 'personal',
    members: [ownerSelf],
  },
];

export const seedSnapshots: Record<string, LedgerSnapshot> = {
  hogar: {
    summary: { ...hogarSummary },
    accounts: hogarAccounts.map((item) => ({ ...item })),
    envelopes: hogarEnvelopes.map((item) => ({ ...item })),
    transactions: hogarTransactions.map((item) => ({ ...item })),
    upcoming: hogarUpcoming.map((item) => ({ ...item })),
    planning: [],
  },
  'teach-me': {
    summary: {
      total: 4820,
      income: 3620,
      expenses: 1180,
      remaining: 2440,
      savings: 900,
      daily: 78,
      goal: 4000,
      goalCurrent: 2100,
      comparison: 8.2,
    },
    accounts: [
      { id: 'tm1', name: 'Nequi Teach', kind: 'Cuenta corriente', balance: 1820, icon: 'creditcard.fill', color: '#F04438', lastFour: '3310' },
      { id: 'tm2', name: 'Ahorros cursos', kind: 'Cuenta de ahorro', balance: 3000, icon: 'building.columns.fill', color: '#12B76A', lastFour: '7721' },
    ],
    envelopes: [
      { id: 'tm-inc', name: 'Datáfono', kind: 'income', spent: 3280, budget: 3500, icon: 'arrow.down.circle.fill', color: '#12B76A', rollover: false, rule: 'Cobros del mes' },
      { id: 'tm-mat', name: 'Material', kind: 'expense', spent: 420, budget: 600, icon: 'cart.fill', color: '#F79009', rollover: true, rule: 'Insumos clase' },
      { id: 'tm-ads', name: 'Publicidad', kind: 'expense', spent: 380, budget: 500, icon: 'flame.fill', color: '#7F56D9', rollover: false, rule: 'Ads Meta' },
      { id: 'tm-ops', name: 'Operación', kind: 'expense', spent: 380, budget: 700, icon: 'gearshape.fill', color: '#0878F9', rollover: true, rule: 'Gastos fijos' },
    ],
    transactions: [
      { id: 'tm-t1', title: 'Cobro datáfono', category: 'Ingresos', account: 'Nequi Teach', amount: 700, date: 'Hoy, 12:40', icon: 'arrow.down.circle.fill', createdBy: 'Daniela Vergel' },
      { id: 'tm-t2', title: 'Impresión guías', category: 'Material', account: 'Nequi Teach', amount: -86, date: 'Ayer, 16:10', icon: 'cart.fill', createdBy: 'Daniela Vergel' },
      { id: 'tm-t3', title: 'Ads Instagram', category: 'Publicidad', account: 'Nequi Teach', amount: -120, date: '3 ago', icon: 'flame.fill', createdBy: 'Alex Rivera' },
    ],
    upcoming: [
      { name: 'Renta aula', date: '10 ago', amount: 450, color: '#0878F9' },
      { name: 'Licencia Zoom', date: '18 ago', amount: 32, color: '#7F56D9' },
    ],
    planning: [],
  },
  amazon: {
    summary: {
      total: 12640,
      income: 9100,
      expenses: 5480,
      remaining: 3620,
      savings: 2200,
      daily: 145,
      goal: 8000,
      goalCurrent: 5400,
      comparison: -3.1,
    },
    accounts: [
      { id: 'am1', name: 'Mercado Pago', kind: 'Cuenta corriente', balance: 6240, icon: 'creditcard.fill', color: '#06AED4', lastFour: '9012' },
      { id: 'am2', name: 'Inventario USD', kind: 'Cuenta de ahorro', balance: 6400, icon: 'building.columns.fill', color: '#0878F9', lastFour: '4411' },
    ],
    envelopes: [
      { id: 'am-sales', name: 'Ventas Amazon', kind: 'income', spent: 7800, budget: 9000, icon: 'arrow.down.circle.fill', color: '#12B76A', rollover: false, rule: 'Liquidaciones semanales' },
      { id: 'am-ads', name: 'Ads Amazon', kind: 'expense', spent: 2100, budget: 2500, icon: 'flame.fill', color: '#F79009', rollover: false, rule: 'ACOS objetivo 25%' },
      { id: 'am-ship', name: 'Envíos', kind: 'expense', spent: 1680, budget: 2000, icon: 'airplane', color: '#06AED4', rollover: true, rule: 'FBA + courier' },
      { id: 'am-stock', name: 'Reposición', kind: 'expense', spent: 1700, budget: 3000, icon: 'cart.fill', color: '#7F56D9', rollover: true, rule: 'Stock Q3' },
    ],
    transactions: [
      { id: 'am-t1', title: 'Liquidación Amazon', category: 'Ingresos', account: 'Mercado Pago', amount: 1840, date: 'Hoy, 09:15', icon: 'arrow.down.circle.fill' },
      { id: 'am-t2', title: 'Campaña sponsored', category: 'Publicidad', account: 'Mercado Pago', amount: -320, date: 'Ayer, 11:00', icon: 'flame.fill' },
      { id: 'am-t3', title: 'Envío courier', category: 'Envíos', account: 'Mercado Pago', amount: -94.5, date: '2 ago', icon: 'airplane' },
      { id: 'am-t4', title: 'Compra stock', category: 'Reposición', account: 'Inventario USD', amount: -1100, date: '1 ago', icon: 'cart.fill' },
    ],
    upcoming: [
      { name: 'Pago FBA', date: '12 ago', amount: 280, color: '#06AED4' },
      { name: 'Restock China', date: '22 ago', amount: 2400, color: '#7F56D9' },
    ],
    planning: [],
  },
};
