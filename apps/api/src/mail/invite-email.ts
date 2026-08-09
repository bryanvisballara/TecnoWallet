export type InviteKind = 'recaudo' | 'workspace' | 'calendar';

const BRAND = {
  primary: '#0878F9',
  primarySoft: '#EAF3FF',
  ink: '#0F172A',
  muted: '#64748B',
  surface: '#FFFFFF',
  page: '#F1F5F9',
  border: '#E2E8F0',
  success: '#12B76A',
  successSoft: '#D1FADF',
};

export type InviteEmailInput = {
  kind: InviteKind;
  resourceName: string;
  acceptLink: string;
  inviterName?: string;
  roleLabel?: string;
  /** When the invitee does not have an account yet. */
  pendingSignup?: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function copyFor(input: InviteEmailInput) {
  const name = escapeHtml(input.resourceName.trim() || 'TecnoWallet');
  const who = input.inviterName?.trim()
    ? escapeHtml(input.inviterName.trim())
    : 'Alguien';
  const role = input.roleLabel?.trim()
    ? escapeHtml(input.roleLabel.trim())
    : undefined;

  if (input.kind === 'workspace') {
    return {
      badge: 'Libro',
      eyebrow: 'Invitación a un libro',
      title: input.pendingSignup
        ? `Únete a “${name}”`
        : `Te agregaron a “${name}”`,
      body: input.pendingSignup
        ? `${who} te invitó a colaborar en el libro <strong>${name}</strong> de TecnoWallet. Crea tu cuenta (o inicia sesión) para aceptar.`
        : `${who} te agregó al libro <strong>${name}</strong>${
            role ? ` como <strong>${role}</strong>` : ''
          }. Entra a TecnoWallet para verlo.`,
      cta: input.pendingSignup ? 'Crear cuenta y unirme' : 'Abrir TecnoWallet',
      footer:
        'Si no esperabas esta invitación, puedes ignorar este correo.',
    };
  }

  if (input.kind === 'calendar') {
    return {
      badge: 'Calendario',
      eyebrow: 'Invitación a calendario',
      title: `Te invitaron a “${name}”`,
      body: `${who} te compartió el calendario <strong>${name}</strong>${
        role ? ` (${role})` : ''
      }. Ábrelo en TecnoWallet para ver eventos y fechas importantes.`,
      cta: 'Ver calendario',
      footer:
        'Si no reconoces esta invitación, ignora este mensaje.',
    };
  }

  return {
    badge: 'Recaudo',
    eyebrow: 'Invitación a recaudo',
    title: `Únete a “${name}”`,
    body: `${who} te invitó a colaborar en el recaudo <strong>${name}</strong>. Acepta la invitación para aportar y seguir el progreso del pozo.`,
    cta: 'Aceptar invitación',
    footer:
      'El enlace puede caducar. Si no pediste unirte a este recaudo, ignora este correo.',
  };
}

export function inviteEmailSubject(input: InviteEmailInput) {
  const name = input.resourceName.trim() || 'TecnoWallet';
  if (input.kind === 'workspace') {
    return input.pendingSignup
      ? `Te invitaron al libro “${name}” en TecnoWallet`
      : `Te agregaron al libro “${name}” en TecnoWallet`;
  }
  if (input.kind === 'calendar') {
    return `Te compartieron el calendario “${name}” en TecnoWallet`;
  }
  return `Invitación al recaudo “${name}” en TecnoWallet`;
}

/** Branded HTML invite — same visual language as OTP emails. */
export function inviteEmailHtml(input: InviteEmailInput) {
  const copy = copyFor(input);
  const link = escapeHtml(input.acceptLink);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>TecnoWallet</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${copy.title}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.page};padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td style="padding:0 8px 18px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.1;font-weight:700;color:${BRAND.ink};letter-spacing:-0.5px;">
                    Tecno<span style="color:${BRAND.primary};">Wallet</span>
                  </td>
                  <td align="right" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${BRAND.primarySoft};color:${BRAND.primary};font-size:12px;font-weight:700;letter-spacing:0.3px;">
                      ${copy.badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
              <div style="height:6px;background:linear-gradient(90deg,${BRAND.primary} 0%,${BRAND.success} 100%);"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 28px 8px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${BRAND.primary};">
                      ${copy.eyebrow}
                    </p>
                    <h1 style="margin:0 0 12px 0;font-size:26px;line-height:1.25;font-weight:750;color:${BRAND.ink};">
                      ${copy.title}
                    </h1>
                    <p style="margin:0;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                      ${copy.body}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 28px;" align="center">
                    <a href="${link}" style="display:inline-block;padding:14px 28px;border-radius:14px;background:${BRAND.primary};color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">
                      ${copy.cta}
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 12px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.primarySoft};border-radius:14px;">
                      <tr>
                        <td style="padding:14px 16px;font-size:12px;line-height:1.5;color:${BRAND.muted};word-break:break-all;">
                          Si el botón no funciona, copia este enlace:<br />
                          <a href="${link}" style="color:${BRAND.primary};font-weight:600;">${link}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0;font-size:13px;line-height:1.55;color:${BRAND.muted};">
                      ${copy.footer}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};">
              Finanzas claras, en un solo lugar.<br />
              © TecnoWallet
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
