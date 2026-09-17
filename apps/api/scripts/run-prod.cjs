const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiRoot = path.join(__dirname, '..');
const repoRoot = path.join(apiRoot, '..', '..');

function resolveMainJs() {
  const candidates = [
    path.join(apiRoot, 'dist', 'main.js'),
    path.join(apiRoot, 'dist', 'apps', 'api', 'src', 'main.js'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function buildApi() {
  execSync(
    'yarn workspace @tecnowallet/config build && yarn workspace api build',
    {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );
}

let mainJs = resolveMainJs();
if (!mainJs) {
  console.log('[api] dist/main.js missing — building config + api…');
  buildApi();
  mainJs = resolveMainJs();
}

if (!mainJs) {
  console.error('[api] Build finished but dist/main.js still missing.');
  process.exit(1);
}

// Start Nest first so Render health checks pass while migrations run.
require(mainJs);

if (process.env.RUN_FREEMIUM_MIGRATIONS !== 'false') {
  const { spawn } = require('child_process');
  const migration = spawn('node', ['./scripts/migrate-freemium.cjs'], {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
  migration.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[freemium] migration exited with code ${code}`);
    }
  });
}
