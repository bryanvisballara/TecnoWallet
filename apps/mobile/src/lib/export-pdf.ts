import { formatPdfMoney, type ExportEnvelopeRow, type ExportReport } from '@/lib/export-report';

function latin1(value: string) {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function toWinAnsi(value: string) {
  const map: Record<string, number> = {
    Á: 0xc1,
    É: 0xc9,
    Í: 0xcd,
    Ó: 0xd3,
    Ú: 0xda,
    Ü: 0xdc,
    Ñ: 0xd1,
    á: 0xe1,
    é: 0xe9,
    í: 0xed,
    ó: 0xf3,
    ú: 0xfa,
    ü: 0xfc,
    ñ: 0xf1,
    '¿': 0xbf,
    '¡': 0xa1,
    '°': 0xb0,
  };
  return [...value]
    .map((char) => {
      if (map[char] != null) return String.fromCharCode(map[char]);
      const code = char.charCodeAt(0);
      if (code === 0xa0 || code === 0x202f || code === 0x2009) return ' ';
      return code <= 255 ? char : '?';
    })
    .join('');
}

function text(x: number, y: number, value: string, size = 10, font: 'F1' | 'F2' = 'F1') {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(toWinAnsi(value))}) Tj ET`;
}

const NAVY = '0.071 0.208 0.478';
const INK = '0.11 0.14 0.20';
const MUTED = '0.40 0.45 0.52';
const GREEN = '0.07 0.50 0.35';
const RED = '0.75 0.16 0.16';
const BLUE = '0.03 0.47 0.98';
const GOLD = '0.79 0.57 0.42';
const PAGE_BOTTOM = 52;

export function buildPdfBytes(report: ExportReport) {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = 0;
  let pageIndex = 0;

  const flush = () => {
    ops.push(`${MUTED} rg`);
    ops.push(text(36, 28, `TecnoWallet  ·  ${report.ledgerName}  ·  Pagina ${pageIndex + 1}`, 8));
    pages.push(ops.join('\n'));
  };

  const startPage = (hero: boolean) => {
    if (ops.length) flush();
    ops = [];
    pageIndex = pages.length;
    if (hero) {
      ops.push(`${NAVY} rg 0 732 612 60 re f`);
      ops.push('1 1 1 rg');
      ops.push(text(36, 768, 'TECNOWALLET', 16, 'F2'));
      ops.push(text(36, 750, 'Informe financiero', 11));
      ops.push(`${GOLD} rg 36 738 72 2 re f`);
      y = 714;
    } else {
      ops.push(`${NAVY} rg 0 764 612 28 re f`);
      ops.push('1 1 1 rg');
      ops.push(text(36, 774, `TecnoWallet  ·  ${report.ledgerName}`, 9, 'F2'));
      y = 748;
    }
  };

  const ensure = (need: number) => {
    if (y - need < PAGE_BOTTOM) startPage(false);
  };

  const heading = (label: string) => {
    ensure(28);
    ops.push(`${NAVY} rg`);
    ops.push(text(36, y, label, 12, 'F2'));
    y -= 8;
    ops.push(`${GOLD} rg 36 ${y} 48 1.5 re f`);
    y -= 16;
  };

  const meta = (label: string, value: string) => {
    ensure(14);
    ops.push(`${MUTED} rg`);
    ops.push(text(36, y, label, 8, 'F2'));
    ops.push(`${INK} rg`);
    ops.push(text(110, y, value.slice(0, 78), 9));
    y -= 14;
  };

  const tableHeader = (cols: { label: string; x: number }[]) => {
    ensure(22);
    ops.push(`${NAVY} rg 36 ${y - 4} 540 16 re f`);
    ops.push('1 1 1 rg');
    cols.forEach((col) => ops.push(text(col.x, y, col.label, 8, 'F2')));
    y -= 18;
  };

  startPage(true);
  meta('Libro', report.ledgerName);
  meta('Periodo', report.rangeLabel);
  meta('Generado', report.generatedAt);
  meta('Cuentas', report.accountNames.join(', ') || 'Todas');
  y -= 6;

  const cards = [
    { label: 'Ingresos', value: formatPdfMoney(report.incomeTotal, report.currency), color: GREEN },
    { label: 'Gastos', value: formatPdfMoney(report.expenseTotal, report.currency), color: RED },
    { label: 'Balance', value: formatPdfMoney(report.netTotal, report.currency), color: BLUE },
  ];
  ensure(56);
  cards.forEach((card, index) => {
    const x = 36 + index * 186;
    ops.push(`0.96 0.97 0.99 rg ${x} ${y - 36} 174 44 re f`);
    ops.push(`${card.color} rg`);
    ops.push(text(x + 10, y - 8, card.label, 8, 'F2'));
    ops.push(text(x + 10, y - 26, card.value, 11, 'F2'));
  });
  y -= 52;

  const wealth = [
    { label: 'Total activos', value: formatPdfMoney(report.assetsTotal, report.currency), color: GREEN },
    { label: 'Total deudas', value: formatPdfMoney(report.debtsTotal, report.currency), color: RED },
    { label: 'Patrimonio', value: formatPdfMoney(report.netWorth, report.currency), color: NAVY },
  ];
  ensure(56);
  wealth.forEach((card, index) => {
    const x = 36 + index * 186;
    ops.push(`0.96 0.97 0.99 rg ${x} ${y - 36} 174 44 re f`);
    ops.push(`${card.color} rg`);
    ops.push(text(x + 10, y - 8, card.label, 8, 'F2'));
    ops.push(text(x + 10, y - 26, card.value, 11, 'F2'));
  });
  y -= 56;

  const drawAccounts = (
    title: string,
    rows: ExportReport['assets'],
    totalLabel: string,
    total: number,
    asDebt: boolean,
  ) => {
    heading(title);
    tableHeader([
      { label: asDebt ? 'Deuda' : 'Activo', x: 40 },
      { label: 'Tipo', x: 250 },
      { label: asDebt ? 'Saldo a deber' : 'Valor / saldo', x: 430 },
    ]);
    if (rows.length === 0) {
      ops.push(`${MUTED} rg`);
      ops.push(text(40, y, asDebt ? 'Sin deudas registradas.' : 'Sin activos registrados.', 9));
      y -= 20;
      return;
    }
    rows.forEach((item, index) => {
      ensure(16);
      if (index % 2 === 0) ops.push(`0.97 0.98 0.99 rg 36 ${y - 4} 540 16 re f`);
      ops.push(`${INK} rg`);
      ops.push(text(40, y, item.name.slice(0, 28), 8));
      ops.push(text(250, y, item.kind.slice(0, 22), 8));
      ops.push(`${asDebt ? RED : GREEN} rg`);
      ops.push(text(430, y, formatPdfMoney(asDebt ? Math.abs(item.balance) : item.balance, report.currency), 8, 'F2'));
      y -= 16;
    });
    ensure(16);
    ops.push(`${NAVY} rg`);
    ops.push(text(40, y, totalLabel, 8, 'F2'));
    ops.push(text(430, y, formatPdfMoney(total, report.currency), 8, 'F2'));
    y -= 22;
  };

  drawAccounts('Activos', report.assets, 'Total activos', report.assetsTotal, false);
  drawAccounts('Deudas', report.debts, 'Total deudas', report.debtsTotal, true);
  ensure(18);
  ops.push(`${NAVY} rg 36 ${y - 4} 540 18 re f`);
  ops.push('1 1 1 rg');
  ops.push(text(40, y, 'Patrimonio total  (activos - deudas)', 8, 'F2'));
  ops.push(text(430, y, formatPdfMoney(report.netWorth, report.currency), 8, 'F2'));
  y -= 28;

  const drawEnvelopes = (title: string, rows: ExportEnvelopeRow[], tone: string) => {
    heading(title);
    tableHeader([
      { label: 'Sobre', x: 40 },
      { label: 'Movs', x: 250 },
      { label: 'En el periodo', x: 310 },
      { label: 'Presupuesto', x: 450 },
    ]);
    if (rows.length === 0) {
      ops.push(`${MUTED} rg`);
      ops.push(text(40, y, 'Sin sobres en esta seccion.', 9));
      y -= 20;
      return;
    }
    rows.forEach((item, index) => {
      ensure(16);
      if (index % 2 === 0) ops.push(`0.97 0.98 0.99 rg 36 ${y - 4} 540 16 re f`);
      ops.push(`${INK} rg`);
      ops.push(text(40, y, item.name.slice(0, 28), 8));
      ops.push(text(250, y, String(item.count), 8));
      ops.push(`${tone} rg`);
      ops.push(text(310, y, formatPdfMoney(item.periodTotal, report.currency), 8, 'F2'));
      ops.push(`${INK} rg`);
      ops.push(text(450, y, item.budget > 0 ? formatPdfMoney(item.budget, report.currency) : 'Sin limite', 8));
      y -= 16;
    });
    const period = rows.reduce((sum, item) => sum + item.periodTotal, 0);
    ensure(16);
    ops.push(`${NAVY} rg`);
    ops.push(text(40, y, 'Total del periodo', 8, 'F2'));
    ops.push(text(310, y, formatPdfMoney(period, report.currency), 8, 'F2'));
    y -= 22;
  };

  drawEnvelopes('Ingresos por sobre', report.incomeEnvelopes, GREEN);
  drawEnvelopes('Gastos por sobre', report.expenseEnvelopes, RED);
  if (report.savingsEnvelopes.length) {
    drawEnvelopes('Ahorros por sobre', report.savingsEnvelopes, BLUE);
  }

  heading('Detalle de movimientos');
  tableHeader([
    { label: 'Fecha', x: 40 },
    { label: 'Tipo', x: 108 },
    { label: 'Movimiento', x: 160 },
    { label: 'Sobre', x: 318 },
    { label: 'Cuenta', x: 410 },
    { label: 'Monto', x: 500 },
  ]);
  if (report.movements.length === 0) {
    ops.push(`${MUTED} rg`);
    ops.push(text(40, y, 'No hay movimientos en este periodo.', 9));
  } else {
    report.movements.forEach((item, index) => {
      ensure(16);
      if (index % 2 === 0) ops.push(`0.97 0.98 0.99 rg 36 ${y - 4} 540 16 re f`);
      const tone = item.kind === 'Ingreso' ? GREEN : RED;
      ops.push(`${tone} rg`);
      ops.push(text(40, y, item.date, 8));
      ops.push(text(108, y, item.kind, 8));
      ops.push(`${INK} rg`);
      ops.push(text(160, y, item.title.slice(0, 26), 8));
      ops.push(text(318, y, item.envelope.slice(0, 14), 8));
      ops.push(text(410, y, item.account.slice(0, 12), 8));
      ops.push(`${tone} rg`);
      ops.push(text(500, y, formatPdfMoney(item.signedAmount, report.currency), 8));
      y -= 16;
    });
  }

  flush();

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  const kids = pages.map((_, index) => `${3 + index * 2} 0 R`).join(' ');
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);
  const fontStart = 3 + pages.length * 2;
  pages.forEach((stream, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontStart} 0 R /F2 ${fontStart + 1} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const header = '%PDF-1.4\n';
  const parts: Uint8Array[] = [latin1(header)];
  const offsets = [0];
  let pos = header.length;
  objects.forEach((object, index) => {
    offsets.push(pos);
    const body = `${index + 1} 0 obj\n${object}\nendobj\n`;
    const bytes = latin1(body);
    parts.push(bytes);
    pos += bytes.length;
  });
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;
  parts.push(latin1(xref));
  return concat(parts);
}
