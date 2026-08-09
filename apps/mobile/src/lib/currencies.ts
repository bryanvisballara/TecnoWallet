export type CurrencyOption = {
  code: string;
  name: string;
  /** Monedas que en la práctica se escriben sin decimales. */
  zeroDecimal?: boolean;
};

const PRIORITY = ['USD', 'COP', 'MXN', 'CAD', 'EUR'] as const;

const LATAM: CurrencyOption[] = [
  { code: 'ARS', name: 'Peso argentino' },
  { code: 'BOB', name: 'Boliviano' },
  { code: 'BRL', name: 'Real brasileño' },
  { code: 'CLP', name: 'Peso chileno', zeroDecimal: true },
  { code: 'CRC', name: 'Colón costarricense' },
  { code: 'CUP', name: 'Peso cubano' },
  { code: 'DOP', name: 'Peso dominicano' },
  { code: 'GTQ', name: 'Quetzal guatemalteco' },
  { code: 'HNL', name: 'Lempira hondureña' },
  { code: 'NIO', name: 'Córdoba nicaragüense' },
  { code: 'PAB', name: 'Balboa panameña' },
  { code: 'PEN', name: 'Sol peruano' },
  { code: 'PYG', name: 'Guaraní paraguayo', zeroDecimal: true },
  { code: 'UYU', name: 'Peso uruguayo' },
  { code: 'VES', name: 'Bolívar venezolano' },
];

const OTHER: CurrencyOption[] = [
  { code: 'GBP', name: 'Libra esterlina' },
  { code: 'CHF', name: 'Franco suizo' },
  { code: 'JPY', name: 'Yen japonés', zeroDecimal: true },
  { code: 'CNY', name: 'Yuan chino' },
  { code: 'AUD', name: 'Dólar australiano' },
  { code: 'NZD', name: 'Dólar neozelandés' },
  { code: 'SEK', name: 'Corona sueca' },
  { code: 'NOK', name: 'Corona noruega' },
  { code: 'DKK', name: 'Corona danesa' },
  { code: 'PLN', name: 'Złoty polaco' },
  { code: 'CZK', name: 'Corona checa' },
  { code: 'HUF', name: 'Florín húngaro' },
  { code: 'RON', name: 'Leu rumano' },
  { code: 'TRY', name: 'Lira turca' },
  { code: 'INR', name: 'Rupia india' },
  { code: 'KRW', name: 'Won surcoreano', zeroDecimal: true },
  { code: 'SGD', name: 'Dólar de Singapur' },
  { code: 'HKD', name: 'Dólar de Hong Kong' },
  { code: 'TWD', name: 'Dólar taiwanés' },
  { code: 'THB', name: 'Baht tailandés' },
  { code: 'MYR', name: 'Ringgit malayo' },
  { code: 'IDR', name: 'Rupia indonesia' },
  { code: 'PHP', name: 'Peso filipino' },
  { code: 'VND', name: 'Dong vietnamita', zeroDecimal: true },
  { code: 'AED', name: 'Dírham de EAU' },
  { code: 'SAR', name: 'Riyal saudí' },
  { code: 'ILS', name: 'Nuevo séquel israelí' },
  { code: 'ZAR', name: 'Rand sudafricano' },
  { code: 'EGP', name: 'Libra egipcia' },
  { code: 'NGN', name: 'Naira nigeriana' },
  { code: 'KES', name: 'Chelín keniano' },
];

const PRIORITY_META: Record<(typeof PRIORITY)[number], CurrencyOption> = {
  USD: { code: 'USD', name: 'Dólar estadounidense' },
  COP: { code: 'COP', name: 'Peso colombiano', zeroDecimal: true },
  MXN: { code: 'MXN', name: 'Peso mexicano' },
  CAD: { code: 'CAD', name: 'Dólar canadiense' },
  EUR: { code: 'EUR', name: 'Euro' },
};

export const currencies: CurrencyOption[] = [
  ...PRIORITY.map((code) => PRIORITY_META[code]),
  ...LATAM,
  ...OTHER,
];

const byCode = new Map(currencies.map((item) => [item.code, item]));

export function currencyLabel(code: string) {
  return byCode.get(code)?.name ?? code;
}

export function isZeroDecimalCurrency(code: string) {
  return Boolean(byCode.get(code)?.zeroDecimal);
}

export function amountToMinorUnits(raw: string, currency: string) {
  const clean = raw.trim().replace(/[^\d.,-]/g, '');
  if (!clean) return Number.NaN;

  let normalized: string;
  if (isZeroDecimalCurrency(currency)) {
    normalized = clean.replace(/[.,]/g, '');
  } else if (clean.includes(',') && clean.includes('.')) {
    normalized =
      clean.lastIndexOf(',') > clean.lastIndexOf('.')
        ? clean.replace(/\./g, '').replace(',', '.')
        : clean.replace(/,/g, '');
  } else if (clean.includes(',')) {
    normalized = clean.replace(',', '.');
  } else {
    normalized = clean;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return Number.NaN;

  // Persistimos siempre en centavos (minor units ×100) para unificar el backend.
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : Number.NaN;
}

export function amountPlaceholder(currency: string) {
  return isZeroDecimalCurrency(currency) ? '4.000.000' : '2,500.00';
}

export function monthlyAmountPlaceholder(currency: string) {
  return isZeroDecimalCurrency(currency) ? '700.000' : '300.00';
}

export function contributionAmountPlaceholder(currency: string) {
  return isZeroDecimalCurrency(currency) ? '100.000' : '100.00';
}
