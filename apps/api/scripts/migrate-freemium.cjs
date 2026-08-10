const mongoose = require('mongoose');

async function createIndex(db, collection, keys, options = {}) {
  await db.collection(collection).createIndex(keys, options);
  console.log(`[freemium] index ready: ${collection}.${options.name || JSON.stringify(keys)}`);
}

async function backfillFreeSlots(db) {
  const workspaces = db.collection('workspaces');
  const ownersWithSlot = new Set(
    (
      await workspaces
        .find({ freeSlot: 1, deletedAt: { $exists: false } }, { projection: { ownerId: 1 } })
        .toArray()
    ).map((item) => String(item.ownerId)),
  );
  const seen = new Set(ownersWithSlot);
  const cursor = workspaces
    .find({ deletedAt: { $exists: false } }, { projection: { ownerId: 1 } })
    .sort({ ownerId: 1, createdAt: 1, _id: 1 });
  for await (const workspace of cursor) {
    const ownerId = String(workspace.ownerId);
    if (seen.has(ownerId)) continue;
    seen.add(ownerId);
    await workspaces.updateOne(
      { _id: workspace._id, freeSlot: { $exists: false } },
      { $set: { freeSlot: 1 } },
    );
  }

  const resources = db.collection('financeresources');
  const groups = await resources
    .aggregate([
      {
        $match: {
          kind: 'envelope',
          'data.kind': { $in: ['income', 'expense'] },
          deletedAt: { $exists: false },
        },
      },
      { $sort: { createdAt: 1, _id: 1 } },
      {
        $group: {
          _id: { workspaceId: '$workspaceId', kind: '$data.kind' },
          resources: {
            $push: { id: '$_id', slot: '$data.freeQuotaSlot' },
          },
        },
      },
    ])
    .toArray();
  for (const group of groups) {
    const occupied = new Set(
      group.resources
        .map((item) => Number(item.slot))
        .filter((slot) => Number.isInteger(slot) && slot >= 1 && slot <= 5),
    );
    for (const resource of group.resources) {
      if (occupied.size >= 5) break;
      if (Number.isInteger(Number(resource.slot))) continue;
      const slot = [1, 2, 3, 4, 5].find((value) => !occupied.has(value));
      if (!slot) break;
      await resources.updateOne(
        { _id: resource.id, 'data.freeQuotaSlot': { $exists: false } },
        { $set: { 'data.freeQuotaSlot': slot } },
      );
      occupied.add(slot);
    }
  }
}

async function ensureIndexes(db) {
  await createIndex(
    db,
    'workspaces',
    { ownerId: 1, freeSlot: 1 },
    {
      unique: true,
      name: 'one_free_workspace_slot',
      partialFilterExpression: {
        freeSlot: { $type: 'number' },
      },
    },
  );
  await createIndex(
    db,
    'financeresources',
    { workspaceId: 1, kind: 1, 'data.kind': 1, 'data.freeQuotaSlot': 1 },
    {
      unique: true,
      name: 'five_free_envelope_slots',
      partialFilterExpression: {
        kind: 'envelope',
        'data.freeQuotaSlot': { $type: 'number' },
      },
    },
  );
  await createIndex(db, 'subscriptions', { userId: 1 }, { unique: true });
  await createIndex(db, 'subscriptions', { appUserId: 1, entitlementId: 1 });
  await createIndex(db, 'revenuecatwebhookevents', { eventId: 1 }, { unique: true });
  await createIndex(db, 'affiliates', { code: 1 }, { unique: true });
  await createIndex(db, 'affiliates', { affiliateId: 1 }, { unique: true });
  await createIndex(db, 'affiliateclicks', { clickId: 1 }, { unique: true });
  await createIndex(db, 'affiliateinstalls', { providerEventId: 1 }, { unique: true });
  await createIndex(db, 'userattributions', { userId: 1 }, { unique: true });
  await createIndex(db, 'commissionevents', { providerEventId: 1 }, { unique: true });
  await createIndex(db, 'collaborationinvites', { tokenHash: 1 }, { unique: true });
  await createIndex(
    db,
    'collaborationinvites',
    { sponsorUserId: 1, resourceType: 1, resourceId: 1, email: 1 },
    {
      unique: true,
      name: 'one_pending_invite_per_resource_and_email',
      partialFilterExpression: { status: 'pending' },
    },
  );
  await createIndex(
    db,
    'collaborationseats',
    { sponsorUserId: 1, collaboratorUserId: 1 },
    {
      unique: true,
      name: 'one_seat_per_sponsor_and_user',
      partialFilterExpression: { collaboratorUserId: { $exists: true } },
    },
  );
  await createIndex(
    db,
    'collaborationseats',
    { sponsorUserId: 1, email: 1 },
    {
      unique: true,
      name: 'one_seat_per_sponsor_and_email',
      partialFilterExpression: { email: { $exists: true } },
    },
  );
  await createIndex(
    db,
    'collaborationseats',
    { sponsorUserId: 1, slot: 1 },
    {
      unique: true,
      name: 'ten_race_safe_sponsor_slots',
      partialFilterExpression: { slot: { $exists: true } },
    },
  );
  await createIndex(
    db,
    'calendars',
    { workspaceId: 1, migrationSourceId: 1 },
    {
      unique: true,
      name: 'calendar_migration_source',
      partialFilterExpression: { migrationSourceId: { $exists: true } },
    },
  );
  await createIndex(
    db,
    'calendarmemberships',
    { calendarId: 1, userId: 1 },
    { unique: true },
  );
  await createIndex(db, 'calendaritemrecords', {
    calendarId: 1,
    deletedAt: 1,
    'data.date': 1,
  });
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required for freemium migration');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection is unavailable');
  await backfillFreeSlots(db);
  await ensureIndexes(db);
  await mongoose.disconnect();
  console.log('[freemium] migration complete');
}

main().catch(async (error) => {
  console.error('[freemium] migration failed', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
