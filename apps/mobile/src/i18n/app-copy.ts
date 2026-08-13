import { useLanguageStore } from '@/store/language';
import type { Locale } from '@/i18n/languages';
import type { FeatureItem } from '@/data/demo';

export type MovementFilterKey = 'all' | 'expenses' | 'income' | 'recurring';

export type AppCopy = {
  tabs: {
    inicio: string;
    sobres: string;
    finanzas: string;
    recaudos: string;
    calendario: string;
    mas: string;
  };
  financeMenu: {
    accounts: string;
    health: string;
    goals: string;
  };
  common: {
    loading: string;
    cancel: string;
    create: string;
    optional: string;
    hide: string;
    show: string;
    viewAll: string;
    personal: string;
    people: (n: number) => string;
    prevMonth: string;
    nextMonth: string;
    currentMonth: string;
    goToCurrentMonth: string;
    notifications: string;
    profile: string;
    inviteTo: (name: string) => string;
    back: string;
    delete: string;
    close: string;
    tryAgain: string;
  };
  ledger: {
    fallback: string;
    sheetTitle: string;
    namePlaceholder: string;
    addBook: string;
    activeA11y: (name: string) => string;
    openHint: string;
    shareA11y: (name: string) => string;
  };
  home: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    totalLiquidity: string;
    incomeMinusExpenses: string;
    liquidityFromAccounts: (count: number) => string;
    toggleBalances: string;
    income: string;
    expenses: string;
    remaining: string;
    registerIncome: string;
    registerExpense: string;
    viewIncomeDetail: string;
    viewExpensesDetail: string;
    availableMonth: (month: string) => string;
    pctAvailable: (pct: number) => string;
    dailySpend: string;
    monthlyBudgetOptional: string;
    noBudget: string;
    noBudgetHint: string;
    configureBudget: string;
    configureBudgetA11y: string;
    budgetNone: string;
    budgetOk: string;
    budgetTight: string;
    budgetLow: string;
    goalMonth: (month: string) => string;
    saveGoal: (amount: string) => string;
    goalProgress: string;
    savedAmount: (amount: string) => string;
    remainingAmount: (amount: string) => string;
    viewGoalA11y: string;
    noGoalTitle: string;
    noGoalHint: string;
    weeklyActivity: string;
    movementsMonth: (month: string) => string;
    filters: Record<MovementFilterKey, string>;
    balanceMonth: (month: string) => string;
    noMovements: (month: string) => string;
    noFiltered: (filter: string, month: string) => string;
    upcomingPayments: string;
    calendar: string;
    noUpcoming: string;
    weekGood: string;
    weekMore: string;
    weekLessBody: (delta: number) => string;
    weekMoreBody: (delta: number) => string;
    liquidityA11y: (amount: string, accountCount: number) => string;
  };
  envelopes: {
    title: string;
    budgetMonth: (month: string) => string;
    availableMonth: (month: string) => string;
    expensesMonth: (month: string) => string;
    noMonthlyBudget: string;
    income: string;
    expenses: string;
    noIncomeGoal: string;
    noBudget: string;
    monthSummary: string;
    controlNoLimit: string;
    noLimit: string;
    incomeEnvelopes: string;
    expenseEnvelopes: string;
    savingsEnvelopes: string;
    badgeIn: string;
    badgeOut: string;
    badgeSave: string;
    createFromGoals: string;
    emptySavings: string;
    received: string;
    saved: string;
    available: string;
    spent: string;
    almostEmpty: string;
    noMonthlyLimit: string;
  };
  collections: {
    title: string;
    subtitle: string;
    activeCount: (n: number) => string;
    sharedPools: string;
    sharedHint: string;
    createFirst: string;
    createFirstHint: string;
    completed: string;
    noNext: string;
    nextContribution: (label: string) => string;
    participants: (n: number) => string;
    collected: string;
    goal: string;
    types: {
      trip: string;
      gift: string;
      event: string;
      purchase: string;
      other: string;
    };
  };
  collectionDetail: {
    notFound: string;
    loading: string;
    back: string;
    goalPrefix: string;
    pctComplete: (pct: number) => string;
    poolAvailable: string;
    poolCollected: string;
    ofTarget: (of: string, left: string) => string;
    inTransit: (amount: string) => string;
    moneyTitle: string;
    available: string;
    transit: string;
    registered: string;
    moneyHint: string;
    progressTitle: string;
    monthlyGoal: string;
    participants: string;
    organizes: string;
    delete: string;
    deleteTitle: string;
    deleteConfirm: string;
    deleteBlockedTitle: string;
    deleteBlockedBody: string;
    deleting: string;
  };
  calendar: {
    myCalendar: string;
    monthView: string;
    goToday: string;
    viewDay: string;
    viewMonth: string;
    selectedDay: string;
    dayAgenda: string;
    emptyDay: string;
    emptyDayHint: string;
    allDay: string;
    birthday: string;
    task: string;
    event: string;
    fallback: string;
    sheetTitle: string;
    namePlaceholder: string;
    addCalendar: string;
    activeA11y: (name: string) => string;
    openHint: string;
    settingsA11y: (name: string) => string;
    onlyYou: string;
    sharedMeta: (n: number) => string;
  };
  notifications: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
    deleteTitle: string;
    deleteConfirm: (n: number) => string;
    deleteSelectedA11y: (n: number) => string;
    selectAll: string;
    allSelected: string;
    deselectAllA11y: string;
    selectAllA11y: string;
    deleteCount: (n: number) => string;
    swipeHint: string;
    delete: string;
    selectItemA11y: (title: string) => string;
    deleteItemA11y: (title: string) => string;
    kindCalendar: string;
    kindIncome: string;
    kindExpense: string;
    kindInvite: string;
    kindRecaudo: string;
    kindGoal: string;
    kindAccount: string;
    kindEnvelope: string;
    kindPlanning: string;
    kindSystem: string;
  };
  profile: {
    title: string;
    subtitle: string;
    changePhotoA11y: string;
    tapToChangePhoto: string;
    removePhoto: string;
    sectionInfo: string;
    sectionSecurity: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    saving: string;
    saveChanges: string;
    currentPassword: string;
    newPassword: string;
    newPasswordPlaceholder: string;
    confirmPassword: string;
    confirmPasswordPlaceholder: string;
    updating: string;
    changePassword: string;
    permissionTitle: string;
    permissionBody: string;
    nameRequiredTitle: string;
    nameRequiredBody: string;
    emailInvalidTitle: string;
    emailInvalidBody: string;
    profileUpdatedTitle: string;
    profileUpdatedBody: string;
    saveFailedTitle: string;
    demoModeTitle: string;
    demoModeBody: string;
    passwordMismatchTitle: string;
    passwordMismatchBody: string;
    passwordUpdatedTitle: string;
    passwordUpdatedBody: string;
    passwordChangeFailedTitle: string;
  };
  paywall: {
    reasons: {
      UPGRADE: { title: string; body: string };
      BOOK_LIMIT: { title: string; body: string };
      ENVELOPE_LIMIT: { title: string; body: string };
      SHARING_REQUIRED: { title: string; body: string };
      AI_REQUIRED: { title: string; body: string };
      SEAT_LIMIT: { title: string; body: string };
    };
    unlockPlus: string;
    unlockBusiness: string;
    upgradeBusinessSeat: string;
    plusBenefits: [string, string, string, string];
    businessBenefits: [string, string, string, string, string];
    subscribeApple: string;
    subscribeBusiness: string;
    viewPlus: string;
    viewBusiness: string;
    pricePerMonth: (price: string) => string;
    priceBeforeConfirm: string;
    restore: string;
    purchaseFailed: string;
    restoreEmpty: string;
    restoreFailed: string;
    legal: string;
    terms: string;
    privacy: string;
  };
  accounts: {
    title: string;
    liquidityMonth: (month: string) => string;
    liquidity: string;
    available: string;
    myAccounts: string;
    empty: string;
    noMovement: string;
    upToDate: string;
  };
  health: {
    title: string;
    netWorth: string;
    netWorthHint: string;
    assets: string;
    debts: string;
    debtWeight: string;
    noDebts: string;
    debtOk: string;
    debtHeavy: string;
    sectionAssets: string;
    sectionDebts: string;
    sectionPlanning: string;
    bills: string;
    subscriptions: string;
    recurring: string;
    recurringCashflow: string;
    emptyRecurringIncome: string;
    emptyRecurringExpense: string;
    badgeDebt: string;
    badgeAsset: string;
    emptyAssets: string;
    planningBlurb: string;
    result: string;
    incomeMinusExpenses: string;
    incomeHint: (n: number) => string;
    expensesHint: (n: number) => string;
    recurringIncome: string;
    recurringExpenses: string;
    tapToAdd: string;
  };
  affiliates: {
    title: string;
    subtitle: string;
    shareLink: string;
    downloads: string;
    registrations: string;
    conversion: string;
    revenueGenerated: string;
    commissionAccrued: string;
    commissionPaid: string;
    pendingPayout: string;
    payoutMethod: string;
    payoutHint: string;
    pending: string;
    configured: string;
    walletAddress: string;
    saving: string;
    saved: string;
    saveMethod: string;
    walletWarning: string;
    referredUsers: string;
    referredEmpty: string;
    tiers: string;
    yourLevel: string;
    how: string;
    until: string;
    businessRequired: string;
    upgradeBusiness: string;
    activate: string;
    activating: string;
  };
  assistant: {
    title: string;
    subtitle: string;
    hero: string;
    heroHint: string;
    bubble: string;
    placeholder: string;
    paidOnly: string;
    needsPlus: string;
    noLedger: string;
    error: string;
  };
  goals: {
    title: string;
    book: (name: string) => string;
    yourGoals: string;
    none: string;
    create: string;
    empty: string;
    completed: string;
    active: string;
    markPending: string;
    markCompleted: string;
  };
  movements: {
    title: string;
    searchPlaceholder: string;
    balanceMonth: (month: string) => string;
    results: string;
    filter: string;
    pending: string;
    empty: string;
    noResults: string;
  };
  cashflow: {
    income: string;
    expenses: string;
    incomeSubtitle: string;
    expensesSubtitle: string;
    totalIn: string;
    totalOut: string;
    emptyIncome: string;
    emptyExpenses: string;
    registerIncome: string;
    registerExpense: string;
    byCategory: string;
    pctOfTotal: string;
    movements: string;
    nMovements: (n: number) => string;
    viewAll: string;
  };
  more: {
    title: string;
    subtitle: string;
    viewProfile: string;
    adminPortal: string;
    adminSubtitle: string;
    languageSheet: string;
    appearanceSheet: string;
    currencySheet: string;
    currencySearch: string;
    signOut: string;
    deleteAccount: string;
    deleteConfirm: string;
    deleteHint: string;
    sendCode: string;
    delete: string;
    cancel: string;
    resendCode: string;
    close: string;
    enabled: string;
    disabled: string;
    groups: {
      data: string;
      plus: string;
      preferences: string;
      support: string;
    };
    items: Record<
      string,
      { title: string; subtitle: string; badge?: string }
    >;
    badges: {
      active: string;
      upgrade: string;
      business: string;
      soon: string;
      includedInBusiness: string;
      subscriptionActive: string;
    };
  };
  appearance: {
    system: string;
    light: string;
    dark: string;
  };
  week: {
    monday: string;
    sunday: string;
  };
};

const es: AppCopy = {
  tabs: {
    inicio: 'Inicio',
    sobres: 'Sobres',
    finanzas: 'Finanzas',
    recaudos: 'Recaudos',
    calendario: 'Calendario',
    mas: 'Más',
  },
  financeMenu: {
    accounts: 'Cuentas',
    health: 'Salud financiera',
    goals: 'Metas/Ahorros',
  },
  common: {
    loading: 'Cargando…',
    cancel: 'Cancelar',
    create: 'Crear',
    optional: 'Opcional',
    hide: 'Ocultar',
    show: 'Mostrar',
    viewAll: 'Ver todos',
    personal: 'Personal',
    people: (n) => `${n} personas`,
    prevMonth: 'Mes anterior',
    nextMonth: 'Mes siguiente',
    currentMonth: 'Mes actual',
    goToCurrentMonth: 'Ir al mes actual',
    notifications: 'Notificaciones',
    profile: 'Perfil',
    inviteTo: (name) => `Invitar a ${name}`,
    back: 'Volver',
    delete: 'Eliminar',
    close: 'Cerrar',
    tryAgain: 'Inténtalo de nuevo.',
  },
  ledger: {
    fallback: 'Libro',
    sheetTitle: 'LIBROS DE CONTABILIDAD',
    namePlaceholder: 'Nombre del libro',
    addBook: '+ Añadir Libro',
    activeA11y: (name) => `Libro activo ${name}. Cambiar libro`,
    openHint: 'Abre la lista de libros',
    shareA11y: (name) => `Compartir ${name}`,
  },
  home: {
    greetingMorning: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    totalLiquidity: 'Liquidez total',
    incomeMinusExpenses: 'Ingresos − gastos',
    liquidityFromAccounts: (count) =>
      count === 1 ? '1 cuenta líquida' : `${count} cuentas líquidas`,
    toggleBalances: 'Mostrar u ocultar saldos',
    income: 'Ingresos',
    expenses: 'Gastos',
    remaining: 'Restante',
    registerIncome: 'Registra un ingreso',
    registerExpense: 'Registra un gasto',
    viewIncomeDetail: 'Ver detalle de ingresos',
    viewExpensesDetail: 'Ver detalle de gastos',
    availableMonth: (month) => `Disponible · ${month}`,
    pctAvailable: (pct) => `${pct}% disponible`,
    dailySpend: 'Puedes gastar por día',
    monthlyBudgetOptional: 'Presupuesto mensual · Opcional',
    noBudget: 'Sin presupuesto',
    noBudgetHint: 'Puedes registrar y controlar gastos sin establecer un límite.',
    configureBudget: 'Configurar presupuesto',
    configureBudgetA11y: 'Sin presupuesto mensual. Configurar presupuesto opcional',
    budgetNone: 'Sin presupuesto mensual',
    budgetOk: 'Tu presupuesto va bien',
    budgetTight: 'Vas justo este mes',
    budgetLow: 'Presupuesto casi agotado',
    goalMonth: (month) => `Meta · ${month}`,
    saveGoal: (amount) => `Ahorrar ${amount}`,
    goalProgress: 'Progreso de meta mensual',
    savedAmount: (amount) => `${amount} ahorrados`,
    remainingAmount: (amount) => `Faltan ${amount}`,
    viewGoalA11y: 'Ver detalle de la meta',
    noGoalTitle: 'Sin meta en este libro',
    noGoalHint: 'Cuando definas una meta, verás el progreso aquí.',
    weeklyActivity: 'Actividad semanal',
    movementsMonth: (month) => `Movimientos · ${month}`,
    filters: {
      all: 'Todos',
      expenses: 'Gastos',
      income: 'Ingresos',
      recurring: 'Recurrentes',
    },
    balanceMonth: (month) => `Balance · ${month}`,
    noMovements: (month) => `No hay movimientos en ${month}.`,
    noFiltered: (filter, month) => `No hay ${filter.toLowerCase()} en ${month}.`,
    upcomingPayments: 'Próximos pagos',
    calendar: 'Calendario',
    noUpcoming: 'No hay pagos próximos en este libro.',
    weekGood: 'Buen ritmo esta semana',
    weekMore: 'Esta semana gastaste más',
    weekLessBody: (delta) => `Gastaste ${delta}% menos. Mantén el rumbo.`,
    weekMoreBody: (delta) => `Gastaste ${delta}% más que la semana anterior.`,
    liquidityA11y: (amount, accountCount) =>
      `Liquidez total ${amount}. ${accountCount} cuenta${accountCount === 1 ? '' : 's'} líquida${accountCount === 1 ? '' : 's'}`,
  },
  envelopes: {
    title: 'Sobres',
    budgetMonth: (month) => `Presupuesto · ${month}`,
    availableMonth: (month) => `Disponible · ${month}`,
    expensesMonth: (month) => `Gastos · ${month}`,
    noMonthlyBudget: 'Sin presupuesto mensual',
    income: 'Ingresos',
    expenses: 'Gastos',
    noIncomeGoal: 'Sin meta de ingresos',
    noBudget: 'Sin presupuesto',
    monthSummary: 'Resumen del mes',
    controlNoLimit: 'Control sin límite mensual',
    noLimit: 'Sin límite',
    incomeEnvelopes: 'Sobres de ingresos',
    expenseEnvelopes: 'Sobres de gastos',
    savingsEnvelopes: 'Sobres de ahorros',
    badgeIn: 'Entradas',
    badgeOut: 'Salidas',
    badgeSave: 'Ahorro',
    createFromGoals: 'Créalos desde Metas/Ahorros',
    emptySavings: 'Crea sobres de ahorro desde Finanzas → Metas/Ahorros.',
    received: 'recibido',
    saved: 'ahorrado',
    available: 'disponible',
    spent: 'gastado',
    almostEmpty: 'Casi agotado',
    noMonthlyLimit: 'Sin límite mensual',
  },
  collections: {
    title: 'Mis recaudos',
    subtitle: 'Organiza aportes compartidos',
    activeCount: (n) => `${n} recaudo${n === 1 ? '' : 's'} activo${n === 1 ? '' : 's'}`,
    sharedPools: 'Pozos compartidos',
    sharedHint: 'Sigue el progreso de cada pozo',
    createFirst: 'Crea tu primer recaudo',
    createFirstHint:
      'Crea un fondo con tus amigos para ir de viaje, o con tus hermanos para ayudar a tus padres, etc.\n\nDefine el presupuesto o meta a retirar al final del recaudo.\nDefine el aporte mensual que tendrá cada integrante.\n\nTecnoWallet creará una cuenta digital a nombre del organizador, donde mensualmente —con aportes manuales o débitos automáticos— los integrantes irán aportando al fondo hasta completar la meta y retirar los fondos.',
    completed: 'Completado',
    noNext: 'Sin próximo aporte',
    nextContribution: (label) => `Próximo aporte · ${label}`,
    participants: (n) => `${n} participante${n === 1 ? '' : 's'}`,
    collected: 'Recaudado',
    goal: 'Objetivo',
    types: {
      trip: 'Viaje',
      gift: 'Regalo',
      event: 'Evento',
      purchase: 'Compra',
      other: 'Otro',
    },
  },
  collectionDetail: {
    notFound: 'Recaudo no encontrado',
    loading: 'Cargando recaudo…',
    back: 'Volver',
    goalPrefix: 'Meta',
    pctComplete: (pct) => `${pct}% completado`,
    poolAvailable: 'Pozo disponible',
    poolCollected: 'Pozo recaudado',
    ofTarget: (of, left) => `de ${of} · faltan ${left}`,
    inTransit: (amount) => ` · ${amount} en tránsito`,
    moneyTitle: 'Dinero del recaudo',
    available: 'Disponible',
    transit: 'En tránsito',
    registered: 'Registrado',
    moneyHint:
      'Solo lo disponible (confirmado por Unit) se puede retirar a tu cuenta. Los registros manuales no mueven dinero bancario.',
    progressTitle: 'Progreso del recaudo',
    monthlyGoal: 'Meta mensual',
    participants: 'Participantes',
    organizes: 'Organiza',
    delete: 'Eliminar recaudo',
    deleteTitle: 'Eliminar recaudo',
    deleteConfirm:
      '¿Seguro que quieres eliminar este recaudo? Esta acción no se puede deshacer.',
    deleteBlockedTitle: 'Primero retira el dinero',
    deleteBlockedBody:
      'El pozo todavía tiene fondos. Retira todo el dinero hasta dejar el recaudo en 0 y luego podrás eliminarlo.',
    deleting: 'Eliminando…',
  },
  calendar: {
    myCalendar: 'Mi calendario',
    monthView: 'Vista mensual',
    goToday: 'Ir a hoy',
    viewDay: 'Ver día',
    viewMonth: 'Ver mes',
    selectedDay: 'Del día seleccionado',
    dayAgenda: 'Agenda del día',
    emptyDay: 'Sin entradas este día',
    emptyDayHint: 'Toca + para agregar un evento, tarea o cumpleaños.',
    allDay: 'Todo el día',
    birthday: 'Cumpleaños',
    task: 'Tarea',
    event: 'Evento',
    fallback: 'Calendario',
    sheetTitle: 'CALENDARIOS',
    namePlaceholder: 'Ej. Calendario de Ana',
    addCalendar: '+ Añadir calendario',
    activeA11y: (name) => `Calendario activo ${name}. Cambiar calendario`,
    openHint: 'Abre la lista de calendarios',
    settingsA11y: (name) => `Ajustes de ${name}`,
    onlyYou: 'Solo tú',
    sharedMeta: (n) => `${n} personas · compartido`,
  },
  notifications: {
    title: 'Notificaciones',
    subtitle: 'Calendario y actividad del equipo',
    emptyTitle: 'Sin novedades',
    emptyBody:
      'Aquí verás eventos del calendario e ingresos o gastos que registre tu equipo en libros compartidos.',
    deleteTitle: 'Eliminar notificaciones',
    deleteConfirm: (n) =>
      `¿Eliminar ${n} notificación${n === 1 ? '' : 'es'}?`,
    deleteSelectedA11y: (n) => `Eliminar ${n} seleccionadas`,
    selectAll: 'Seleccionar todas',
    allSelected: 'Todas seleccionadas',
    deselectAllA11y: 'Deseleccionar todas',
    selectAllA11y: 'Seleccionar todas',
    deleteCount: (n) => `Eliminar (${n})`,
    swipeHint: 'Desliza para borrar',
    delete: 'Eliminar',
    selectItemA11y: (title) => `Seleccionar ${title}`,
    deleteItemA11y: (title) => `Eliminar ${title}`,
    kindCalendar: 'Calendario',
    kindIncome: 'Ingreso',
    kindExpense: 'Gasto',
    kindInvite: 'Acceso',
    kindRecaudo: 'Recaudo',
    kindGoal: 'Meta',
    kindAccount: 'Cuenta',
    kindEnvelope: 'Sobre',
    kindPlanning: 'Plan',
    kindSystem: 'Aviso',
  },
  profile: {
    title: 'Tu perfil',
    subtitle: 'Datos de la cuenta',
    changePhotoA11y: 'Cambiar foto de perfil',
    tapToChangePhoto: 'Toca para cambiar la foto',
    removePhoto: 'Quitar foto',
    sectionInfo: 'Información',
    sectionSecurity: 'Seguridad',
    name: 'Nombre',
    namePlaceholder: 'Tu nombre',
    email: 'Correo registrado',
    emailPlaceholder: 'correo@ejemplo.com',
    saving: 'Guardando…',
    saveChanges: 'Guardar cambios',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    newPasswordPlaceholder: 'Mínimo 6 caracteres',
    confirmPassword: 'Confirmar nueva contraseña',
    confirmPasswordPlaceholder: 'Repite la nueva contraseña',
    updating: 'Actualizando…',
    changePassword: 'Cambiar contraseña',
    permissionTitle: 'Permiso necesario',
    permissionBody: 'Activa el acceso a fotos para cambiar tu imagen de perfil.',
    nameRequiredTitle: 'Nombre requerido',
    nameRequiredBody: 'Escribe cómo quieres que te llamemos.',
    emailInvalidTitle: 'Correo inválido',
    emailInvalidBody: 'Revisa el correo registrado.',
    profileUpdatedTitle: 'Perfil actualizado',
    profileUpdatedBody: 'Tus datos se guardaron en tu cuenta.',
    saveFailedTitle: 'No se pudo guardar',
    demoModeTitle: 'Modo demo',
    demoModeBody: 'Inicia sesión con una cuenta real para cambiar la contraseña.',
    passwordMismatchTitle: 'No coinciden',
    passwordMismatchBody: 'La confirmación de la nueva contraseña no coincide.',
    passwordUpdatedTitle: 'Contraseña actualizada',
    passwordUpdatedBody: 'Usa la nueva contraseña en tu próximo acceso.',
    passwordChangeFailedTitle: 'No se pudo cambiar',
  },
  paywall: {
    reasons: {
      UPGRADE: {
        title: 'Desbloquea tu plan',
        body: 'Organiza más, comparte con tu gente y recibe respuestas inteligentes sobre tu dinero.',
      },
      BOOK_LIMIT: {
        title: 'Haz espacio para todos tus proyectos',
        body: 'Tu plan gratis incluye un libro. Con un plan de pago puedes separar hogar, negocio, viajes y más.',
      },
      ENVELOPE_LIMIT: {
        title: 'Tu presupuesto puede crecer contigo',
        body: 'Ya usaste los 5 sobres gratuitos de esta sección. Con Plus o Business puedes crear todos los que necesites.',
      },
      SHARING_REQUIRED: {
        title: 'Las finanzas funcionan mejor en equipo',
        body: 'Invita colaboradores a tus libros y calendarios con acceso controlado.',
      },
      AI_REQUIRED: {
        title: 'Convierte tus movimientos en respuestas',
        body: 'Pregunta cuánto gastaste, dónde se fue tu dinero y cómo avanzan tus metas.',
      },
      SEAT_LIMIT: {
        title: 'Tu equipo necesita más cupos',
        body: 'TecnoWallet+ incluye 5 colaboradores. Business abre hasta 10 cupos únicos.',
      },
    },
    unlockPlus: 'Desbloquea TecnoWallet+',
    unlockBusiness: 'Desbloquea TecnoWallet Business',
    upgradeBusinessSeat: 'Pasa a TecnoWallet Business',
    plusBenefits: [
      'Asistente IA financiero',
      'Libros y sobres sin límites Free',
      'Hasta 5 colaboradores',
      'Libros y calendarios compartidos',
    ],
    businessBenefits: [
      'Todo lo de TecnoWallet+',
      'Hasta 10 colaboradores',
      'Aplicas al programa de afiliados',
      'Asistente IA financiero',
      'Libros y calendarios compartidos',
    ],
    subscribeApple: 'Suscribirme con Apple',
    subscribeBusiness: 'Suscribirme a Business',
    viewPlus: 'Ver TecnoWallet+',
    viewBusiness: 'Ver TecnoWallet Business',
    pricePerMonth: (price) => `${price} al mes`,
    priceBeforeConfirm: 'Precio mostrado antes de confirmar',
    restore: 'Restaurar compras',
    purchaseFailed: 'No pudimos completar la compra.',
    restoreEmpty: 'No encontramos una suscripción activa para restaurar.',
    restoreFailed: 'No pudimos restaurar tus compras.',
    legal:
      'La suscripción se renueva automáticamente hasta que la canceles. El cobro se realiza con tu cuenta de Apple.',
    terms: 'Términos',
    privacy: 'Privacidad',
  },
  accounts: {
    title: 'Cuentas',
    liquidityMonth: (month) => `Liquidez · ${month}`,
    liquidity: 'Liquidez',
    available: 'Disponible',
    myAccounts: 'Mis cuentas',
    empty: 'Este libro no tiene cuentas líquidas todavía.',
    noMovement: 'Sin movimiento',
    upToDate: 'Al día',
  },
  health: {
    title: 'Salud financiera',
    netWorth: 'Patrimonio',
    netWorthHint: 'Liquidez + bienes − deudas',
    assets: 'Bienes',
    debts: 'Deudas',
    debtWeight: 'Peso de la deuda',
    noDebts: 'Sin deudas registradas.',
    debtOk: 'Bien. La deuda está bajo control.',
    debtHeavy: 'La deuda pesa más que tus activos líquidos.',
    sectionAssets: 'ACTIVOS',
    sectionDebts: 'DEUDAS',
    sectionPlanning: 'PLANIFICACIÓN',
    bills: 'Facturas',
    subscriptions: 'Suscripciones',
    recurring: 'Recurrentes',
    recurringCashflow: 'Ingresos/Gastos recurrentes',
    emptyRecurringIncome: 'Sin ingresos recurrentes',
    emptyRecurringExpense: 'Sin gastos recurrentes',
    badgeDebt: 'Deuda',
    badgeAsset: 'Activo',
    emptyAssets: 'Sin bienes registrados. Usa + para agregar una casa u otro activo.',
    planningBlurb:
      'Analiza y proyecta todos tus gastos mensuales en cada categoría —por ejemplo, en Hogar: suscripciones, hipoteca, arriendo y más— para entender cómo se encuentra tu salud financiera cada mes.',
    result: 'Resultado',
    incomeMinusExpenses: 'ingresos − gastos',
    incomeHint: (n) => `${n} · salario y otros`,
    expensesHint: (n) => `${n} · facturas y más`,
    recurringIncome: 'Ingresos recurrentes',
    recurringExpenses: 'Gastos recurrentes',
    tapToAdd: 'Toca para agregar',
  },
  affiliates: {
    title: 'Afiliados',
    subtitle: 'Tu enlace y comisiones',
    shareLink: 'Compartir enlace',
    downloads: 'Descargas',
    registrations: 'Registros',
    conversion: 'Conversión',
    revenueGenerated: 'Ingresos generados',
    commissionAccrued: 'Comisión acumulada',
    commissionPaid: 'Comisión pagada',
    pendingPayout: 'Pendiente de pago',
    payoutMethod: 'Método de pago',
    payoutHint:
      'Wallet (cripto) USDT. Elige la red e indica la dirección donde recibirás tus comisiones.',
    pending: 'Pendiente',
    configured: 'Configurado',
    walletAddress: 'DIRECCIÓN DE WALLET',
    saving: 'Guardando…',
    saved: 'Método guardado',
    saveMethod: 'Guardar método de pago',
    walletWarning:
      'Usa solo una wallet que controle tú. Un error de red o dirección puede hacer que el pago no llegue.',
    referredUsers: 'Usuarios referidos',
    referredEmpty:
      'Aún no hay registros con tu enlace o código. Comparte tu link para empezar.',
    tiers: 'Niveles',
    yourLevel: 'Tu nivel',
    how: 'Cómo:',
    until: 'Hasta cuándo:',
    businessRequired: 'Programa para Business',
    upgradeBusiness: 'Pasarme a TecnoWallet Business',
    activate: 'Activar programa',
    activating: 'Activando…',
  },
  assistant: {
    title: 'Asistente IA',
    subtitle: 'Análisis privado de tus finanzas',
    hero: 'Pregunta lo que quieras sobre tu dinero',
    heroHint:
      'Los cálculos los hace TecnoWallet. La IA no recibe tu historial completo ni mueve dinero.',
    bubble:
      'Pregunta por categorías, totales del mes, saldos o metas. TecnoWallet calcula los números; la IA solo interpreta y responde.',
    placeholder: '¿En qué gasté más?',
    paidOnly: 'Incluido en planes de pago',
    needsPlus: 'El asistente necesita TecnoWallet+ o Business.',
    noLedger: 'No hay un libro activo.',
    error: 'No pudimos consultar al asistente.',
  },
  goals: {
    title: 'Metas/Ahorros',
    book: (name) => `Libro ${name}`,
    yourGoals: 'Tus objetivos',
    none: 'Sin metas',
    create: 'Crear meta',
    empty: 'Aún no hay metas en este libro.',
    completed: 'Completada',
    active: 'Activa',
    markPending: 'Marcar pendiente',
    markCompleted: 'Marcar completada',
  },
  movements: {
    title: 'Movimientos',
    searchPlaceholder: 'Buscar comercio, categoría…',
    balanceMonth: (month) => `Balance · ${month}`,
    results: 'Resultados',
    filter: 'Filtrar',
    pending: 'Pendiente',
    empty: 'Sin movimientos',
    noResults: 'Sin resultados',
  },
  cashflow: {
    income: 'Ingresos',
    expenses: 'Gastos',
    incomeSubtitle: 'Entradas de este mes',
    expensesSubtitle: 'Salidas de este mes',
    totalIn: 'Total ingresado',
    totalOut: 'Total gastado',
    emptyIncome: 'Sin ingresos este mes',
    emptyExpenses: 'Sin gastos este mes',
    registerIncome: 'Registrar ingreso',
    registerExpense: 'Registrar gasto',
    byCategory: 'Por categoría',
    pctOfTotal: '% del total',
    movements: 'Movimientos',
    nMovements: (n) => `${n} movimientos`,
    viewAll: 'Ver todos los movimientos',
  },
  more: {
    title: 'Más',
    subtitle: 'Herramientas y preferencias',
    viewProfile: 'Ver perfil',
    adminPortal: 'Portal admin',
    adminSubtitle: 'Usuarios, afiliados y upgrades',
    languageSheet: 'Idioma',
    appearanceSheet: 'Apariencia',
    currencySheet: 'Divisa',
    currencySearch: 'Buscar moneda',
    signOut: 'Cerrar sesión',
    deleteAccount: 'Eliminar cuenta',
    deleteConfirm: 'Esto borra tu cuenta y datos de forma permanente.',
    deleteHint: 'Te enviamos un código a tu correo para confirmar.',
    sendCode: 'Enviar código',
    delete: 'Eliminar',
    cancel: 'Cancelar',
    resendCode: 'Reenviar código',
    close: 'Cerrar',
    enabled: 'Activado',
    disabled: 'Desactivado',
    groups: {
      data: 'Datos y utilidades',
      plus: 'TecnoWallet+',
      preferences: 'Preferencias',
      support: 'Soporte',
    },
    items: {
      divisa: { title: 'Divisa', subtitle: 'Moneda del libro activo' },
      idioma: { title: 'Idioma', subtitle: 'Español' },
      bancos: {
        title: 'Cuentas bancarias',
        subtitle: 'Próximamente',
        badge: 'Pronto',
      },
      datos: {
        title: 'Exportar',
        subtitle: 'Descarga tus movimientos en CSV',
      },
      sonido: {
        title: 'Sonido y haptics',
        subtitle: 'Feedback al tocar y registrar',
      },
      apariencia: { title: 'Apariencia', subtitle: 'Automático · sistema' },
      'upgrade-plus': {
        title: 'Pasarme a TecnoWallet+',
        subtitle: 'Libros, sobres, IA y 5 colaboradores',
      },
      'upgrade-business': {
        title: 'Pasarme a TecnoWallet Business',
        subtitle: 'Todo Plus + hasta 10 colaboradores',
      },
      afiliados: {
        title: 'Afiliados',
        subtitle: 'Requiere TecnoWallet Business',
      },
      asistente: {
        title: 'Asistente IA',
        subtitle: 'Pregunta sobre tus finanzas',
      },
      recordatorios: {
        title: 'Recordatorios',
        subtitle: 'Pagos, metas y calendario',
      },
      seguridad: {
        title: 'Face ID / Biometría',
        subtitle: 'Pedir desbloqueo al abrir',
      },
      ajustes: {
        title: 'Más ajustes',
        subtitle: 'Semana y opciones avanzadas',
      },
      valorar: {
        title: 'Valorar TecnoWallet',
        subtitle: 'Ayúdanos con tu opinión',
      },
      faq: {
        title: 'Preguntas frecuentes',
        subtitle: 'Guías y respuestas rápidas',
      },
      contacto: {
        title: 'Contáctanos',
        subtitle: 'dev@wwtecno.com',
      },
    },
    badges: {
      active: 'Activo',
      upgrade: 'Upgrade',
      business: 'Business',
      soon: 'Pronto',
      includedInBusiness: 'Incluido en Business',
      subscriptionActive: 'Suscripción activa',
    },
  },
  appearance: {
    system: 'Automático · sistema',
    light: 'Claro',
    dark: 'Oscuro',
  },
  week: {
    monday: 'Lunes',
    sunday: 'Domingo',
  },
};

const en: AppCopy = {
  tabs: {
    inicio: 'Home',
    sobres: 'Envelopes',
    finanzas: 'Finance',
    recaudos: 'Collections',
    calendario: 'Calendar',
    mas: 'More',
  },
  financeMenu: {
    accounts: 'Accounts',
    health: 'Financial health',
    goals: 'Goals/Savings',
  },
  common: {
    loading: 'Loading…',
    cancel: 'Cancel',
    create: 'Create',
    optional: 'Optional',
    hide: 'Hide',
    show: 'Show',
    viewAll: 'See all',
    personal: 'Personal',
    people: (n) => `${n} people`,
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    currentMonth: 'Current month',
    goToCurrentMonth: 'Go to current month',
    notifications: 'Notifications',
    profile: 'Profile',
    inviteTo: (name) => `Invite to ${name}`,
    back: 'Back',
    delete: 'Delete',
    close: 'Close',
    tryAgain: 'Please try again.',
  },
  ledger: {
    fallback: 'Book',
    sheetTitle: 'LEDGERS',
    namePlaceholder: 'Book name',
    addBook: '+ Add book',
    activeA11y: (name) => `Active book ${name}. Change book`,
    openHint: 'Opens the list of books',
    shareA11y: (name) => `Share ${name}`,
  },
  home: {
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    totalLiquidity: 'Total liquidity',
    incomeMinusExpenses: 'Income − expenses',
    liquidityFromAccounts: (count) =>
      count === 1 ? '1 liquid account' : `${count} liquid accounts`,
    toggleBalances: 'Show or hide balances',
    income: 'Income',
    expenses: 'Expenses',
    remaining: 'Remaining',
    registerIncome: 'Record an income',
    registerExpense: 'Record an expense',
    viewIncomeDetail: 'View income detail',
    viewExpensesDetail: 'View expenses detail',
    availableMonth: (month) => `Available · ${month}`,
    pctAvailable: (pct) => `${pct}% available`,
    dailySpend: 'You can spend per day',
    monthlyBudgetOptional: 'Monthly budget · Optional',
    noBudget: 'No budget',
    noBudgetHint: 'You can track spending without setting a limit.',
    configureBudget: 'Set up budget',
    configureBudgetA11y: 'No monthly budget. Set up an optional budget',
    budgetNone: 'No monthly budget',
    budgetOk: 'Your budget looks good',
    budgetTight: 'Running tight this month',
    budgetLow: 'Budget almost used up',
    goalMonth: (month) => `Goal · ${month}`,
    saveGoal: (amount) => `Save ${amount}`,
    goalProgress: 'Monthly goal progress',
    savedAmount: (amount) => `${amount} saved`,
    remainingAmount: (amount) => `${amount} left`,
    viewGoalA11y: 'View goal detail',
    noGoalTitle: 'No goal in this book',
    noGoalHint: 'When you set a goal, you’ll see progress here.',
    weeklyActivity: 'Weekly activity',
    movementsMonth: (month) => `Activity · ${month}`,
    filters: {
      all: 'All',
      expenses: 'Expenses',
      income: 'Income',
      recurring: 'Recurring',
    },
    balanceMonth: (month) => `Balance · ${month}`,
    noMovements: (month) => `No activity in ${month}.`,
    noFiltered: (filter, month) => `No ${filter.toLowerCase()} in ${month}.`,
    upcomingPayments: 'Upcoming payments',
    calendar: 'Calendar',
    noUpcoming: 'No upcoming payments in this book.',
    weekGood: 'Nice pace this week',
    weekMore: 'You spent more this week',
    weekLessBody: (delta) => `You spent ${delta}% less. Keep it up.`,
    weekMoreBody: (delta) => `You spent ${delta}% more than last week.`,
    liquidityA11y: (amount, accountCount) =>
      `Total liquidity ${amount}. ${accountCount} liquid account${accountCount === 1 ? '' : 's'}`,
  },
  envelopes: {
    title: 'Envelopes',
    budgetMonth: (month) => `Budget · ${month}`,
    availableMonth: (month) => `Available · ${month}`,
    expensesMonth: (month) => `Expenses · ${month}`,
    noMonthlyBudget: 'No monthly budget',
    income: 'Income',
    expenses: 'Expenses',
    noIncomeGoal: 'No income goal',
    noBudget: 'No budget',
    monthSummary: 'Month summary',
    controlNoLimit: 'Tracking without a monthly limit',
    noLimit: 'No limit',
    incomeEnvelopes: 'Income envelopes',
    expenseEnvelopes: 'Expense envelopes',
    savingsEnvelopes: 'Savings envelopes',
    badgeIn: 'Inflows',
    badgeOut: 'Outflows',
    badgeSave: 'Savings',
    createFromGoals: 'Create them from Goals/Savings',
    emptySavings: 'Create savings envelopes from Finance → Goals/Savings.',
    received: 'received',
    saved: 'saved',
    available: 'available',
    spent: 'spent',
    almostEmpty: 'Almost empty',
    noMonthlyLimit: 'No monthly limit',
  },
  collections: {
    title: 'My collections',
    subtitle: 'Organize shared contributions',
    activeCount: (n) => `${n} active collection${n === 1 ? '' : 's'}`,
    sharedPools: 'Shared pools',
    sharedHint: 'Track progress for each pool',
    createFirst: 'Create your first collection',
    createFirstHint:
      'Start a fund with friends for a trip, or with siblings to help your parents, etc.\n\nSet the final budget or goal for the collection.\nSet the monthly contribution for each member.\n\nTecnoWallet creates a digital account in the organizer’s name, where members contribute monthly —manually or via automatic debits— until you reach the goal and withdraw the funds.',
    completed: 'Completed',
    noNext: 'No next contribution',
    nextContribution: (label) => `Next contribution · ${label}`,
    participants: (n) => `${n} participant${n === 1 ? '' : 's'}`,
    collected: 'Collected',
    goal: 'Goal',
    types: {
      trip: 'Trip',
      gift: 'Gift',
      event: 'Event',
      purchase: 'Purchase',
      other: 'Other',
    },
  },
  collectionDetail: {
    notFound: 'Collection not found',
    loading: 'Loading collection…',
    back: 'Back',
    goalPrefix: 'Goal',
    pctComplete: (pct) => `${pct}% complete`,
    poolAvailable: 'Available pool',
    poolCollected: 'Collected pool',
    ofTarget: (of, left) => `of ${of} · ${left} left`,
    inTransit: (amount) => ` · ${amount} in transit`,
    moneyTitle: 'Collection funds',
    available: 'Available',
    transit: 'In transit',
    registered: 'Recorded',
    moneyHint:
      'Only available funds (confirmed by Unit) can be withdrawn to your account. Manual records do not move bank money.',
    progressTitle: 'Collection progress',
    monthlyGoal: 'Monthly goal',
    participants: 'Participants',
    organizes: 'Organizes',
    delete: 'Delete collection',
    deleteTitle: 'Delete collection',
    deleteConfirm:
      'Are you sure you want to delete this collection? This cannot be undone.',
    deleteBlockedTitle: 'Withdraw funds first',
    deleteBlockedBody:
      'This pot still has funds. Withdraw everything until the balance is 0, then you can delete it.',
    deleting: 'Deleting…',
  },
  calendar: {
    myCalendar: 'My calendar',
    monthView: 'Month view',
    goToday: 'Go to today',
    viewDay: 'Day view',
    viewMonth: 'Month view',
    selectedDay: 'Selected day',
    dayAgenda: 'Day agenda',
    emptyDay: 'No entries this day',
    emptyDayHint: 'Tap + to add an event, task, or birthday.',
    allDay: 'All day',
    birthday: 'Birthday',
    task: 'Task',
    event: 'Event',
    fallback: 'Calendar',
    sheetTitle: 'CALENDARS',
    namePlaceholder: 'e.g. Ana’s calendar',
    addCalendar: '+ Add calendar',
    activeA11y: (name) => `Active calendar ${name}. Change calendar`,
    openHint: 'Opens the list of calendars',
    settingsA11y: (name) => `Settings for ${name}`,
    onlyYou: 'Only you',
    sharedMeta: (n) => `${n} people · shared`,
  },
  notifications: {
    title: 'Notifications',
    subtitle: 'Calendar and team activity',
    emptyTitle: 'You’re all caught up',
    emptyBody:
      'You’ll see calendar events and income or expenses your team logs in shared books.',
    deleteTitle: 'Delete notifications',
    deleteConfirm: (n) => `Delete ${n} notification${n === 1 ? '' : 's'}?`,
    deleteSelectedA11y: (n) => `Delete ${n} selected`,
    selectAll: 'Select all',
    allSelected: 'All selected',
    deselectAllA11y: 'Deselect all',
    selectAllA11y: 'Select all',
    deleteCount: (n) => `Delete (${n})`,
    swipeHint: 'Swipe to delete',
    delete: 'Delete',
    selectItemA11y: (title) => `Select ${title}`,
    deleteItemA11y: (title) => `Delete ${title}`,
    kindCalendar: 'Calendar',
    kindIncome: 'Income',
    kindExpense: 'Expense',
    kindInvite: 'Access',
    kindRecaudo: 'Pool',
    kindGoal: 'Goal',
    kindAccount: 'Account',
    kindEnvelope: 'Envelope',
    kindPlanning: 'Plan',
    kindSystem: 'Notice',
  },
  profile: {
    title: 'Your profile',
    subtitle: 'Account details',
    changePhotoA11y: 'Change profile photo',
    tapToChangePhoto: 'Tap to change photo',
    removePhoto: 'Remove photo',
    sectionInfo: 'Information',
    sectionSecurity: 'Security',
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Registered email',
    emailPlaceholder: 'email@example.com',
    saving: 'Saving…',
    saveChanges: 'Save changes',
    currentPassword: 'Current password',
    newPassword: 'New password',
    newPasswordPlaceholder: 'At least 6 characters',
    confirmPassword: 'Confirm new password',
    confirmPasswordPlaceholder: 'Repeat the new password',
    updating: 'Updating…',
    changePassword: 'Change password',
    permissionTitle: 'Permission needed',
    permissionBody: 'Allow photo access to change your profile picture.',
    nameRequiredTitle: 'Name required',
    nameRequiredBody: 'Enter how you’d like us to call you.',
    emailInvalidTitle: 'Invalid email',
    emailInvalidBody: 'Check the registered email.',
    profileUpdatedTitle: 'Profile updated',
    profileUpdatedBody: 'Your details were saved to your account.',
    saveFailedTitle: 'Couldn’t save',
    demoModeTitle: 'Demo mode',
    demoModeBody: 'Sign in with a real account to change your password.',
    passwordMismatchTitle: 'Don’t match',
    passwordMismatchBody: 'The new password confirmation doesn’t match.',
    passwordUpdatedTitle: 'Password updated',
    passwordUpdatedBody: 'Use the new password next time you sign in.',
    passwordChangeFailedTitle: 'Couldn’t change password',
  },
  paywall: {
    reasons: {
      UPGRADE: {
        title: 'Unlock your plan',
        body: 'Organize more, share with your people, and get smart answers about your money.',
      },
      BOOK_LIMIT: {
        title: 'Make room for all your projects',
        body: 'Your free plan includes one book. With a paid plan you can separate home, business, trips, and more.',
      },
      ENVELOPE_LIMIT: {
        title: 'Let your budget grow with you',
        body: 'You’ve used the 5 free envelopes in this section. With Plus or Business you can create as many as you need.',
      },
      SHARING_REQUIRED: {
        title: 'Money works better as a team',
        body: 'Invite collaborators to your books and calendars with controlled access.',
      },
      AI_REQUIRED: {
        title: 'Turn activity into answers',
        body: 'Ask how much you spent, where money went, and how your goals are progressing.',
      },
      SEAT_LIMIT: {
        title: 'Your team needs more seats',
        body: 'TecnoWallet+ includes 5 collaborators. Business opens up to 10 unique seats.',
      },
    },
    unlockPlus: 'Unlock TecnoWallet+',
    unlockBusiness: 'Unlock TecnoWallet Business',
    upgradeBusinessSeat: 'Upgrade to TecnoWallet Business',
    plusBenefits: [
      'Financial AI assistant',
      'Books and envelopes beyond Free limits',
      'Up to 5 collaborators',
      'Shared books and calendars',
    ],
    businessBenefits: [
      'Everything in TecnoWallet+',
      'Up to 10 collaborators',
      'Eligible for the affiliate program',
      'Financial AI assistant',
      'Shared books and calendars',
    ],
    subscribeApple: 'Subscribe with Apple',
    subscribeBusiness: 'Subscribe to Business',
    viewPlus: 'View TecnoWallet+',
    viewBusiness: 'View TecnoWallet Business',
    pricePerMonth: (price) => `${price} / month`,
    priceBeforeConfirm: 'Price shown before you confirm',
    restore: 'Restore purchases',
    purchaseFailed: 'We couldn’t complete the purchase.',
    restoreEmpty: 'We couldn’t find an active subscription to restore.',
    restoreFailed: 'We couldn’t restore your purchases.',
    legal:
      'The subscription renews automatically until you cancel. You’re charged through your Apple account.',
    terms: 'Terms',
    privacy: 'Privacy',
  },
  accounts: {
    title: 'Accounts',
    liquidityMonth: (month) => `Liquidity · ${month}`,
    liquidity: 'Liquidity',
    available: 'Available',
    myAccounts: 'My accounts',
    empty: 'This book has no liquid accounts yet.',
    noMovement: 'No activity',
    upToDate: 'Up to date',
  },
  health: {
    title: 'Financial health',
    netWorth: 'Net worth',
    netWorthHint: 'Liquidity + assets − debts',
    assets: 'Assets',
    debts: 'Debts',
    debtWeight: 'Debt weight',
    noDebts: 'No debts recorded.',
    debtOk: 'Good. Debt is under control.',
    debtHeavy: 'Debt weighs more than your liquid assets.',
    sectionAssets: 'ASSETS',
    sectionDebts: 'DEBTS',
    sectionPlanning: 'PLANNING',
    bills: 'Bills',
    subscriptions: 'Subscriptions',
    recurring: 'Recurring',
    recurringCashflow: 'Recurring income/expenses',
    emptyRecurringIncome: 'No recurring income',
    emptyRecurringExpense: 'No recurring expenses',
    badgeDebt: 'Debt',
    badgeAsset: 'Asset',
    emptyAssets: 'No assets yet. Use + to add a house or another asset.',
    planningBlurb:
      'Review and project your monthly spending by category — for example Home: subscriptions, mortgage, rent, and more — to see how your financial health looks each month.',
    result: 'Result',
    incomeMinusExpenses: 'income − expenses',
    incomeHint: (n) => `${n} · salary and other`,
    expensesHint: (n) => `${n} · bills and more`,
    recurringIncome: 'Recurring income',
    recurringExpenses: 'Recurring expenses',
    tapToAdd: 'Tap to add',
  },
  affiliates: {
    title: 'Affiliates',
    subtitle: 'Your link and commissions',
    shareLink: 'Share link',
    downloads: 'Downloads',
    registrations: 'Sign-ups',
    conversion: 'Conversion',
    revenueGenerated: 'Revenue generated',
    commissionAccrued: 'Accrued commission',
    commissionPaid: 'Paid commission',
    pendingPayout: 'Pending payout',
    payoutMethod: 'Payment method',
    payoutHint:
      'Crypto wallet USDT. Choose the network and enter the address where you’ll receive commissions.',
    pending: 'Pending',
    configured: 'Configured',
    walletAddress: 'WALLET ADDRESS',
    saving: 'Saving…',
    saved: 'Method saved',
    saveMethod: 'Save payment method',
    walletWarning:
      'Use only a wallet you control. A wrong network or address can make the payment undeliverable.',
    referredUsers: 'Referred users',
    referredEmpty: 'No sign-ups with your link or code yet. Share your link to get started.',
    tiers: 'Tiers',
    yourLevel: 'Your tier',
    how: 'How:',
    until: 'Until when:',
    businessRequired: 'Business program',
    upgradeBusiness: 'Upgrade to TecnoWallet Business',
    activate: 'Activate program',
    activating: 'Activating…',
  },
  assistant: {
    title: 'AI assistant',
    subtitle: 'Private analysis of your finances',
    hero: 'Ask anything about your money',
    heroHint:
      'TecnoWallet does the math. The AI never gets your full history and never moves money.',
    bubble:
      'Ask about categories, monthly totals, balances, or goals. TecnoWallet calculates the numbers; the AI only interprets and replies.',
    placeholder: 'What did I spend the most on?',
    paidOnly: 'Included in paid plans',
    needsPlus: 'The assistant needs TecnoWallet+ or Business.',
    noLedger: 'No active book.',
    error: 'We couldn’t reach the assistant.',
  },
  goals: {
    title: 'Goals/Savings',
    book: (name) => `Book ${name}`,
    yourGoals: 'Your goals',
    none: 'No goals',
    create: 'Create goal',
    empty: 'No goals in this book yet.',
    completed: 'Completed',
    active: 'Active',
    markPending: 'Mark pending',
    markCompleted: 'Mark completed',
  },
  movements: {
    title: 'Activity',
    searchPlaceholder: 'Search merchant, category…',
    balanceMonth: (month) => `Balance · ${month}`,
    results: 'Results',
    filter: 'Filter',
    pending: 'Pending',
    empty: 'No activity',
    noResults: 'No results',
  },
  cashflow: {
    income: 'Income',
    expenses: 'Expenses',
    incomeSubtitle: 'Inflows this month',
    expensesSubtitle: 'Outflows this month',
    totalIn: 'Total income',
    totalOut: 'Total spent',
    emptyIncome: 'No income this month',
    emptyExpenses: 'No expenses this month',
    registerIncome: 'Record income',
    registerExpense: 'Record expense',
    byCategory: 'By category',
    pctOfTotal: '% of total',
    movements: 'Activity',
    nMovements: (n) => `${n} transactions`,
    viewAll: 'See all activity',
  },
  more: {
    title: 'More',
    subtitle: 'Tools and preferences',
    viewProfile: 'View profile',
    adminPortal: 'Admin portal',
    adminSubtitle: 'Users, affiliates, and upgrades',
    languageSheet: 'Language',
    appearanceSheet: 'Appearance',
    currencySheet: 'Currency',
    currencySearch: 'Search currency',
    signOut: 'Sign out',
    deleteAccount: 'Delete account',
    deleteConfirm: 'This permanently deletes your account and data.',
    deleteHint: 'We send a code to your email to confirm.',
    sendCode: 'Send code',
    delete: 'Delete',
    cancel: 'Cancel',
    resendCode: 'Resend code',
    close: 'Close',
    enabled: 'On',
    disabled: 'Off',
    groups: {
      data: 'Data & utilities',
      plus: 'TecnoWallet+',
      preferences: 'Preferences',
      support: 'Support',
    },
    items: {
      divisa: { title: 'Currency', subtitle: 'Active book currency' },
      idioma: { title: 'Language', subtitle: 'English' },
      bancos: {
        title: 'Bank accounts',
        subtitle: 'Coming soon',
        badge: 'Soon',
      },
      datos: {
        title: 'Export',
        subtitle: 'Download your activity as CSV',
      },
      sonido: {
        title: 'Sound & haptics',
        subtitle: 'Feedback when tapping and saving',
      },
      apariencia: { title: 'Appearance', subtitle: 'Automatic · system' },
      'upgrade-plus': {
        title: 'Upgrade to TecnoWallet+',
        subtitle: 'Books, envelopes, AI, and 5 collaborators',
      },
      'upgrade-business': {
        title: 'Upgrade to TecnoWallet Business',
        subtitle: 'Everything in Plus + up to 10 collaborators',
      },
      afiliados: {
        title: 'Affiliates',
        subtitle: 'Requires TecnoWallet Business',
      },
      asistente: {
        title: 'AI assistant',
        subtitle: 'Ask about your finances',
      },
      recordatorios: {
        title: 'Reminders',
        subtitle: 'Payments, goals, and calendar',
      },
      seguridad: {
        title: 'Face ID / Biometrics',
        subtitle: 'Ask to unlock when opening',
      },
      ajustes: {
        title: 'More settings',
        subtitle: 'Week start and advanced options',
      },
      valorar: {
        title: 'Rate TecnoWallet',
        subtitle: 'Tell us what you think',
      },
      faq: {
        title: 'FAQ',
        subtitle: 'Guides and quick answers',
      },
      contacto: {
        title: 'Contact us',
        subtitle: 'dev@wwtecno.com',
      },
    },
    badges: {
      active: 'Active',
      upgrade: 'Upgrade',
      business: 'Business',
      soon: 'Soon',
      includedInBusiness: 'Included in Business',
      subscriptionActive: 'Active subscription',
    },
  },
  appearance: {
    system: 'Automatic · system',
    light: 'Light',
    dark: 'Dark',
  },
  week: {
    monday: 'Monday',
    sunday: 'Sunday',
  },
};

const defaultLedgerNames: Record<string, { es: string; en: string }> = {
  hogar: { es: 'Hogar', en: 'Home' },
  home: { es: 'Hogar', en: 'Home' },
};

export function displayLedgerName(name: string, locale: Locale) {
  const key = name.trim().toLowerCase();
  const mapped = defaultLedgerNames[key];
  if (!mapped) return name;
  return locale === 'es' ? mapped.es : mapped.en;
}

const defaultCalendarNames: Record<string, { es: string; en: string }> = {
  'mi calendario': { es: 'Mi calendario', en: 'My calendar' },
  'my calendar': { es: 'Mi calendario', en: 'My calendar' },
  'mis tareas': { es: 'Mis tareas', en: 'My tasks' },
  'my tasks': { es: 'Mis tareas', en: 'My tasks' },
};

export function displayCalendarName(name: string, locale: Locale) {
  const key = name.trim().toLowerCase();
  const mapped = defaultCalendarNames[key];
  if (!mapped) return name;
  return locale === 'es' ? mapped.es : mapped.en;
}

export function timeGreeting(copy: AppCopy, date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return copy.home.greetingMorning;
  if (hour < 19) return copy.home.greetingAfternoon;
  return copy.home.greetingEvening;
}

export function getAppCopy(locale: Locale): AppCopy {
  return locale === 'es' ? es : en;
}

export function useAppCopy() {
  const locale = useLanguageStore((state) => state.locale);
  return getAppCopy(locale);
}

const groupOrder = [
  { key: 'data' as const, slugs: ['divisa', 'idioma', 'bancos', 'datos', 'sonido', 'apariencia'] },
  {
    key: 'plus' as const,
    slugs: ['upgrade-plus', 'upgrade-business', 'afiliados', 'asistente'],
  },
  { key: 'preferences' as const, slugs: ['recordatorios', 'seguridad', 'ajustes'] },
  { key: 'support' as const, slugs: ['valorar', 'faq', 'contacto'] },
];

const itemMeta: Record<
  string,
  Pick<FeatureItem, 'icon' | 'color' | 'badgeTone'>
> = {
  divisa: { icon: 'banknote.fill', color: '#12B76A' },
  idioma: { icon: 'globe', color: '#F79009' },
  bancos: { icon: 'building.columns.fill', color: '#0878F9', badgeTone: 'neutral' },
  datos: { icon: 'square.and.arrow.up', color: '#F79009' },
  sonido: { icon: 'speaker.wave.2.fill', color: '#06AED4' },
  apariencia: { icon: 'paintbrush.fill', color: '#EE46BC' },
  'upgrade-plus': { icon: 'star.fill', color: '#F5C518' },
  'upgrade-business': { icon: 'briefcase.fill', color: '#0878F9' },
  afiliados: { icon: 'gift.fill', color: '#12B76A' },
  asistente: { icon: 'sparkles', color: '#7F56D9' },
  recordatorios: { icon: 'bell', color: '#F79009' },
  seguridad: { icon: 'faceid', color: '#7F56D9' },
  ajustes: { icon: 'gearshape.fill', color: '#0878F9' },
  valorar: { icon: 'hand.thumbsup.fill', color: '#F79009' },
  faq: { icon: 'questionmark.circle.fill', color: '#EE46BC' },
  contacto: {
    icon: 'bubble.left.and.bubble.right.fill',
    color: '#12B76A',
    badgeTone: 'neutral',
  },
};

export function localizedFeatureGroups(copy: AppCopy) {
  return groupOrder.map((group) => ({
    title: copy.more.groups[group.key],
    items: group.slugs.map((slug) => {
      const text = copy.more.items[slug];
      const meta = itemMeta[slug] ?? { icon: 'gearshape.fill' };
      return {
        slug,
        title: text?.title ?? slug,
        subtitle: text?.subtitle ?? '',
        badge: text?.badge,
        ...meta,
      } satisfies FeatureItem;
    }),
  }));
}
