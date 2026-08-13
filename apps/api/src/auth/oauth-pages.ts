export function googleOauthStartHtml(clientId: string, callback: string) {
  return `<!DOCTYPE html>
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
      var ret = params.get('return') || '';
      try {
        sessionStorage.setItem('tw-google-nonce', nonce);
        sessionStorage.setItem('tw-google-native', native ? '1' : '0');
        if (ret) sessionStorage.setItem('tw-google-return', ret);
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
</html>`;
}

export function googleOauthCallbackHtml() {
  return `<!DOCTYPE html>
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
      var ret = '';
      try {
        native = native || sessionStorage.getItem('tw-google-native') === '1';
        ret = sessionStorage.getItem('tw-google-return') || '';
        sessionStorage.removeItem('tw-google-native');
        sessionStorage.removeItem('tw-google-return');
      } catch (e) {}
      if (native) {
        window.location.replace('tecnowallet://oauthredirect?id_token=' + encodeURIComponent(token));
        return;
      }
      if (ret && /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?\\//i.test(ret)) {
        var back = new URL(ret);
        back.hash = 'id_token=' + encodeURIComponent(token);
        window.location.replace(back.toString());
        return;
      }
      window.location.replace('https://tecnowallet.app/auth.html');
    })();
  </script>
</body>
</html>`;
}
