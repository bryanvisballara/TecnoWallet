#!/usr/bin/env node
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

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

const uploads = [
  ['v1', '/Users/usuario/Downloads/Cómo_configurar_Tecnowallet_paso_a_paso.mp4'],
  ['v2', '/Users/usuario/Desktop/2. divisa e idioma/2. divisa e idioma.mov'],
  ['v3', '/Users/usuario/Desktop/Cambia el nombre de tu libro/Cambia el nombre de tu libro.mov'],
  ['v4', '/Users/usuario/Desktop/4. Creacion de sobre de gastos/4. Creacion de sobre de gastos.mov'],
  ['v5', '/Users/usuario/Desktop/5. creacion de sobres de ingresos/5. creacion de sobres de ingresos.mov'],
  ['v6', '/Users/usuario/Desktop/6. Cuentas de banco/6. Cuentas de banco.mov'],
  ['v7', '/Users/usuario/Desktop/7. Salud Financiera/7. Salud Financiera.mov'],
  ['v8', '/Users/usuario/Desktop/8. Proyeccion mensual/8. Proyeccion mensual.mov'],
  ['v9', '/Users/usuario/Desktop/9. Metas y ahorros/9. Metas y ahorros.mov'],
  ['v10', '/Users/usuario/Desktop/10. Como invitamos a personas/10. Como invitamos a personas.mov'],
  ['v11', '/Users/usuario/Desktop/11. como agregar ingresos y gastos/11. como agregar ingresos y gastos.mov'],
  ['v12', '/Users/usuario/Desktop/12. calendario/12. calendario.mov'],
];

async function upload(publicId, file) {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = {
    overwrite: 'true',
    public_id: publicId,
    timestamp: String(timestamp),
  };
  const toSign =
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&') + apiSecret;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  form.append('api_key', apiKey);
  form.append('timestamp', params.timestamp);
  form.append('public_id', params.public_id);
  form.append('overwrite', params.overwrite);
  form.append('signature', signature);
  form.append('resource_type', 'video');

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;
  const res = await fetch(url, { method: 'POST', body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

if (!cloudName || !apiKey || !apiSecret) {
  console.error('Missing CLOUDINARY_* in .env');
  process.exit(1);
}

const results = [];
for (const [key, file] of uploads) {
  const publicId = `tecnowallet/tutorial/es/${key}`;
  process.stdout.write(`Uploading ${key}... `);
  const body = await upload(publicId, file);
  console.log(`ok (${Math.round(body.duration ?? 0)}s)`);
  results.push({ key, publicId, secure_url: body.secure_url, duration: body.duration });
}

console.log(JSON.stringify(results, null, 2));
