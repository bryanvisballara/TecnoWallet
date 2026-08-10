#!/usr/bin/env node
/**
 * Polling file watcher for apps/mobile/src — broadcasts a full web reload
 * when sources change. Complements Metro HMR when Fast Refresh stalls.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const watchRoot = path.join(root, 'apps/mobile/src');
const reloadScript = path.join(__dirname, 'reload-web.mjs');

const DEBOUNCE_MS = 700;
const POLL_MS = 1000;
const IGNORE = /(node_modules|\.expo|dist|\.metro-health-check)/;

/** @type {Map<string, number>} */
const mtimes = new Map();
let timer = null;
let ready = false;

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (IGNORE.test(full)) continue;
    if (ent.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?|css|json)$/.test(ent.name)) out.push(full);
  }
  return out;
}

function snapshot() {
  const files = walk(watchRoot);
  let changed = false;
  for (const file of files) {
    let mtime = 0;
    try {
      mtime = fs.statSync(file).mtimeMs;
    } catch {
      continue;
    }
    const prev = mtimes.get(file);
    if (prev !== undefined && prev !== mtime) changed = true;
    mtimes.set(file, mtime);
  }
  return changed;
}

function scheduleReload() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    const child = spawn(process.execPath, [reloadScript], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => {
      if (code !== 0) {
        console.warn('dev-web-sync: reload failed (is Expo running on :8081?)');
      }
    });
  }, DEBOUNCE_MS);
}

console.log(`dev-web-sync: watching ${watchRoot} (poll ${POLL_MS}ms)`);
snapshot();
ready = true;

setInterval(() => {
  if (!ready) return;
  if (snapshot()) {
    console.log('dev-web-sync: source change → reload');
    scheduleReload();
  }
}, POLL_MS);
