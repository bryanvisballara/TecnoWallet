import { Alert, Platform, Share } from 'react-native';

import {
  formatDayLabel,
  formatHour,
  formatReminderLabel,
  parseDateKey,
  typeIcons,
  typeLabels,
  type CalendarAttachment,
  type CalendarItemType,
} from '@/data/calendar';
import { categoryIcons } from '@/lib/category-icons';
import { isImageAttachment } from '@/lib/open-attachment';
import { pdfCategoryIcon, pdfRoundRect } from '@/lib/pdf-category-icon';
import { saveExportFile } from '@/lib/save-export';

export type CalendarSharePayload = {
  type: CalendarItemType;
  title: string;
  date: string;
  allDay: boolean;
  startHour?: number;
  endHour?: number;
  color: string;
  icon?: string;
  notes?: string;
  location?: string;
  meetingLink?: string;
  reminder?: string;
  completed?: boolean;
  list?: string;
  assigneeName?: string;
  attachments: CalendarAttachment[];
  calendarName?: string;
};

const ICON_EMOJI: Record<string, string> = {
  'house.fill': '🏠',
  'car.fill': '🚗',
  'fuelpump.fill': '⛽',
  'fork.knife': '🍽️',
  'cart.fill': '🛒',
  'bag.fill': '🛍️',
  'cross.case.fill': '🩺',
  'figure.run': '🏃',
  'dumbbell.fill': '🏋️',
  'gamecontroller.fill': '🎮',
  'ticket.fill': '🎫',
  'person.2.fill': '👨‍👩‍👧',
  'heart.fill': '❤️',
  'bolt.fill': '⚡',
  wifi: '📶',
  'drop.fill': '💧',
  'phone.fill': '📱',
  'book.fill': '📚',
  'briefcase.fill': '💼',
  'bus.fill': '🚌',
  airplane: '✈️',
  'pawprint.fill': '🐾',
  'gift.fill': '🎁',
  'banknote.fill': '💵',
  'creditcard.fill': '💳',
  calendar: '📅',
  'checkmark.circle.fill': '✅',
};

export function calendarIconLabel(icon?: string) {
  const name = icon?.trim();
  if (!name) return '';
  const found = categoryIcons.find((item) => item.name === name);
  return found?.label ?? name;
}

export function calendarIconEmoji(icon?: string) {
  const name = icon?.trim();
  if (!name) return '📅';
  return ICON_EMOJI[name] ?? '📌';
}

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
    Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda, Ü: 0xdc, Ñ: 0xd1,
    á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa, ü: 0xfc, ñ: 0xf1,
    '¿': 0xbf, '¡': 0xa1, '°': 0xb0, '·': 0xb7, '•': 0x95,
    '–': 0x96, '—': 0x97, '…': 0x85,
    '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94,
  };
  return [...value]
    .map((char) => {
      if (map[char] != null) return String.fromCharCode(map[char]);
      const code = char.charCodeAt(0);
      if (code === 0xa0 || code === 0x202f || code === 0x2009) return ' ';
      return code <= 255 ? char : '-';
    })
    .join('');
}

function text(x: number, y: number, value: string, size = 10, font: 'F1' | 'F2' = 'F1') {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfEscape(toWinAnsi(value))}) Tj ET`;
}

function wrap(value: string, width: number) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

export function calendarWhenLabel(payload: CalendarSharePayload) {
  const day = formatDayLabel(parseDateKey(payload.date));
  if (payload.allDay) return `${day} · Todo el día`;
  const start = formatHour(payload.startHour);
  const end = formatHour(payload.endHour);
  if (start && end) return `${day} · ${start} – ${end}`;
  if (start) return `${day} · ${start}`;
  return day;
}

export function buildCalendarShareCaption(payload: CalendarSharePayload) {
  const type = typeLabels[payload.type];
  const lines = [
    'TecnoWallet',
    `${type.toUpperCase()}${payload.completed ? ' · Completado' : ''}`,
    payload.title.trim(),
    calendarWhenLabel(payload),
  ];
  if (payload.location?.trim()) lines.push(`Lugar: ${payload.location.trim()}`);
  if (payload.meetingLink?.trim()) lines.push(`Reunión: ${payload.meetingLink.trim()}`);
  if (payload.reminder?.trim()) lines.push(formatReminderLabel(payload.reminder));
  if (payload.assigneeName?.trim()) lines.push(`Con: ${payload.assigneeName.trim()}`);
  if (payload.list?.trim()) lines.push(payload.list.trim());
  if (payload.notes?.trim()) {
    lines.push('');
    lines.push(payload.notes.trim());
  }
  if (payload.attachments.length) {
    lines.push('');
    lines.push(
      payload.attachments.length === 1
        ? `Adjunto: ${payload.attachments[0].name}`
        : `Adjuntos: ${payload.attachments.map((item) => item.name).join(', ')}`,
    );
  }
  lines.push('');
  lines.push('Compartido desde TecnoWallet');
  return lines.join('\n');
}

function pdfRgb(hex: string) {
  const raw = hex.replace('#', '').trim();
  const value = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0');
  const n = Number.parseInt(value.slice(0, 6), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}`;
}

function jpegInfo(bytes: Uint8Array): { width: number; height: number; components: 1 | 3 } | null {
  if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < bytes.length - 9) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (marker === 0xd8) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    const size = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      const components = bytes[offset + 9];
      if (!width || !height) return null;
      return { width, height, components: components === 1 ? 1 : 3 };
    }
    offset += 2 + (size || 0);
  }
  return null;
}

type PdfPhoto = {
  bytes: Uint8Array;
  width: number;
  height: number;
  components: 1 | 3;
  name: string;
  uri: string;
};

function jpegXObject(photo: PdfPhoto) {
  const colorSpace = photo.components === 1 ? 'DeviceGray' : 'DeviceRGB';
  return concat([
    latin1(
      `<< /Type /XObject /Subtype /Image /Width ${photo.width} /Height ${photo.height} /ColorSpace /${colorSpace} /BitsPerComponent 8 /Filter /DCTDecode /Length ${photo.bytes.length} >>\nstream\n`,
    ),
    photo.bytes,
    latin1('\nendstream'),
  ]);
}

function assemblePdf(objects: Array<string | Uint8Array>) {
  const header = '%PDF-1.4\n';
  const parts: Uint8Array[] = [latin1(header)];
  const offsets = [0];
  let pos = header.length;
  objects.forEach((object, index) => {
    offsets.push(pos);
    const body =
      typeof object === 'string'
        ? latin1(`${index + 1} 0 obj\n${object}\nendobj\n`)
        : concat([latin1(`${index + 1} 0 obj\n`), object, latin1('\nendobj\n')]);
    parts.push(body);
    pos += body.length;
  });
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF`;
  parts.push(latin1(xref));
  return concat(parts);
}

export function buildCalendarSharePdf(payload: CalendarSharePayload, photos: PdfPhoto[] = []) {
  const NAVY = '0.031 0.071 0.165';
  const INK = '0.043 0.071 0.125';
  const MUTED = '0.40 0.45 0.52';
  const WHITE = '1 1 1';
  const GOLD = '0.96 0.77 0.09';
  const GREEN = '0.055 0.624 0.431';
  const accent = pdfRgb(payload.color || '#0878F9');
  const type = typeLabels[payload.type];
  const ops: string[] = [];
  const visiblePhotos = photos.slice(0, 2);

  ops.push(`${NAVY} rg 0 0 612 792 re f`);
  ops.push(`${accent} rg 0 732 612 60 re f`);
  ops.push(`${GOLD} rg 0 728 612 4 re f`);
  ops.push(`${WHITE} rg`);
  ops.push(text(40, 768, 'TECNOWALLET', 13, 'F2'));
  ops.push(text(40, 748, payload.calendarName?.trim() || 'Calendario', 10));

  ops.push(`${WHITE} rg 28 72 556 640 re f`);

  const iconKey = payload.icon || typeIcons[payload.type];
  const badgeSize = 46;
  const badgeX = 48;
  const badgeBottom = 626;
  ops.push(pdfRoundRect(badgeX, badgeBottom, badgeSize, badgeSize, 13, '0.90 0.94 1.00'));
  ops.push(pdfCategoryIcon(iconKey, badgeX + 7, badgeBottom + 7, 32, accent));

  ops.push(`${accent} rg`);
  ops.push(text(badgeX + badgeSize + 14, 658, type.toUpperCase(), 9, 'F2'));
  let y = 640;
  if (payload.completed) {
    ops.push(`${GREEN} rg`);
    ops.push(text(badgeX + badgeSize + 14, y, 'COMPLETADO', 9, 'F2'));
    y = badgeBottom - 18;
  } else {
    y = badgeBottom - 18;
  }
  ops.push(`${INK} rg`);
  wrap(payload.title.trim() || type, 34).forEach((line) => {
    ops.push(text(48, y, line, 22, 'F2'));
    y -= 26;
  });
  y -= 6;
  ops.push(`${MUTED} rg 48 ${y} 80 2 re f`);
  y -= 28;

  const rows: Array<[string, string]> = [
    ['Cuando', calendarWhenLabel(payload)],
    ['Calendario', payload.list?.trim() || payload.calendarName?.trim() || 'Mi calendario'],
  ];
  if (payload.location?.trim()) rows.push(['Lugar', payload.location.trim()]);
  if (payload.meetingLink?.trim()) rows.push(['Link', payload.meetingLink.trim()]);
  if (payload.reminder?.trim()) rows.push(['Aviso', formatReminderLabel(payload.reminder)]);
  if (payload.assigneeName?.trim()) rows.push(['Con', payload.assigneeName.trim()]);

  rows.forEach(([label, value]) => {
    ops.push(`${MUTED} rg`);
    ops.push(text(48, y, label.toUpperCase(), 8, 'F2'));
    ops.push(`${INK} rg`);
    wrap(value, 48).forEach((line, index) => {
      ops.push(text(140, y - index * 13, line, 11));
    });
    y -= 13 * Math.max(wrap(value, 48).length, 1) + 10;
  });

  if (payload.notes?.trim()) {
    y -= 8;
    ops.push(`${MUTED} rg`);
    ops.push(text(48, y, 'DETALLES', 8, 'F2'));
    y -= 16;
    ops.push(`${INK} rg`);
    wrap(payload.notes.trim(), 58).slice(0, 8).forEach((line) => {
      ops.push(text(48, y, line, 11));
      y -= 14;
    });
  }

  visiblePhotos.forEach((photo, index) => {
    const maxW = 516;
    const maxH = index === 0 ? 230 : 150;
    const floor = 118;
    const scale = Math.min(maxW / photo.width, maxH / photo.height, 1);
    let drawW = photo.width * scale;
    let drawH = photo.height * scale;
    if (y - drawH < floor) {
      const fit = Math.max(y - floor, 80);
      const shrink = fit / drawH;
      drawW *= shrink;
      drawH *= shrink;
    }
    if (drawH < 48) return;
    y -= 12;
    const imgBottom = y - drawH;
    ops.push('q');
    ops.push(`${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} 48 ${imgBottom.toFixed(2)} cm`);
    ops.push(`/Im${index + 1} Do`);
    ops.push('Q');
    y = imgBottom - 8;
    ops.push(`${MUTED} rg`);
    ops.push(text(48, y, photo.name.slice(0, 60), 8));
    y -= 16;
  });

  const extraFiles = payload.attachments.filter(
    (item) => !visiblePhotos.some((photo) => photo.uri === item.uri),
  );
  if (extraFiles.length) {
    y -= 6;
    ops.push(`${MUTED} rg`);
    ops.push(text(48, y, 'ARCHIVOS', 8, 'F2'));
    y -= 16;
    ops.push(`${INK} rg`);
    extraFiles.forEach((item) => {
      ops.push(text(48, y, `- ${item.name}`.slice(0, 62), 11));
      y -= 14;
    });
  }

  ops.push(`${MUTED} rg`);
  ops.push(text(48, 92, 'Diseño TecnoWallet  ·  comparte el plan con tu gente', 8));
  const content = latin1(ops.join('\n'));

  const xObjects = visiblePhotos
    .map((_, index) => `/Im${index + 1} ${7 + index} 0 R`)
    .join(' ');
  const xObjectRes = xObjects ? ` /XObject << ${xObjects} >>` : '';

  const objects: Array<string | Uint8Array> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${xObjectRes} >> /Contents 4 0 R >>`,
    concat([
      latin1(`<< /Length ${content.length} >>\nstream\n`),
      content,
      latin1('\nendstream'),
    ]),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    ...visiblePhotos.map(jpegXObject),
  ];
  return assemblePdf(objects);
}

function wrapCanvas(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
  maxLines = 6,
) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (!lines.length) return [''];
  if (lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[maxLines - 1] = `${clipped[maxLines - 1].replace(/…$/, '')}…`;
  return clipped;
}

async function pngFromCanvas(payload: CalendarSharePayload): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const width = 1080;
  const height = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const accent = payload.color || '#0878F9';
  const inner = width - 184;
  const iconKey = payload.icon || typeIcons[payload.type];

  const round = (x: number, y: number, w: number, h: number, r: number) => {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  ctx.fillStyle = '#071226';
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createLinearGradient(0, 0, width, 520);
  glow.addColorStop(0, accent);
  glow.addColorStop(0.55, '#0B1D3A');
  glow.addColorStop(1, '#071226');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, 420);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(width - 40, 40, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#F5C518';
  ctx.fillRect(0, 420, width, 8);

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText('TECNOWALLET', 72, 88);
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(payload.calendarName?.trim() || 'Calendario', 72, 126);

  round(72, 168, 88, 88, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fill();
  ctx.font = '48px system-ui, Apple Color Emoji, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(calendarIconEmoji(iconKey), 116, 228);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText(calendarIconLabel(iconKey), 180, 204);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText(typeLabels[payload.type], 180, 234);

  ctx.fillStyle = '#FFFFFF';
  round(40, 280, width - 80, height - 360, 40);
  ctx.fill();

  let y = 348;
  ctx.fillStyle = accent;
  ctx.font = '800 20px system-ui, sans-serif';
  ctx.fillText(typeLabels[payload.type].toUpperCase(), 92, y);
  y += 28;
  if (payload.completed) {
    ctx.fillStyle = '#0E9F6E';
    round(92, y, 176, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('COMPLETADO', 118, y + 27);
    y += 60;
  } else {
    y += 16;
  }

  ctx.fillStyle = '#0B1220';
  ctx.font = '800 52px system-ui, sans-serif';
  const title = payload.title.trim() || typeLabels[payload.type];
  wrapCanvas(ctx, title, inner, 3).forEach((line) => {
    ctx.fillText(line, 92, y);
    y += 62;
  });
  ctx.fillStyle = '#F5C518';
  round(92, y, 72, 8, 4);
  ctx.fill();
  y += 48;

  const meta = [
    ['📅', calendarWhenLabel(payload)],
    payload.location?.trim() ? ['📍', payload.location.trim()] : null,
    payload.reminder ? ['🔔', formatReminderLabel(payload.reminder)] : null,
    payload.assigneeName?.trim() ? ['👤', `Con ${payload.assigneeName.trim()}`] : null,
    payload.meetingLink?.trim() ? ['🔗', payload.meetingLink.trim()] : null,
  ].filter(Boolean) as Array<[string, string]>;
  meta.forEach(([mark, line]) => {
    ctx.font = '600 24px system-ui, sans-serif';
    const parts = wrapCanvas(ctx, line, inner - 48, 2);
    ctx.fillStyle = '#6B7C8F';
    ctx.fillText(mark, 92, y);
    ctx.fillStyle = '#3E4C59';
    parts.forEach((part, index) => {
      ctx.fillText(part, 140, y + index * 32);
    });
    y += 32 * parts.length + 10;
  });

  if (payload.notes?.trim()) {
    y += 8;
    ctx.font = '500 24px system-ui, sans-serif';
    const noteLines = wrapCanvas(ctx, payload.notes.trim(), inner - 48, 5);
    const boxH = 36 + noteLines.length * 34 + 20;
    ctx.fillStyle = '#F3F7FC';
    round(92, y, inner, boxH, 22);
    ctx.fill();
    ctx.fillStyle = '#6B7C8F';
    ctx.font = '800 14px system-ui, sans-serif';
    ctx.fillText('DETALLES', 116, y + 32);
    ctx.fillStyle = '#0B1220';
    ctx.font = '500 24px system-ui, sans-serif';
    let noteY = y + 68;
    noteLines.forEach((line) => {
      ctx.fillText(line, 116, noteY);
      noteY += 34;
    });
    y += boxH + 20;
  }

  const photo = payload.attachments.find(isImageAttachment);
  if (photo) {
    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('image'));
        image.src = photo.uri;
      });
      const boxH = 300;
      round(92, y, inner, boxH, 24);
      ctx.save();
      ctx.clip();
      const scale = Math.max(inner / image.width, boxH / image.height);
      const dw = image.width * scale;
      const dh = image.height * scale;
      ctx.drawImage(image, 92 + (inner - dw) / 2, y + (boxH - dh) / 2, dw, dh);
      ctx.restore();
      y += boxH + 20;
    } catch {
      // Photo stays listed as an attached file.
    }
  }

  const listed = payload.attachments.filter((item) => item !== photo);
  listed.slice(0, 4).forEach((item) => {
    ctx.fillStyle = '#EAF2FF';
    round(92, y, inner, 56, 16);
    ctx.fill();
    ctx.fillStyle = '#0B1220';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(`📎  ${item.name.slice(0, 34)}`, 116, y + 36);
    y += 68;
  });
  if (listed.length > 4) {
    ctx.fillStyle = '#6B7C8F';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(`+${listed.length - 4} archivos más`, 92, y + 8);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('Compartido desde TecnoWallet', 72, height - 48);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), 'image/png', 0.95),
  );
  return blob;
}

function safeFileName(title: string) {
  const base = title.trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 40);
  return base || 'tecnowallet-evento';
}

function decodeBase64(value: string) {
  const binary =
    typeof atob === 'function'
      ? atob(value)
      : (globalThis as { Buffer?: { from: (input: string, enc: string) => { toString: (enc: string) => string } } })
          .Buffer?.from(value, 'base64')
          .toString('binary') ?? '';
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function bytesFromUri(uri: string): Promise<Uint8Array | null> {
  try {
    if (/^(https?:|blob:|data:)/i.test(uri)) {
      const response = await fetch(uri);
      if (!response.ok) return null;
      return new Uint8Array(await response.arrayBuffer());
    }
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const bytes = decodeBase64(base64);
      if (bytes.length) return bytes;
    } catch {
      // Some iOS uris still work with fetch.
    }
    const response = await fetch(uri);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadPdfPhotos(attachments: CalendarAttachment[]): Promise<PdfPhoto[]> {
  const photos: PdfPhoto[] = [];
  for (const item of attachments.filter(isImageAttachment).slice(0, 2)) {
    const bytes = await bytesFromUri(item.uri);
    if (!bytes) continue;
    const info = jpegInfo(bytes);
    if (!info) continue;
    photos.push({ ...info, bytes, name: item.name, uri: item.uri });
  }
  return photos;
}

async function shareFilesOnWeb(payload: CalendarSharePayload, png: Blob | null) {
  const files: File[] = [];
  if (png) {
    files.push(new File([png], `${safeFileName(payload.title)}.png`, { type: 'image/png' }));
  }
  for (const item of payload.attachments) {
    try {
      const response = await fetch(item.uri);
      if (!response.ok) continue;
      const blob = await response.blob();
      files.push(
        new File([blob], item.name, {
          type: blob.type || item.mimeType || 'application/octet-stream',
        }),
      );
    } catch {
      // Skip unreadables; the card still lists them.
    }
  }
  const caption = buildCalendarShareCaption(payload);
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const withFiles = { title: payload.title, text: caption, files };
    const textOnly = { title: payload.title, text: caption };
    try {
      if (files.length && (!navigator.canShare || navigator.canShare(withFiles))) {
        await navigator.share(withFiles);
        return;
      }
      await navigator.share(textOnly);
      return;
    } catch (error) {
      if (/cancel|abort|denied/i.test(String(error))) return;
    }
  }
  if (png) {
    const url = URL.createObjectURL(png);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFileName(payload.title)}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
      URL.revokeObjectURL(url);
    }, 800);
  }
}

async function shareOnNative(payload: CalendarSharePayload) {
  const photos = await loadPdfPhotos(payload.attachments);
  const pdf = buildCalendarSharePdf(payload, photos);
  await saveExportFile({
    bytes: pdf,
    filename: `${safeFileName(payload.title)}.pdf`,
    mime: 'application/pdf',
  });
}

export async function shareCalendarItem(payload: CalendarSharePayload) {
  const caption = buildCalendarShareCaption(payload);
  try {
    if (Platform.OS === 'web') {
      const png = await pngFromCanvas(payload);
      await shareFilesOnWeb(payload, png);
      return;
    }
    await shareOnNative(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/cancel|abort|dismiss/i.test(message)) return;
    try {
      await Share.share({ message: caption, title: payload.title });
    } catch {
      Alert.alert('No se pudo compartir', 'Inténtalo de nuevo.');
    }
  }
}
