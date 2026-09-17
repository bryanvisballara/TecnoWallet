const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function upstreamApiBase() {
  const mobileRoot = __dirname;
  loadEnvFile(path.join(mobileRoot, '.env'));
  loadEnvFile(path.join(mobileRoot, '../../.env'));
  return (
    process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '') ||
    'https://tecnowallet.onrender.com/api/v1'
  );
}

function forwardRequest(req, res, target) {
  const client = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  const proxyReq = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'https:' ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ message: 'No pudimos conectar con la API remota.' }));
  });

  req.pipe(proxyReq);
}

/** Metro dev-server middleware: /api/v1/* → EXPO_PUBLIC_API_URL (avoids browser CORS). */
function createDevApiProxy() {
  const upstream = upstreamApiBase();

  return (req, res) => {
    const incoming = req.url || '';
    if (!incoming.startsWith('/api/v1')) return false;

    const suffix = incoming.slice('/api/v1'.length) || '';
    let target;
    try {
      target = new URL(`${upstream}${suffix}`);
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'API proxy misconfigured.' }));
      return true;
    }

    forwardRequest(req, res, target);
    return true;
  };
}

module.exports = { createDevApiProxy };
