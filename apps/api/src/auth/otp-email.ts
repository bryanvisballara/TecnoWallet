export type OtpEmailPurpose = 'verify' | 'delete';

const BRAND = {
  primary: '#0878F9',
  primarySoft: '#EAF3FF',
  ink: '#0F172A',
  muted: '#64748B',
  surface: '#FFFFFF',
  page: '#F1F5F9',
  danger: '#F04438',
  dangerSoft: '#FEE4E2',
  border: '#E2E8F0',
};

type TemplateCopy = {
  preheader: string;
  eyebrow: string;
  title: string;
  body: string;
  codeLabel: string;
  footer: string;
  accent: string;
  accentSoft: string;
  badge: string;
};

function copyFor(purpose: OtpEmailPurpose, code: string): TemplateCopy {
  if (purpose === 'delete') {
    return {
      preheader: `Código ${code} para eliminar tu cuenta TecnoWallet`,
      eyebrow: 'Seguridad de cuenta',
      title: 'Confirma la eliminación',
      body: 'Recibimos una solicitud para eliminar tu cuenta TecnoWallet de forma permanente. Usa este código para continuar:',
      codeLabel: 'Código de confirmación',
      footer:
        'Caduca en 15 minutos. Si no pediste eliminar tu cuenta, ignora este correo y tu cuenta seguirá activa.',
      accent: BRAND.danger,
      accentSoft: BRAND.dangerSoft,
      badge: 'Eliminación',
    };
  }
  return {
    preheader: `Tu código TecnoWallet es ${code}`,
    eyebrow: 'Bienvenido a TecnoWallet',
    title: 'Verifica tu correo',
    body: 'Estás a un paso de activar tu cuenta. Ingresa este código en la app para confirmar tu correo:',
    codeLabel: 'Código de verificación',
    footer:
      'Caduca en 15 minutos. Si no creaste una cuenta en TecnoWallet, puedes ignorar este correo.',
    accent: BRAND.primary,
    accentSoft: BRAND.primarySoft,
    badge: 'Verificación',
  };
}

export function otpEmailSubject(purpose: OtpEmailPurpose, code: string) {
  return purpose === 'delete'
    ? `${code} confirma la eliminación de tu cuenta TecnoWallet`
    : `${code} es tu código de verificación TecnoWallet`;
}

/** Branded, email-client-safe HTML for OTP messages. */
export function otpEmailHtml(purpose: OtpEmailPurpose, code: string) {
  const copy = copyFor(purpose, code);
  const digits = code.split('').join('&nbsp;');

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
    ${copy.preheader}
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
                    <span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${copy.accentSoft};color:${copy.accent};font-size:12px;font-weight:700;letter-spacing:0.3px;">
                      ${copy.badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(15,23,42,0.06);">
              <div style="height:6px;background:linear-gradient(90deg,${copy.accent} 0%,${BRAND.primary} 100%);"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 28px 8px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${copy.accent};">
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
                  <td style="padding:22px 28px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${copy.accentSoft};border-radius:18px;">
                      <tr>
                        <td align="center" style="padding:22px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                          <p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase;color:${copy.accent};">
                            ${copy.codeLabel}
                          </p>
                          <p style="margin:0;font-size:36px;line-height:1.1;font-weight:800;letter-spacing:10px;color:${BRAND.ink};font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">
                            ${digits}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 28px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
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
