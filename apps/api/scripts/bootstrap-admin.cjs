/**
 * Upsert platform admin from env (never commit passwords).
 *
 * Usage:
 *   ADMIN_BOOTSTRAP_PASSWORD='…' yarn workspace api bootstrap:admin
 *
 * Optional:
 *   ADMIN_BOOTSTRAP_EMAIL (default mercancias.visbal@gmail.com)
 *   ADMIN_BOOTSTRAP_NAME (default TecnoWallet Admin)
 */
const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('mongoose');
const { hash } = require('bcryptjs');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  const root = path.resolve(__dirname, '../../..');
  loadEnvFile(path.join(root, '.env'));
  loadEnvFile(path.join(root, 'apps/api/.env'));

  const email = (
    process.env.ADMIN_BOOTSTRAP_EMAIL || 'mercancias.visbal@gmail.com'
  )
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD?.trim();
  const name = (process.env.ADMIN_BOOTSTRAP_NAME || 'TecnoWallet Admin').trim();
  const mongoUri = process.env.MONGODB_URI?.trim();

  if (!mongoUri) {
    throw new Error('MONGODB_URI is required');
  }
  if (!password || password.length < 8) {
    throw new Error(
      'ADMIN_BOOTSTRAP_PASSWORD is required (min 8 chars). Do not commit it.',
    );
  }

  await mongoose.connect(mongoUri);
  const users = mongoose.connection.collection('users');
  const passwordHash = await hash(password, 12);
  const now = new Date();

  const existing = await users.findOne({ email });
  if (existing) {
    await users.updateOne(
      { _id: existing._id },
      {
        $set: {
          passwordHash,
          platformRole: 'admin',
          emailVerified: true,
          active: true,
          name: existing.name?.trim() || name,
          updatedAt: now,
        },
        $unset: {
          emailVerificationCodeHash: '',
          emailVerificationExpiresAt: '',
        },
      },
    );
    console.log(`Updated admin user ${email} (platformRole=admin)`);
  } else {
    await users.insertOne({
      email,
      name,
      passwordHash,
      platformRole: 'admin',
      emailVerified: true,
      active: true,
      sessionVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Created admin user ${email} (platformRole=admin)`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
