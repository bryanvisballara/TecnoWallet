import {
  CollaborationInviteSchema,
  CollaborationSeatSchema,
} from './collaboration.schemas';

describe('collaboration schema invariants', () => {
  it('stores only a unique token hash and unique pending resource invites', () => {
    const tokenHash = CollaborationInviteSchema.path('tokenHash');
    expect(tokenHash).toBeDefined();
    expect(CollaborationInviteSchema.path('token')).toBeUndefined();

    const indexes = CollaborationInviteSchema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          {
            sponsorUserId: 1,
            resourceType: 1,
            resourceId: 1,
            email: 1,
          },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { status: 'pending' },
          }),
        ]),
      ]),
    );
  });

  it('enforces one identity and up to ten race-safe slots per sponsor', () => {
    const slotPath = CollaborationSeatSchema.path('slot') as {
      options?: { max?: number };
    };
    expect(slotPath.options?.max).toBe(10);
    const indexes = CollaborationSeatSchema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          { sponsorUserId: 1, collaboratorUserId: 1 },
          expect.objectContaining({ unique: true }),
        ]),
        expect.arrayContaining([
          { sponsorUserId: 1, email: 1 },
          expect.objectContaining({ unique: true }),
        ]),
        expect.arrayContaining([
          { sponsorUserId: 1, slot: 1 },
          expect.objectContaining({ unique: true }),
        ]),
      ]),
    );
  });
});
