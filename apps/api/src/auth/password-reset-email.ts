const BRAND = {
  primary: '#0878F9',
  primarySoft: '#EAF3FF',
  ink: '#0F172A',
  muted: '#64748B',
  surface: '#FFFFFF',
  page: '#F1F5F9',
  border: '#E2E8F0',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function passwordResetEmailSubject(createPassword = false) {
  return createPassword
    ? 'Crea una contraseña para TecnoWallet'
    : 'Restablece tu contraseña de TecnoWallet';
}

export function passwordResetEmailHtml(input: {
  resetLink: string;
  name?: string;
  createPassword?: boolean;
}) {
  const link = escapeHtml(input.resetLink);
  const greeting = input.name?.trim()
    ? `Hola ${escapeHtml(input.name.trim())},`
    : 'Hola,';
  const createPassword = Boolean(input.createPassword);
  const title = createPassword
    ? 'Crea una contraseña'
    : 'Restablece tu contraseña';
  const body = createPassword
    ? `${greeting} tu cuenta entra con Google o Apple, pero puedes crear una contraseña para iniciar sesión con correo. El enlace caduca en 15 minutos:`
    : `${greeting} recibimos una solicitud para cambiar la contraseña de tu cuenta. Pulsa el botón (válido 15 minutos):`;
  const cta = createPassword ? 'Crear contraseña' : 'Cambiar contraseña';

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
    ${escapeHtml(title)}. El enlace caduca en 15 minutos.
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
                      Seguridad
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:20px;padding:28px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${BRAND.primary};">
                Contraseña
              </p>
              <h1 style="margin:0 0 12px 0;font-size:24px;line-height:1.25;color:${BRAND.ink};font-weight:800;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.55;color:${BRAND.muted};">
                ${body}
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px 0;">
                <tr>
                  <td align="center" bgcolor="${BRAND.primary}" style="border-radius:14px;">
                    <a href="${link}" style="display:inline-block;padding:14px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                      ${escapeHtml(cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 10px 0;font-size:13px;line-height:1.5;color:${BRAND.muted};">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 18px 0;font-size:12px;line-height:1.5;word-break:break-all;color:${BRAND.primary};">
                ${link}
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${BRAND.muted};">
                Caduca en 15 minutos. Si no pediste este cambio, ignora este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
