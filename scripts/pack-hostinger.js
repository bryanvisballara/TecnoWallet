const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'apps/mobile/dist');
const hostDir = path.join(root, 'HOST');
const staging = path.join(hostDir, '.public_html');
const zipPath = path.join(hostDir, 'tecnowallet-public-html.zip');

if (!fs.existsSync(dist)) {
  console.error('Missing apps/mobile/dist. Run expo export --platform web first.');
  process.exit(1);
}

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });
fs.cpSync(dist, staging, { recursive: true });

const htaccess = `DirectoryIndex index.html
RewriteEngine On
RewriteBase /
RewriteRule ^index\\.html$ - [L]
# Mercado Pago return used to hit /recaudos?mp=… on tecnowallet.app.
RewriteCond %{QUERY_STRING} (^|&)(mp|payment_id|collection_id|collection_status)=
RewriteRule ^recaudos/?$ /mp-wallet.html [L]
# Google OAuth — physical files (Hostinger SPA rewrite is often off).
RewriteRule ^oauth-google/?$ /oauth-google.html [L]
RewriteRule ^oauth-google-callback/?$ /oauth-google-callback.html [L]
# Legal pages (App Store / in-app links)
RewriteRule ^privacy/?$ /privacy.html [L]
RewriteRule ^terms/?$ /terms.html [L]
RewriteRule ^support/?$ /support.html [L]
# Old collaboration emails used /invite.html?token=… (Unmatched in Expo Router).
RewriteCond %{QUERY_STRING} (^|&)token=
RewriteRule ^invite\\.html$ /colaborar/? [R=302,L,QSA]
RewriteCond %{QUERY_STRING} (^|&)token=
RewriteRule ^invite/?$ /colaborar/? [R=302,L,QSA]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
`;
fs.writeFileSync(path.join(staging, '.htaccess'), htaccess);

function writePhysical(routeBaseName, html) {
  fs.writeFileSync(path.join(staging, `${routeBaseName}.html`), html);
  const dir = path.join(staging, routeBaseName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

/** Standalone Google OAuth pages — no Expo bundle. Hostinger 404s SPA routes. */
function writeGoogleOauthPages() {
  const clientId = (
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID_WEB ||
    ''
  ).trim();
  const origin = (
    process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://tecnowallet.app'
  ).replace(/\/+$/, '');
  const callback = `${origin}/oauth-google-callback/`;

  const startHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TecnoWallet</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh;
      align-items: center; justify-content: center; margin: 0; color: #3E4C59;
      background: #F5F7FB; }
  </style>
</head>
<body>
  <p id="msg">Conectando con Google…</p>
  <script>
    (function () {
      var clientId = ${JSON.stringify(clientId)};
      var callback = ${JSON.stringify(callback)};
      if (!clientId) {
        document.getElementById('msg').textContent = 'Google Sign-In no está configurado.';
        return;
      }
      var params = new URLSearchParams(window.location.search);
      var nonce = params.get('nonce') || Math.random().toString(36).slice(2) + Date.now().toString(36);
      var native = params.get('native') === '1';
      try {
        sessionStorage.setItem('tw-google-nonce', nonce);
        sessionStorage.setItem('tw-google-native', native ? '1' : '0');
      } catch (e) {}
      var url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set('client_id', clientId);
      url.searchParams.set('redirect_uri', callback);
      url.searchParams.set('response_type', 'id_token');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('nonce', nonce);
      url.searchParams.set('prompt', 'select_account');
      url.searchParams.set('state', native ? 'native' : 'web');
      window.location.replace(url.toString());
    })();
  </script>
</body>
</html>
`;

  const callbackHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TecnoWallet</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; min-height: 100vh;
      align-items: center; justify-content: center; margin: 0; color: #3E4C59;
      background: #F5F7FB; }
  </style>
</head>
<body>
  <p id="msg">Completando inicio de sesión…</p>
  <script>
    (function () {
      var raw = window.location.href;
      var hashIndex = raw.indexOf('#');
      var queryIndex = raw.indexOf('?');
      var hash = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
      var query = queryIndex >= 0 ? raw.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '';
      var params = new URLSearchParams(hash || query);
      var token = (params.get('id_token') || '').trim();
      var err = params.get('error_description') || params.get('error');
      if (!token) {
        document.getElementById('msg').textContent = err || 'Google no devolvió un token.';
        return;
      }
      var native = params.get('state') === 'native';
      try {
        native = native || sessionStorage.getItem('tw-google-native') === '1';
        sessionStorage.setItem('tw-google-id-token', token);
        sessionStorage.removeItem('tw-google-native');
      } catch (e) {}
      if (native) {
        window.location.replace('tecnowallet://oauthredirect?id_token=' + encodeURIComponent(token));
        return;
      }
      window.location.replace('/auth.html');
    })();
  </script>
</body>
</html>
`;

  writePhysical('oauth-google', startHtml);
  writePhysical('oauth-google-callback', callbackHtml);
}

writeGoogleOauthPages();

function writeMercadoPagoReturnPage() {
  const api = (
    process.env.EXPO_PUBLIC_API_URL || 'https://tecnowallet.onrender.com/api/v1'
  ).replace(/\/+$/, '');
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Wallet digital comprada</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f7fb; color: #0b1d3a; }
    main { max-width: 420px; margin: 12vh auto; padding: 28px 22px; background: #fff; border-radius: 24px; box-shadow: 0 12px 40px rgba(11,29,58,.08); }
    h1 { font-size: 28px; margin: 0 0 12px; letter-spacing: -.4px; }
    p { font-size: 16px; line-height: 1.45; color: #4a5a73; }
  </style>
</head>
<body>
  <main>
    <h1 id="title">Wallet digital comprada</h1>
    <p id="body">Tu wallet digital TecnoWallet ya está lista. Vuelve a la app para verificar tu identidad y empezar a recibir aportes.</p>
  </main>
  <script>
    (function () {
      var api = ${JSON.stringify(api + '/payments/wallet-return')};
      var params = new URLSearchParams(window.location.search);
      var status = (params.get('collection_status') || params.get('status') || params.get('mp') || '').toLowerCase();
      var result = (status === 'pending' || status === 'in_process') ? 'pending'
        : (status === 'failure' || status === 'rejected' || status === 'null') ? 'failure'
        : 'success';
      if (result === 'pending') {
        document.getElementById('title').textContent = 'Pago en revisión';
        document.getElementById('body').textContent = 'Mercado Pago todavía está confirmando el pago. Vuelve a la app de TecnoWallet en unos segundos.';
      } else if (result === 'failure') {
        document.getElementById('title').textContent = 'No se completó la compra';
        document.getElementById('body').textContent = 'El pago no se completó. Vuelve a la app y pulsa Comprar wallet para intentarlo de nuevo.';
      }
      if (!params.get('result')) params.set('result', result);
      fetch(api + '?' + params.toString(), { mode: 'no-cors' }).catch(function () {});
    })();
  </script>
</body>
</html>
`;
  writePhysical('mp-wallet', html);
}

/** Physical directory index so Hostinger deep-links work without relying on SPA rewrite. */
function ensureDirIndex(routeBaseName) {
  const htmlFile = path.join(staging, `${routeBaseName}.html`);
  if (!fs.existsSync(htmlFile)) return;
  const dir = path.join(staging, routeBaseName);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(htmlFile, path.join(dir, 'index.html'));
}

ensureDirIndex('colaborar');
ensureDirIndex('restablecer');
ensureDirIndex('auth');
ensureDirIndex('recaudos');
writeMercadoPagoReturnPage();

// Backward-compat stubs for emails already sent with invite.html?token=…
const redirectStub = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TecnoWallet</title>
  <script>
    (function () {
      var q = window.location.search || '';
      if (!q && window.location.hash.indexOf('token=') !== -1) {
        q = '?' + window.location.hash.replace(/^#/, '');
      }
      window.location.replace('/colaborar/' + q);
    })();
  </script>
</head>
<body>Redirigiendo a la invitación…</body>
</html>
`;
fs.writeFileSync(path.join(staging, 'invite.html'), redirectStub);
fs.mkdirSync(path.join(staging, 'invite'), { recursive: true });
// Only write invite/index.html if it would not block invite/[token].html.
// Directory listing /invite/ gets the stub; /invite/TOKEN still serves [token].html.
fs.writeFileSync(path.join(staging, 'invite', 'index.html'), redirectStub);

for (const legalPage of ['privacy.html', 'support.html', 'terms.html']) {
  const source = path.join(hostDir, legalPage);
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, path.join(staging, legalPage));
    ensureDirIndex(legalPage.replace(/\.html$/, ''));
  }
}

fs.mkdirSync(hostDir, { recursive: true });
fs.rmSync(zipPath, { force: true });
execSync(`cd "${staging}" && zip -r "${zipPath}" . -x "*.DS_Store"`, { stdio: 'inherit' });

// Keep an unpacked public_html mirror in sync with the zip (for local checks / FTP).
const publicHtml = path.join(hostDir, 'tecnowallet-public-html');
fs.rmSync(publicHtml, { recursive: true, force: true });
fs.cpSync(staging, publicHtml, { recursive: true });

fs.rmSync(staging, { recursive: true, force: true });

const readme = `# HOST — Frontend Hostinger

Esta carpeta es **siempre** el paquete del front para Hostinger (\`public_html\`).

## Archivo a subir

- \`${path.basename(zipPath)}\` → descomprime su contenido en \`public_html\` (no subas la carpeta HOST entera).

## Regenerar

Desde la raíz del monorepo:

\`\`\`bash
EXPO_PUBLIC_API_URL=https://TU-API.onrender.com/api/v1 yarn export:host
\`\`\`

El export usa el build estático de Expo web (\`apps/mobile\`) y añade \`.htaccess\` para rutas SPA.
`;
fs.writeFileSync(path.join(hostDir, 'README.md'), readme);
console.log(`Created ${zipPath}`);
