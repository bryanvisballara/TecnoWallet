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
      <h1 style="margin:0 0 16px;font-size:22px;">Tu comisión ya fue pagada</h1>
      <p style="margin:0 0 16px;line-height:1.5;">Hola ${escapeHtml(input.name)}, transferimos tu comisión de afiliado en USDT.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
        <tr><td style="padding:8px 0;color:#667085;">Monto</td><td style="padding:8px 0;text-align:right;font-weight:700;">${escapeHtml(input.amount)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Red</td><td style="padding:8px 0;text-align:right;">USDT ${escapeHtml(input.network)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Wallet</td><td style="padding:8px 0;text-align:right;word-break:break-all;font-size:12px;">${escapeHtml(input.address)}</td></tr>
        <tr><td style="padding:8px 0;color:#667085;">Periodo</td><td style="padding:8px 0;text-align:right;">${escapeHtml(input.period)}</td></tr>
      </table>
      <p style="margin:0 0 12px;line-height:1.5;color:#344054;">
        ${input.hasProof ? 'Adjuntamos el comprobante de la transferencia.' : 'El pago quedó registrado en TecnoWallet.'}
        Tu saldo de este periodo queda en <strong>USD 0.00</strong>. Las comisiones nuevas se acumulan para el próximo día 15.
      </p>
      <p style="margin:0;font-size:12px;color:#98A2B3;">Los pagos se hacen un solo día al mes (día 15), con mínimo de desembolso de USD 100.</p>
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
