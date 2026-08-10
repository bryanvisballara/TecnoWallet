const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiRoot = path.join(__dirname, '..');
const mainJs = path.join(apiRoot, 'dist', 'main.js');

if (!fs.existsSync(mainJs)) {
  console.log('[api] dist/main.js missing — running nest build…');
  execSync('npx --no-install nest build', {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

if (!fs.existsSync(mainJs)) {
  console.error('[api] Build finished but dist/main.js still missing.');
  process.exit(1);
}

if (process.env.RUN_FREEMIUM_MIGRATIONS !== 'false') {
  execSync('node ./scripts/migrate-freemium.cjs', {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

// Loading main.js starts Nest (bootstrap runs at module scope).
require(mainJs);
