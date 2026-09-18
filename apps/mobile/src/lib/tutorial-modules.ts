export type TutorialLocale = 'es' | 'en';

/** Twelve Cloudinary clips — one per tutorial module. */
export type TutorialVideoKey =
  | 'v1'
  | 'v2'
  | 'v3'
  | 'v4'
  | 'v5'
  | 'v6'
  | 'v7'
  | 'v8'
  | 'v9'
  | 'v10'
  | 'v11'
  | 'v12';

export type TutorialModule = {
  id: string;
  videoKey: TutorialVideoKey;
  title: Record<TutorialLocale, string>;
};

export const TUTORIAL_MODULES: readonly TutorialModule[] = [
  {
    id: 'welcome',
    videoKey: 'v1',
    title: {
      es: 'Bienvenida a Tecno Wallet',
      en: 'Welcome to TecnoWallet',
    },
  },
  {
    id: 'currency-language',
    videoKey: 'v2',
    title: {
      es: 'Configuracion de divisa e idioma',
      en: 'Currency and language settings',
    },
  },
  {
    id: 'ledger-name',
    videoKey: 'v3',
    title: {
      es: 'Como vas a nombrar tu libro contable?',
      en: 'What will you name your ledger book?',
    },
  },
  {
    id: 'expense-envelopes',
    videoKey: 'v4',
    title: {
      es: 'Creando sobres de gastos',
      en: 'Creating expense envelopes',
    },
  },
  {
    id: 'income-envelopes',
    videoKey: 'v5',
    title: {
      es: 'creando sobres de ingresos',
      en: 'Creating income envelopes',
    },
  },
  {
    id: 'bank-accounts',
    videoKey: 'v6',
    title: {
      es: 'Creando cuentas de banco',
      en: 'Creating bank accounts',
    },
  },
  {
    id: 'financial-health',
    videoKey: 'v7',
    title: {
      es: 'Control de nuestra salud financiera',
      en: 'Managing your financial health',
    },
  },
  {
    id: 'monthly-projection',
    videoKey: 'v8',
    title: {
      es: 'Proyeccion mensual',
      en: 'Monthly projection',
    },
  },
  {
    id: 'goals-savings',
    videoKey: 'v9',
    title: {
      es: 'Metas y ahorros',
      en: 'Goals and savings',
    },
  },
  {
    id: 'invites',
    videoKey: 'v10',
    title: {
      es: 'Invitar a personas y aceptar invitaciones',
      en: 'Inviting people and accepting invitations',
    },
  },
  {
    id: 'add-transactions',
    videoKey: 'v11',
    title: {
      es: 'Maneras de agregar ingresos y gastos',
      en: 'Ways to add income and expenses',
    },
  },
  {
    id: 'calendar',
    videoKey: 'v12',
    title: {
      es: 'Calendario',
      en: 'Calendar',
    },
  },
] as const;
