#!/usr/bin/env node
/**
 * Upload a local MP4 to Cloudinary (signed upload).
 * Usage: node scripts/upload-cloudinary-video.mjs <file> <public_id>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(filePath) {
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

const root = path.resolve(import.meta.dirname, '..');
loadEnv(path.join(root, '.env'));

const file = process.argv[2];
const publicId = process.argv[3];
const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

if (!file || !publicId) {
  console.error('Usage: node scripts/upload-cloudinary-video.mjs <file> <public_id>');
  process.exit(1);
}
if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing CLOUDINARY_* in .env');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`File not found: ${file}`);
  process.exit(1);
}

const timestamp = Math.floor(Date.now() / 1000);
const toSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
const signature = crypto.createHash('sha1').update(toSign).digest('hex');

const form = new FormData();
form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
form.append('api_key', apiKey);
form.append('timestamp', String(timestamp));
form.append('public_id', publicId);
form.append('signature', signature);
form.append('resource_type', 'video');

const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
const res = await fetch(url, { method: 'POST', body: form });
const body = await res.json();
if (!res.ok) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  public_id: body.public_id,
  secure_url: body.secure_url,
  bytes: body.bytes,
  duration: body.duration,
}, null, 2));
