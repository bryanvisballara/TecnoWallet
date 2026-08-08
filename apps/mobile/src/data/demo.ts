export type Transaction = {
  id: string;
  title: string;
  category: string;
  account: string;
  amount: number;
  date: string;
  icon: string;
  note?: string;
  tags?: string[];
  recurring?: boolean;
  /** Member who registered the movement (shared ledgers). */
  createdBy?: string;
};

export type Account = {
  id: string;
  name: string;
  kind: string;
  balance: number;
  icon: string;
  color: string;
  lastFour: string;
};

export type Envelope = {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  spent: number;
  budget: number;
  icon: string;
  color: string;
  rollover: boolean;
  rule: string;
};

export const summary = {
  total: 24780.5,
  income: 6840,
  expenses: 3932.4,
  remaining: 2907.6,
  savings: 4150,
  daily: 96.92,
  goal: 5000,
  goalCurrent: 3675,
  comparison: -12.4,
};

export const accounts: Account[] = [
  { id: 'a1', name: 'Cuenta principal', kind: 'Cuenta corriente', balance: 8940.5, icon: 'creditcard.fill', color: '#0878F9', lastFour: '4821' },
  { id: 'a2', name: 'Ahorros futuro', kind: 'Cuenta de ahorro', balance: 12400, icon: 'building.columns.fill', color: '#12B76A', lastFour: '9173' },
  { id: 'a3', name: 'Efectivo', kind: 'Efectivo', balance: 540, icon: 'banknote.fill', color: '#F79009', lastFour: '—' },
  { id: 'a4', name: 'Visa Tecno', kind: 'Tarjeta de crédito', balance: -2890, icon: 'creditcard.fill', color: '#7F56D9', lastFour: '2409' },
];

export const transactions: Transaction[] = [
  { id: 't1', title: 'Supermercado Central', category: 'Alimentación', account: 'Visa Tecno', amount: -86.42, date: 'Hoy, 10:24', icon: 'cart.fill', tags: ['hogar'], createdBy: 'Sam Rivera' },
  { id: 't2', title: 'Nómina TecnoLabs', category: 'Ingresos', account: 'Cuenta principal', amount: 3420, date: 'Hoy, 08:00', icon: 'arrow.down.circle.fill', recurring: true, createdBy: 'Alex Rivera' },
  { id: 't3', title: 'Café Nómada', category: 'Restaurantes', account: 'Cuenta principal', amount: -7.8, date: 'Ayer, 17:12', icon: 'cup.and.saucer.fill', createdBy: 'Sam Rivera' },
  { id: 't4', title: 'Metro', category: 'Transporte', account: 'Cuenta principal', amount: -2.4, date: 'Ayer, 08:45', icon: 'tram.fill', createdBy: 'Alex Rivera' },
  { id: 't5', title: 'Netflix', category: 'Suscripciones', account: 'Visa Tecno', amount: -15.99, date: '2 ago', icon: 'play.rectangle.fill', recurring: true, createdBy: 'Alex Rivera' },
  { id: 't6', title: 'Ahorro automático', category: 'Ahorro', account: 'Ahorros futuro', amount: -350, date: '1 ago', icon: 'leaf.fill', recurring: true, createdBy: 'Alex Rivera' },
];

export const envelopes: Envelope[] = [
  { id: 'salary', name: 'Nómina', kind: 'income', spent: 3420, budget: 3420, icon: 'arrow.down.circle.fill', color: '#12B76A', rollover: false, rule: 'Depósito el día 1' },
  { id: 'freelance', name: 'Freelance', kind: 'income', spent: 980, budget: 1200, icon: 'laptopcomputer', color: '#0878F9', rollover: true, rule: 'Proyectos del mes' },
  { id: 'extra', name: 'Extras', kind: 'income', spent: 240, budget: 400, icon: 'sparkles', color: '#06AED4', rollover: true, rule: 'Bonos y reembolsos' },
  { id: 'food', name: 'Alimentación', kind: 'expense', spent: 438, budget: 650, icon: 'cart.fill', color: '#F79009', rollover: true, rule: 'Recibe 12% de cada ingreso' },
  { id: 'home', name: 'Hogar', kind: 'expense', spent: 780, budget: 1100, icon: 'house.fill', color: '#0878F9', rollover: false, rule: 'Reinicio mensual' },
  { id: 'fun', name: 'Ocio', kind: 'expense', spent: 268, budget: 300, icon: 'gamecontroller.fill', color: '#7F56D9', rollover: false, rule: 'Límite estricto' },
  { id: 'transport', name: 'Transporte', kind: 'expense', spent: 124, budget: 260, icon: 'car.fill', color: '#06AED4', rollover: true, rule: 'Acumula sobrante' },
  { id: 'health', name: 'Salud', kind: 'expense', spent: 92, budget: 250, icon: 'heart.fill', color: '#F04438', rollover: true, rule: 'Fondo de emergencia' },
  { id: 'travel', name: 'Viajes', kind: 'expense', spent: 325, budget: 700, icon: 'airplane', color: '#12B76A', rollover: true, rule: 'Aporte semanal de $40' },
];

export const upcoming = [
  { name: 'Alquiler', date: '8 ago', amount: 980, color: '#0878F9' },
  { name: 'Internet', date: '11 ago', amount: 44.9, color: '#7F56D9' },
  { name: 'Seguro', date: '15 ago', amount: 78, color: '#12B76A' },
];

export type FeatureItem = {
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  color?: string;
  badge?: string;
  badgeTone?: 'blue' | 'green' | 'orange' | 'neutral';
};

export const featureGroups: Array<{ title: string; items: FeatureItem[] }> = [
  {
    title: 'Planificación',
    items: [
      { slug: 'facturas', title: 'Facturas', subtitle: '3 próximas · $1,102.90', icon: 'doc.text.fill', color: '#0878F9' },
      { slug: 'suscripciones', title: 'Suscripciones', subtitle: '$64.47 al mes', icon: 'repeat', color: '#06AED4' },
      { slug: 'recurrentes', title: 'Recurrentes', subtitle: '5 reglas activas', icon: 'arrow.clockwise', color: '#0E9384', badge: 'Activo', badgeTone: 'green' },
      { slug: 'metas', title: 'Metas', subtitle: '3 activas · 74% promedio', icon: 'target', color: '#F79009' },
      { slug: 'estadisticas', title: 'Estadísticas', subtitle: 'Tendencias e informes', icon: 'chart.bar.fill', color: '#0878F9' },
    ],
  },
  {
    title: 'Datos y utilidades',
    items: [
      { slug: 'datos', title: 'Exportar', subtitle: 'Descarga tus movimientos en CSV', icon: 'square.and.arrow.up', color: '#F79009' },
      { slug: 'backup', title: 'Copias de seguridad', subtitle: 'Última copia hace 3 días', icon: 'externaldrive.fill', color: '#7F56D9', badge: 'Inactivo', badgeTone: 'orange' },
      { slug: 'bancos', title: 'Cuentas bancarias', subtitle: 'Conectar bancos y tarjetas', icon: 'building.columns.fill', color: '#0878F9' },
      { slug: 'ocr', title: 'Escanear recibos', subtitle: 'OCR de tickets y facturas', icon: 'camera', color: '#12B76A' },
      { slug: 'actividad', title: 'Actividad en vivo', subtitle: 'Widgets y Live Activities', icon: 'flame.fill', color: '#0878F9' },
    ],
  },
  {
    title: 'TecnoWallet+',
    items: [
      { slug: 'asistente', title: 'Asistente IA', subtitle: 'Pregunta sobre tus finanzas', icon: 'sparkles', color: '#7F56D9' },
      { slug: 'presupuesto-ia', title: 'Presupuesto inteligente', subtitle: 'Ajustes sugeridos este mes', icon: 'chart.pie.fill', color: '#0878F9' },
      { slug: 'familia', title: 'Libros de contabilidad', subtitle: 'Crear, cambiar y compartir', icon: 'wallet.pass.fill', color: '#F04438' },
    ],
  },
  {
    title: 'Preferencias',
    items: [
      { slug: 'idioma', title: 'Idioma', subtitle: 'Español', icon: 'globe', color: '#F79009' },
      { slug: 'tema', title: 'Tema', subtitle: 'Automático · sistema', icon: 'paintbrush.fill', color: '#EE46BC' },
      { slug: 'sync', title: 'Sincronización en la nube', subtitle: 'Mantén tus datos al día', icon: 'icloud.and.arrow.up', color: '#12B76A', badge: 'Desactivado', badgeTone: 'neutral' },
      { slug: 'recordatorios', title: 'Recordatorios', subtitle: 'Pagos, metas y límites', icon: 'bell', color: '#F79009' },
      { slug: 'seguridad', title: 'Bloqueo de privacidad', subtitle: 'Face ID y ocultar saldos', icon: 'lock.fill', color: '#7F56D9' },
      { slug: 'sonido', title: 'Sonido y haptics', subtitle: 'Feedback al registrar gastos', icon: 'speaker.wave.2.fill', color: '#06AED4' },
      { slug: 'ajustes', title: 'Más ajustes', subtitle: 'Moneda, semana y apariencia', icon: 'gearshape.fill', color: '#0878F9' },
    ],
  },
  {
    title: 'Soporte',
    items: [
      { slug: 'valorar', title: 'Valorar TecnoWallet', subtitle: 'Ayúdanos con tu opinión', icon: 'hand.thumbsup.fill', color: '#F79009' },
      { slug: 'faq', title: 'Preguntas frecuentes', subtitle: 'Guías y respuestas rápidas', icon: 'questionmark.circle.fill', color: '#EE46BC' },
      { slug: 'contacto', title: 'Contáctanos', subtitle: 'hola@tecnowallet.app', icon: 'bubble.left.and.bubble.right.fill', color: '#12B76A', badge: 'v1.0.0', badgeTone: 'neutral' },
      { slug: 'transferir', title: 'Transferir datos', subtitle: 'Mover a otro dispositivo', icon: 'square.and.arrow.up.on.square', color: '#0878F9' },
    ],
  },
];

export const money = (value: number, compact = false) =>
  new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: compact ? 0 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
