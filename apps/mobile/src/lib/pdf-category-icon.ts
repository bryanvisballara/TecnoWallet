/** Vector icons for the share PDF (24×24, origin bottom-left). */

function circle(cx: number, cy: number, r: number, fill = true) {
  const k = r * 0.5523;
  return [
    `${cx.toFixed(2)} ${(cy + r).toFixed(2)} m`,
    `${(cx + k).toFixed(2)} ${(cy + r).toFixed(2)} ${(cx + r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx + r).toFixed(2)} ${cy.toFixed(2)} c`,
    `${(cx + r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx + k).toFixed(2)} ${(cy - r).toFixed(2)} ${cx.toFixed(2)} ${(cy - r).toFixed(2)} c`,
    `${(cx - k).toFixed(2)} ${(cy - r).toFixed(2)} ${(cx - r).toFixed(2)} ${(cy - k).toFixed(2)} ${(cx - r).toFixed(2)} ${cy.toFixed(2)} c`,
    `${(cx - r).toFixed(2)} ${(cy + k).toFixed(2)} ${(cx - k).toFixed(2)} ${(cy + r).toFixed(2)} ${cx.toFixed(2)} ${(cy + r).toFixed(2)} c`,
    fill ? 'f' : 's',
  ].join(' ');
}

const ICONS: Record<string, string> = {
  'fork.knife': [
    '5.8 3.8 m 5.8 14.2 l S',
    '4.4 14.2 m 7.2 14.2 l 5.8 21.4 l h f',
    '16.6 3.8 m 16.6 12 l S',
    '13.4 12 m 19.8 12 l S',
    '13.4 12 m 13.4 21.2 l S',
    '16.6 12 m 16.6 21.2 l S',
    '19.8 12 m 19.8 21.2 l S',
  ].join('\n'),
  'house.fill': '12 21.2 m 2.4 12.2 l 5.2 12.2 l 5.2 4 l 10.2 4 l 10.2 9.6 l 13.8 9.6 l 13.8 4 l 18.8 4 l 18.8 12.2 l 21.6 12.2 l h f',
  'car.fill': [
    '4 9.2 m 5.2 13.6 8.4 16.4 12 16.4 c 15.6 16.4 18.8 13.6 20 9.2 c l 20 7.2 l 4 7.2 l h f',
    circle(7.4, 6.6, 1.7, true),
    circle(16.6, 6.6, 1.7, true),
    '7.4 12.6 3.2 2 re f',
    '13.4 12.6 3.2 2 re f',
  ].join('\n'),
  'fuelpump.fill': [
    '5.2 3.6 7.6 17.2 re f',
    '4.4 20.6 9.2 2.2 re f',
    '14.6 12 m 18.4 14.8 l 18.4 8.4 l S',
    circle(18.4, 8.4, 1.3, true),
  ].join('\n'),
  'cart.fill': [
    '3.4 18.8 m 5.2 18.8 l 6.4 8.2 l 19.6 8.2 l S',
    '6.8 15.6 12.4 1.8 re f',
    '7 12.4 12 1.8 re f',
    circle(9.2, 5.4, 1.5, true),
    circle(17.2, 5.4, 1.5, true),
  ].join('\n'),
  'bag.fill': [
    '5.2 3.6 13.6 13.6 re f',
    '8.2 17.2 m 8.2 20.4 10 21.6 12 21.6 c 14 21.6 15.8 20.4 15.8 17.2 c S',
  ].join('\n'),
  'cross.case.fill': [
    '3.6 6.4 16.8 11.6 re f',
    '1 1 1 RG 1 1 1 rg',
    '10.6 8.2 2.8 8 re f',
    '7.2 11 9.6 2.4 re f',
  ].join('\n'),
  'figure.run': [
    circle(15.4, 19.2, 1.8, true),
    '9.2 3.4 m 11.6 9.2 l 8.2 12.6 l S',
    '11.6 9.2 m 16.4 12.2 l 19.6 8.2 l S',
    '12.2 12.8 m 10.4 16.6 l S',
  ].join('\n'),
  'dumbbell.fill': [
    '3.2 8.2 3.4 7.6 re f',
    '17.4 8.2 3.4 7.6 re f',
    '6.2 10.6 11.6 3.2 re f',
  ].join('\n'),
  'gamecontroller.fill': [
    '3.6 8.4 m 5.2 14.8 8.8 17.2 12 17.2 c 15.2 17.2 18.8 14.8 20.4 8.4 c 19.2 6.2 16.6 6.6 15.4 8.2 c l 8.6 8.2 l 7.4 6.6 4.8 6.2 3.6 8.4 c f',
    '1 1 1 RG 1 1 1 rg',
    circle(8.4, 11.4, 1.1, true),
    '15.2 12.4 3.2 1.2 re f',
  ].join('\n'),
  'ticket.fill': '3.2 8.2 m 3.2 16.4 l 8.4 16.4 8.4 18.2 12 18.2 c 15.6 18.2 15.6 16.4 20.8 16.4 c l 20.8 8.2 l 15.6 8.2 15.6 6.4 12 6.4 c 8.4 6.4 8.4 8.2 3.2 8.2 c f',
  'person.2.fill': [
    circle(8.6, 16.2, 2.4, true),
    '4.2 6.4 m 4.2 10.8 6.2 13.2 8.6 13.2 c 11 13.2 13 10.8 13 6.4 c l h f',
    circle(15.8, 16.6, 2.2, true),
    '12.2 6.4 m 12.2 10.4 13.8 12.6 15.8 12.6 c 17.8 12.6 19.8 10.4 19.8 6.4 c l h f',
  ].join('\n'),
  'heart.fill':
    '12 5.2 m 4.2 12.4 3.4 18.4 8.4 18.8 c 10.6 19 12 17.2 12 15.8 c 12 17.2 13.4 19 15.6 18.8 c 20.6 18.4 19.8 12.4 12 5.2 c f',
  'bolt.fill': '13.6 21.2 m 8.2 12.6 l 12.2 12.6 l 10.4 3.4 l 18.2 13.4 l 13.8 13.4 l h f',
  wifi: [
    '12 5.6 m 12 5.6 l S',
    circle(12, 5.8, 1.2, true),
    '7.4 9.2 m 5.2 11.6 8.2 14.4 12 14.4 c 15.8 14.4 18.8 11.6 16.6 9.2 c S',
    '5.2 13 m 2.4 16.2 6.6 20.4 12 20.4 c 17.4 20.4 21.6 16.2 18.8 13 c S',
  ].join('\n'),
  'drop.fill': '12 21 m 5.4 12.4 5.6 7.2 12 7.2 c 18.4 7.2 18.6 12.4 12 21 c f',
  'phone.fill': '8.2 3.4 m 6.4 3.8 5.2 5.6 5.6 7.6 c 6.6 12.2 10.2 17.6 14.8 19.6 c 16.8 20.4 18.8 19.4 19.4 17.6 c l 16.6 15.4 l 15 16.8 13.2 15.2 11.6 12.6 c 10.2 10.2 9.4 8.2 10.6 6.6 c l h f',
  'book.fill': '5.2 4.2 6.4 16.4 re f 12.6 4.2 6.4 16.4 re f 11.6 4.2 1 16.4 re f',
  'briefcase.fill': '3.4 5.2 17.2 11.4 re f 8.4 16.6 7.2 3.4 re f',
  'bus.fill': [
    '4.2 6.8 15.6 13.4 re f',
    circle(8, 6.2, 1.7, true),
    circle(16, 6.2, 1.7, true),
    '1 1 1 RG 1 1 1 rg',
    '6 14.4 4 3.2 re f',
    '13.2 14.4 4 3.2 re f',
  ].join('\n'),
  airplane: '3.2 11.4 m 11.2 13.6 l 20.8 16.8 l 18.6 13.2 l 20.6 8.2 l 12.2 11.2 l 6.4 5.2 l 7.6 10.4 l h f',
  'pawprint.fill': [
    circle(8.2, 16.4, 1.7, true),
    circle(15.8, 16.4, 1.7, true),
    circle(6.4, 12.2, 1.6, true),
    circle(17.6, 12.2, 1.6, true),
    circle(12, 8.2, 3.2, true),
  ].join('\n'),
  'gift.fill': [
    '4.4 4.2 15.2 9.2 re f',
    '4.4 13.4 15.2 4.2 re f',
    '11.2 4.2 1.6 13.4 re f',
    '8.2 17.4 m 8.2 20.6 10.2 21.6 12 20.2 c 13.8 21.6 15.8 20.6 15.8 17.4 c S',
  ].join('\n'),
  'banknote.fill': '3.2 7.2 17.6 10.2 re f 1 1 1 RG 1 1 1 rg ' + circle(12, 12.3, 2.2, true),
  'creditcard.fill': '3.2 7.2 17.6 10.4 re f 1 1 1 RG 1 1 1 rg 5.2 13.6 6.4 1.6 re f',
  calendar: [
    '4.4 4.4 15.2 14.4 re f',
    '1 1 1 RG 1 1 1 rg',
    '4.4 14.8 15.2 4 re f',
    '7.2 18.8 1.4 3.2 re f',
    '15.4 18.8 1.4 3.2 re f',
  ].join('\n'),
  'checkmark.circle.fill': [
    circle(12, 12, 9.2, true),
    '1 1 1 RG 1 1 1 rg',
    '7.2 12.2 m 10.4 8.8 l 16.8 16.2 l S',
  ].join('\n'),
};

function fallbackIcon() {
  return [
    '4.4 4.4 15.2 15.2 re s',
    '12 8 m 12 16 l S',
    '8 12 m 16 12 l S',
  ].join('\n');
}

export function pdfCategoryIcon(name: string, x: number, y: number, size: number, rgb: string) {
  const scale = size / 24;
  const glyph = ICONS[name] ?? fallbackIcon();
  return [
    'q',
    `${scale.toFixed(3)} 0 0 ${scale.toFixed(3)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
    `${rgb} RG`,
    `${rgb} rg`,
    '1.7 w 1 J 1 j',
    glyph,
    'Q',
  ].join('\n');
}

export function pdfRoundRect(x: number, y: number, w: number, h: number, r: number, fillRgb: string) {
  const k = r * 0.5523;
  return [
    `${fillRgb} rg`,
    `${(x + r).toFixed(2)} ${y.toFixed(2)} m`,
    `${(x + w - r).toFixed(2)} ${y.toFixed(2)} l`,
    `${(x + w - r + k).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + w).toFixed(2)} ${(y + r).toFixed(2)} c`,
    `${(x + w).toFixed(2)} ${(y + h - r).toFixed(2)} l`,
    `${(x + w).toFixed(2)} ${(y + h - r + k).toFixed(2)} ${(x + w - r + k).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r).toFixed(2)} ${(y + h).toFixed(2)} c`,
    `${(x + r).toFixed(2)} ${(y + h).toFixed(2)} l`,
    `${(x + r - k).toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r + k).toFixed(2)} ${x.toFixed(2)} ${(y + h - r).toFixed(2)} c`,
    `${x.toFixed(2)} ${(y + r).toFixed(2)} l`,
    `${x.toFixed(2)} ${(y + r - k).toFixed(2)} ${(x + r - k).toFixed(2)} ${y.toFixed(2)} ${(x + r).toFixed(2)} ${y.toFixed(2)} c`,
    'f',
  ].join('\n');
}
