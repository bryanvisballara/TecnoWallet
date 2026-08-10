#!/usr/bin/env node
/**
 * Force all connected Expo web clients to reload via the Metro /message socket.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WebSocket = require(require.resolve('ws', { paths: [root, path.join(root, 'apps/mobile')] }));

const host = process.env.EXPO_WEB_HOST || '127.0.0.1';
const port = process.env.EXPO_WEB_PORT || '8081';
const origin = `http://${host}:${port}`;
const url = `ws://${host}:${port}/message`;

const ws = new WebSocket(url, { headers: { Origin: origin } });
const timer = setTimeout(() => {
  console.error(`reload-web: timeout connecting to ${url}`);
  process.exit(1);
}, 4000);

ws.on('open', () => {
  ws.send(JSON.stringify({ version: 2, method: 'reload' }));
  clearTimeout(timer);
  setTimeout(() => {
    ws.close();
    console.log(`reload-web: sent reload → ${origin}`);
    process.exit(0);
  }, 150);
});

ws.on('error', (err) => {
  clearTimeout(timer);
  console.error(`reload-web: ${err.message || err}`);
  process.exit(1);
});
