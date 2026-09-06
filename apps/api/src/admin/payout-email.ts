export function affiliatePayoutEmailHtml(input: {
  name: string;
  amount: string;
  network: string;
  address: string;
  period: string;
  hasProof: boolean;
}) {
  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#0B1F4A;margin:0;padding:24px;color:#12357A;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;color:#0878F9;font-weight:700;">TECNOWALLET</p>
      <h1 style="margin:0 0 16px;font-size:22px;">Tu remuneración ya fue pagada</h1>
      <p style="margin:0 0 16px;line-height:1.5;">Hola ${escapeHtml(input.name)}, transferimos tu remuneración de afiliado en USDT.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tr><td style="padding:8px 0;color:#667085;">Monto</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(input.amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Red</td><td style="padding:8px 0;text-align:right;">USDT ${escapeHtml(input.network)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Wallet</td><td style="padding:8px 0;text-align:right;word-break:break-all;font-size:12px;">${escapeHtml(input.address)}</td></tr>
      </table>
      <p style="margin:0 0 12px;line-height:1.5;color:#344054;">
        ${input.hasProof ? 'Adjuntamos el comprobante de la transferencia.' : 'El pago quedó registrado en TecnoWallet.'}
        Tu saldo pendiente queda en <strong>USD 0.00</strong>. Las conversiones nuevas se acumulan para cuando vuelvas a solicitar el pago.
      </p>
      <p style="margin:0;font-size:12px;color:#98A2B3;">Mínimo para solicitar un pago: USD 100, con wallet USDT registrada.</p>
    </div>
  </body>
</html>`;
}

export function affiliatePayoutRequestEmailHtml(input: {
  name: string;
  code: string;
  email: string;
  amount: string;
  network?: string;
  address?: string;
}) {
  return `<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;background:#0B1F4A;margin:0;padding:24px;color:#12357A;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:1px;color:#0878F9;font-weight:700;">TECNOWALLET</p>
      <h1 style="margin:0 0 16px;font-size:22px;">Solicitud de pago de afiliado</h1>
      <p style="margin:0 0 16px;line-height:1.5;">${escapeHtml(input.name)} pidió el pago de su remuneración.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tr><td style="padding:8px 0;color:#667085;">Afiliado</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(input.name)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Código</td><td style="padding:8px 0;text-align:right;">${escapeHtml(input.code)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Correo</td><td style="padding:8px 0;text-align:right;">${escapeHtml(input.email)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Monto</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(input.amount)}</td></tr>
        ${
          input.network && input.address
            ? `<tr><td style="padding:8px 0;color:#667085;">Wallet</td><td style="padding:8px 0;text-align:right;word-break:break-all;font-size:12px;">USDT ${escapeHtml(input.network)} · ${escapeHtml(input.address)}</td></tr>`
            : ''
        }
      </table>
      <p style="margin:0;font-size:12px;color:#98A2B3;">Márcalo como pagado en Portal admin → Afiliados → Pagos cuando hagas la transferencia.</p>
    </div>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
