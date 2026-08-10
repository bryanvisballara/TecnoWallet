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

const htaccess = `RewriteEngine On
RewriteBase /
RewriteRule ^index\\.html$ - [L]
# Collaboration invite emails use /invite?token=… — map onto invite.html
# (the invite/ folder is for recaudo /invite/[token] and would otherwise 403).
RewriteRule ^invite/?$ /invite.html [L,QSA]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
`;
fs.writeFileSync(path.join(staging, '.htaccess'), htaccess);

// Directory index for /invite/ so Apache does not 403 when the folder exists.
const inviteHtml = path.join(staging, 'invite.html');
const inviteDir = path.join(staging, 'invite');
if (fs.existsSync(inviteHtml)) {
  fs.mkdirSync(inviteDir, { recursive: true });
  fs.copyFileSync(inviteHtml, path.join(inviteDir, 'index.html'));
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
