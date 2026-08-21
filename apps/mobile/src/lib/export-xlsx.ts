import { formatMoney, type ExportReport } from '@/lib/export-report';
import { zipStore } from '@/lib/zip-store';

function xml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(value: string, style = 0) {
  return `<c s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function numberCell(value: number, style: number) {
  return `<c s="${style}" t="n"><v>${value}</v></c>`;
}

function row(index: number, cells: string[]) {
  return `<row r="${index}">${cells.join('')}</row>`;
}

function sheetXml(rows: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

export function buildXlsxBytes(report: ExportReport) {
  const resumenRows = [
    row(1, [inline('TecnoWallet', 1), inline('Informe financiero', 1)]),
    row(2, [inline('Libro', 6), inline(report.ledgerName)]),
    row(3, [inline('Periodo', 6), inline(report.rangeLabel)]),
    row(4, [inline('Generado', 6), inline(report.generatedAt)]),
    row(5, [inline('Cuentas', 6), inline(report.accountNames.join(', ') || '—')]),
    row(7, [inline('Ingresos', 1), inline(formatMoney(report.incomeTotal, report.currency), 2)]),
    row(8, [inline('Gastos', 1), inline(formatMoney(report.expenseTotal, report.currency), 3)]),
    row(9, [inline('Balance', 1), inline(formatMoney(report.netTotal, report.currency))]),
    row(11, [inline('Total activos', 1), inline(formatMoney(report.assetsTotal, report.currency), 2)]),
    row(12, [inline('Total deudas', 1), inline(formatMoney(report.debtsTotal, report.currency), 3)]),
    row(13, [inline('Patrimonio total', 1), inline(formatMoney(report.netWorth, report.currency))]),
  ].join('');

  const accountSheet = (items: ExportReport['assets'], asDebt: boolean) => {
    const header = row(1, [
      inline(asDebt ? 'Deuda' : 'Activo', 1),
      inline('Tipo', 1),
      inline(asDebt ? 'Saldo a deber' : 'Valor / saldo', 1),
    ]);
    const body = items
      .map((item, index) =>
        row(index + 2, [
          inline(item.name),
          inline(item.kind),
          numberCell(asDebt ? Math.abs(item.balance) : item.balance, asDebt ? 5 : 4),
        ]),
      )
      .join('');
    const total = row(items.length + 3, [
      inline(asDebt ? 'Total deudas' : 'Total activos', 6),
      inline(''),
      numberCell(asDebt ? report.debtsTotal : report.assetsTotal, asDebt ? 5 : 4),
    ]);
    return header + body + total;
  };

  const envelopeHeader = row(1, [
    inline('Tipo', 1),
    inline('Sobre', 1),
    inline('Movimientos', 1),
    inline('Total del periodo', 1),
    inline('Total del sobre', 1),
    inline('Presupuesto', 1),
  ]);
  const envelopeItems = [
    ...report.incomeEnvelopes.map((item) => ({ ...item, tipo: 'Ingreso' })),
    ...report.expenseEnvelopes.map((item) => ({ ...item, tipo: 'Gasto' })),
    ...report.savingsEnvelopes.map((item) => ({ ...item, tipo: 'Ahorro' })),
  ];
  const envelopeBody = envelopeItems
    .map((item, index) =>
      row(index + 2, [
        inline(item.tipo, item.tipo === 'Ingreso' ? 2 : 3),
        inline(item.name, item.tipo === 'Ingreso' ? 2 : 3),
        numberCell(item.count, item.tipo === 'Ingreso' ? 2 : 3),
        numberCell(item.periodTotal, item.tipo === 'Ingreso' ? 4 : 5),
        numberCell(item.envelopeTotal, item.tipo === 'Ingreso' ? 4 : 5),
        numberCell(item.budget, 0),
      ]),
    )
    .join('');

  const movementHeader = row(1, [
    inline('Fecha', 1),
    inline('Hora', 1),
    inline('Tipo', 1),
    inline('Movimiento', 1),
    inline('Sobre', 1),
    inline('Cuenta', 1),
    inline('Monto', 1),
    inline('Moneda', 1),
    inline('Registró', 1),
    inline('Nota', 1),
  ]);
  const movementBody = report.movements
    .map((item, index) => {
      const style = item.kind === 'Ingreso' ? 2 : 3;
      return row(index + 2, [
        inline(item.date, style),
        inline(item.time, style),
        inline(item.kind, style),
        inline(item.title, style),
        inline(item.envelope, style),
        inline(item.account, style),
        numberCell(item.signedAmount, item.kind === 'Ingreso' ? 4 : 5),
        inline(report.currency, style),
        inline(item.recorder, style),
        inline(item.note, style),
      ]);
    })
    .join('');

  const encode = (value: string) => new TextEncoder().encode(value);
  return zipStore([
    {
      name: '[Content_Types].xml',
      data: encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet4.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet5.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
    },
    {
      name: '_rels/.rels',
      data: encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      data: encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
    },
    {
      name: 'xl/workbook.xml',
      data: encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Resumen" sheetId="1" r:id="rId1"/>
    <sheet name="Activos" sheetId="2" r:id="rId2"/>
    <sheet name="Deudas" sheetId="3" r:id="rId3"/>
    <sheet name="Sobres" sheetId="4" r:id="rId4"/>
    <sheet name="Movimientos" sheetId="5" r:id="rId5"/>
  </sheets>
</workbook>`),
    },
    { name: 'xl/worksheets/sheet1.xml', data: encode(sheetXml(resumenRows)) },
    { name: 'xl/worksheets/sheet2.xml', data: encode(sheetXml(accountSheet(report.assets, false))) },
    { name: 'xl/worksheets/sheet3.xml', data: encode(sheetXml(accountSheet(report.debts, true))) },
    { name: 'xl/worksheets/sheet4.xml', data: encode(sheetXml(envelopeHeader + envelopeBody)) },
    { name: 'xl/worksheets/sheet5.xml', data: encode(sheetXml(movementHeader + movementBody)) },
    {
      name: 'xl/styles.xml',
      data: encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF12357A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF12357A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE8F8F0"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border/></borders>
  <cellXfs count="7">
    <xf fontId="0" fillId="0" borderId="0"/>
    <xf fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/>
    <xf fontId="0" fillId="3" borderId="0" applyFill="1"/>
    <xf fontId="0" fillId="4" borderId="0" applyFill="1"/>
    <xf fontId="0" fillId="3" borderId="0" applyFill="1" applyNumberFormat="1" numFmtId="4"/>
    <xf fontId="0" fillId="4" borderId="0" applyFill="1" applyNumberFormat="1" numFmtId="4"/>
    <xf fontId="2" fillId="0" borderId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`),
    },
  ]);
}
