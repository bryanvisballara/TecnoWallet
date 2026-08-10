/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { WorkspaceSchema } from '../auth/auth.module';
import { FinanceResourceSchema } from '../platform/platform.module';

describe('freemium quota indexes', () => {
  it('keeps the one-free-book limit race safe', () => {
    expect(WorkspaceSchema.indexes()).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          { ownerId: 1, freeSlot: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: expect.objectContaining({
              freeSlot: { $type: 'number' },
            }),
          }),
        ]),
      ]),
    );
  });

  it('keeps five envelope slots per workspace and type race safe', () => {
    expect(FinanceResourceSchema.indexes()).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          {
            workspaceId: 1,
            kind: 1,
            'data.kind': 1,
            'data.freeQuotaSlot': 1,
          },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: expect.objectContaining({
              kind: 'envelope',
            }),
          }),
        ]),
      ]),
    );
  });
});
