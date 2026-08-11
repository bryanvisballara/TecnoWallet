import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Membership,
  User,
  Workspace,
  type AuthPrincipal,
} from '../auth/auth.module';
import {
  EntitlementService,
  PaymentRequiredException,
} from '../billing/entitlement.service';
import { PushService } from '../push/push.service';
import {
  AcceptCollaborationInviteDto,
  CreateAccessRequestDto,
  CreateCalendarDto,
  CreateCalendarItemDto,
  CreateCollaborationInviteDto,
  ListAccessRequestsQueryDto,
  ListCalendarsQueryDto,
  UpdateCalendarItemDto,
  UpdateCalendarDto,
} from './collaboration.dto';
import {
  Calendar,
  CalendarMembership,
  CalendarItemRecord,
  CollaborationAccessRequest,
  CollaborationInvite,
  CollaborationSeat,
  type CollaborationResourceRef,
  type CollaborationResourceType,
  type CollaborationSeatDocument,
} from './collaboration.schemas';
import { createHash, randomBytes } from 'node:crypto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHARE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateShareCode(prefix: 'TW' | 'TC' = 'TW'): string {
  const bytes = randomBytes(8);
  let code = prefix;
  for (let i = 0; i < 8; i += 1) {
    code += SHARE_CODE_ALPHABET[bytes[i]! % SHARE_CODE_ALPHABET.length];
  }
  return code;
}

interface InviteMailDispatch {
  to: string;
  inviteUrl: string;
  resourceType: 'workspace' | 'calendar';
  resourceName: string;
}

export interface CreatedCollaborationInvite {
  response: {
    id: Types.ObjectId;
    email: string;
    resourceType: 'workspace' | 'calendar';
    resourceId: Types.ObjectId;
    role: 'member' | 'editor' | 'viewer';
    status: 'pending';
    expiresAt: Date;
    inviteUrl?: string;
  };
  /**
   * The controller deliberately strips this field. An integration layer may
   * pass it directly to Brevo without ever persisting or logging the token.
   */
  mailDispatch: InviteMailDispatch;
}

@Injectable()
export class CollaborationService {
  constructor(
    @InjectModel(CollaborationInvite.name)
    private readonly invites: Model<CollaborationInvite>,
    @InjectModel(CollaborationSeat.name)
    private readonly seats: Model<CollaborationSeat>,
    @InjectModel(CollaborationAccessRequest.name)
    private readonly accessRequests: Model<CollaborationAccessRequest>,
    @InjectModel(Calendar.name)
    private readonly calendars: Model<Calendar>,
    @InjectModel(CalendarMembership.name)
    private readonly calendarMemberships: Model<CalendarMembership>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectModel(Workspace.name)
    private readonly workspaces: Model<Workspace>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    private readonly entitlements: EntitlementService,
    private readonly config: ConfigService,
    private readonly push: PushService,
  ) {}

  async allocateShareCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = generateShareCode('TW');
      const exists = await this.workspaces.exists({ shareCode });
      if (!exists) return shareCode;
    }
    throw new ConflictException('Could not allocate a share code');
  }

  async allocateCalendarShareCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = generateShareCode('TC');
      const [onCalendar, onWorkspace] = await Promise.all([
        this.calendars.exists({ shareCode }),
        this.workspaces.exists({ shareCode }),
      ]);
      if (!onCalendar && !onWorkspace) return shareCode;
    }
    throw new ConflictException('Could not allocate a calendar share code');
  }

  async ensureShareCode(workspaceId: string): Promise<string> {
    const workspace = await this.workspaces.findOne({
      _id: workspaceId,
      deletedAt: { $exists: false },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (workspace.shareCode) return workspace.shareCode;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = await this.allocateShareCode();
      try {
        workspace.shareCode = shareCode;
        await workspace.save();
        return shareCode;
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
      }
    }
    throw new ConflictException('Could not allocate a share code');
  }

  async ensureCalendarShareCode(calendarId: string): Promise<string> {
    const calendar = await this.calendars.findOne({
      _id: calendarId,
      deletedAt: { $exists: false },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');
    if (calendar.shareCode) return calendar.shareCode;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = await this.allocateCalendarShareCode();
      try {
        calendar.shareCode = shareCode;
        await calendar.save();
        return shareCode;
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
      }
    }
    throw new ConflictException('Could not allocate a calendar share code');
  }

  async createAccessRequest(
    dto: CreateAccessRequestDto,
    principal: AuthPrincipal,
  ) {
    const shareCode = dto.shareCode.trim().toUpperCase();
    const workspace = await this.workspaces.findOne({
      shareCode,
      deletedAt: { $exists: false },
    });
    if (workspace) {
      return this.createWorkspaceAccessRequest(workspace, principal);
    }

    const calendar = await this.calendars.findOne({
      shareCode,
      deletedAt: { $exists: false },
    });
    if (calendar) {
      return this.createCalendarAccessRequest(calendar, principal);
    }

    throw new NotFoundException('ID not found');
  }

  private async createWorkspaceAccessRequest(
    workspace: { _id: Types.ObjectId; ownerId: Types.ObjectId; name: string },
    principal: AuthPrincipal,
  ) {
    const requesterId = new Types.ObjectId(principal.userId);
    if (workspace.ownerId.equals(requesterId)) {
      throw new BadRequestException('You already own this book');
    }
    const alreadyMember = await this.memberships.exists({
      workspaceId: workspace._id,
      userId: requesterId,
    });
    if (alreadyMember) {
      throw new ConflictException('You already have access to this book');
    }

    await this.assertSharingPlus(workspace.ownerId.toString(), 'access_request');

    try {
      const created = await this.accessRequests.create({
        resourceType: 'workspace',
        workspaceId: workspace._id,
        requesterUserId: requesterId,
        ownerUserId: workspace.ownerId,
        status: 'pending',
      });
      void this.notifyOwnerAccessRequest({
        ownerUserId: workspace.ownerId.toString(),
        requesterUserId: principal.userId,
        requestId: created._id.toString(),
        resourceType: 'workspace',
        resourceId: workspace._id.toString(),
        resourceName: workspace.name,
      });
      return {
        id: created._id.toString(),
        resourceType: 'workspace' as const,
        workspaceId: workspace._id.toString(),
        workspaceName: workspace.name,
        status: 'pending' as const,
        createdAt: created.createdAt,
      };
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException(
          'You already have a pending request for this book',
        );
      }
      throw error;
    }
  }

  private async createCalendarAccessRequest(
    calendar: { _id: Types.ObjectId; ownerId: Types.ObjectId; name: string },
    principal: AuthPrincipal,
  ) {
    const requesterId = new Types.ObjectId(principal.userId);
    if (calendar.ownerId.equals(requesterId)) {
      throw new BadRequestException('You already own this calendar');
    }
    const alreadyMember = await this.calendarMemberships.exists({
      calendarId: calendar._id,
      userId: requesterId,
    });
    if (alreadyMember) {
      throw new ConflictException('You already have access to this calendar');
    }

    await this.assertSharingPlus(calendar.ownerId.toString(), 'access_request');

    try {
      const created = await this.accessRequests.create({
        resourceType: 'calendar',
        calendarId: calendar._id,
        requesterUserId: requesterId,
        ownerUserId: calendar.ownerId,
        status: 'pending',
      });
      void this.notifyOwnerAccessRequest({
        ownerUserId: calendar.ownerId.toString(),
        requesterUserId: principal.userId,
        requestId: created._id.toString(),
        resourceType: 'calendar',
        resourceId: calendar._id.toString(),
        resourceName: calendar.name,
      });
      return {
        id: created._id.toString(),
        resourceType: 'calendar' as const,
        calendarId: calendar._id.toString(),
        calendarName: calendar.name,
        status: 'pending' as const,
        createdAt: created.createdAt,
      };
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException(
          'You already have a pending request for this calendar',
        );
      }
      throw error;
    }
  }

  private async notifyOwnerAccessRequest(input: {
    ownerUserId: string;
    requesterUserId: string;
    requestId: string;
    resourceType: 'workspace' | 'calendar';
    resourceId: string;
    resourceName: string;
  }) {
    const who = await this.push.userDisplayName(input.requesterUserId);
    const isCalendar = input.resourceType === 'calendar';
    const targetLabel = isCalendar ? 'calendario' : 'libro';
    const route = isCalendar
      ? `/(tabs)/calendars?focus=${encodeURIComponent(input.resourceId)}&tab=share`
      : `/(tabs)/ledgers?focus=${encodeURIComponent(input.resourceId)}&tab=share`;
    this.push.notifyUsers([input.ownerUserId], input.requesterUserId, {
      title: 'Solicitud de acceso',
      body: `${who} quiere unirse a tu ${targetLabel} «${input.resourceName.trim() || (isCalendar ? 'Calendario' : 'Libro')}»`,
      data: {
        kind: 'invite',
        route,
        notificationId: `access-${input.requestId}`,
        accessRequestId: input.requestId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
      sound: 'sobres.wav',
    });
  }

  async listAccessRequests(
    query: ListAccessRequestsQueryDto,
    principal: AuthPrincipal,
  ) {
    if (query.calendarId) {
      await this.assertCanInvite('calendar', query.calendarId, principal.userId);
      const rows = await this.accessRequests
        .find({
          calendarId: new Types.ObjectId(query.calendarId),
          resourceType: 'calendar',
          status: 'pending',
        })
        .sort({ createdAt: -1 })
        .lean();
      const users = await this.users
        .find({ _id: { $in: rows.map((row) => row.requesterUserId) } })
        .select('name email')
        .lean();
      return {
        requests: rows.map((row) => {
          const user = users.find((item) =>
            item._id.equals(row.requesterUserId),
          );
          return {
            id: row._id.toString(),
            resourceType: 'calendar' as const,
            calendarId: row.calendarId?.toString(),
            requesterUserId: row.requesterUserId.toString(),
            name: user?.name?.trim() || user?.email?.split('@')[0] || 'Usuario',
            email: (user?.email || '').toLowerCase(),
            status: row.status,
            createdAt: row.createdAt,
          };
        }),
      };
    }

    if (!query.workspaceId) {
      throw new BadRequestException('workspaceId or calendarId is required');
    }
    await this.assertCanInvite('workspace', query.workspaceId, principal.userId);
    const rows = await this.accessRequests
      .find({
        workspaceId: new Types.ObjectId(query.workspaceId),
        $or: [{ resourceType: 'workspace' }, { resourceType: { $exists: false } }],
        status: 'pending',
      })
      .sort({ createdAt: -1 })
      .lean();
    const users = await this.users
      .find({ _id: { $in: rows.map((row) => row.requesterUserId) } })
      .select('name email')
      .lean();
    return {
      requests: rows.map((row) => {
        const user = users.find((item) => item._id.equals(row.requesterUserId));
        return {
          id: row._id.toString(),
          resourceType: 'workspace' as const,
          workspaceId: row.workspaceId?.toString(),
          requesterUserId: row.requesterUserId.toString(),
          name: user?.name?.trim() || user?.email?.split('@')[0] || 'Usuario',
          email: (user?.email || '').toLowerCase(),
          status: row.status,
          createdAt: row.createdAt,
        };
      }),
    };
  }

  async listOwnedPendingAccessRequests(ownerUserId: string) {
    const rows = await this.accessRequests
      .find({
        ownerUserId: new Types.ObjectId(ownerUserId),
        status: 'pending',
      })
      .sort({ createdAt: -1 })
      .lean();
    if (!rows.length) return { requests: [] as const };

    const workspaceIds = rows
      .map((row) => row.workspaceId)
      .filter((id): id is Types.ObjectId => Boolean(id));
    const calendarIds = rows
      .map((row) => row.calendarId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    const [users, workspaces, calendars] = await Promise.all([
      this.users
        .find({ _id: { $in: rows.map((row) => row.requesterUserId) } })
        .select('name email')
        .lean(),
      this.workspaces.find({ _id: { $in: workspaceIds } }).select('name').lean(),
      this.calendars.find({ _id: { $in: calendarIds } }).select('name').lean(),
    ]);

    return {
      requests: rows.map((row) => {
        const user = users.find((item) => item._id.equals(row.requesterUserId));
        const isCalendar =
          row.resourceType === 'calendar' || Boolean(row.calendarId);
        if (isCalendar) {
          const calendar = calendars.find(
            (item) => row.calendarId && item._id.equals(row.calendarId),
          );
          return {
            id: row._id.toString(),
            resourceType: 'calendar' as const,
            calendarId: row.calendarId?.toString(),
            calendarName: calendar?.name ?? 'Calendario',
            requesterUserId: row.requesterUserId.toString(),
            name: user?.name?.trim() || user?.email?.split('@')[0] || 'Usuario',
            email: (user?.email || '').toLowerCase(),
            status: row.status,
            createdAt: row.createdAt,
          };
        }
        const workspace = workspaces.find(
          (item) => row.workspaceId && item._id.equals(row.workspaceId),
        );
        return {
          id: row._id.toString(),
          resourceType: 'workspace' as const,
          workspaceId: row.workspaceId?.toString(),
          workspaceName: workspace?.name ?? 'Libro',
          requesterUserId: row.requesterUserId.toString(),
          name: user?.name?.trim() || user?.email?.split('@')[0] || 'Usuario',
          email: (user?.email || '').toLowerCase(),
          status: row.status,
          createdAt: row.createdAt,
        };
      }),
    };
  }

  async acceptAccessRequest(requestId: string, principal: AuthPrincipal) {
    const request = await this.accessRequests.findOne({
      _id: requestId,
      status: 'pending',
    });
    if (!request) throw new NotFoundException('Access request not found');

    const isCalendar =
      request.resourceType === 'calendar' || Boolean(request.calendarId);
    if (isCalendar) {
      if (!request.calendarId) {
        throw new BadRequestException('Calendar access request is incomplete');
      }
      await this.assertCanInvite(
        'calendar',
        request.calendarId.toString(),
        principal.userId,
      );
      await this.assertSharingPlus(principal.userId, 'accept_access_request');

      const requester = await this.users
        .findById(request.requesterUserId)
        .select('email')
        .lean();
      if (!requester?.email) {
        throw new ConflictException('Requester account is no longer available');
      }

      const email = requester.email.toLowerCase();
      await this.assertNoExistingAccess(
        'calendar',
        request.calendarId.toString(),
        request.requesterUserId,
      );

      const resource: CollaborationResourceRef = {
        resourceType: 'calendar',
        resourceId: request.calendarId,
        role: 'editor',
      };
      await this.reserveSeat(
        principal.userId,
        email,
        request.requesterUserId,
        resource,
      );

      await this.calendarMemberships.updateOne(
        { calendarId: request.calendarId, userId: request.requesterUserId },
        {
          $setOnInsert: {
            role: 'editor',
            sponsorUserId: new Types.ObjectId(principal.userId),
          },
        },
        { upsert: true },
      );

      await this.seats.updateOne(
        {
          sponsorUserId: principal.userId,
          $or: [
            { collaboratorUserId: request.requesterUserId },
            { email },
          ],
          status: { $in: ['pending', 'active'] },
        },
        {
          $set: {
            collaboratorUserId: request.requesterUserId,
            email,
            status: 'active',
          },
        },
      );

      request.status = 'accepted';
      request.resolvedAt = new Date();
      await request.save();

      return {
        accepted: true,
        resourceType: 'calendar' as const,
        calendarId: request.calendarId.toString(),
      };
    }

    if (!request.workspaceId) {
      throw new BadRequestException('Workspace access request is incomplete');
    }
    await this.assertCanInvite(
      'workspace',
      request.workspaceId.toString(),
      principal.userId,
    );
    await this.assertSharingPlus(principal.userId, 'accept_access_request');

    const requester = await this.users
      .findById(request.requesterUserId)
      .select('email')
      .lean();
    if (!requester?.email) {
      throw new ConflictException('Requester account is no longer available');
    }

    const email = requester.email.toLowerCase();
    await this.assertNoExistingAccess(
      'workspace',
      request.workspaceId.toString(),
      request.requesterUserId,
    );

    const resource: CollaborationResourceRef = {
      resourceType: 'workspace',
      resourceId: request.workspaceId,
      role: 'member',
    };
    await this.reserveSeat(
      principal.userId,
      email,
      request.requesterUserId,
      resource,
    );

    await this.memberships.updateOne(
      { workspaceId: request.workspaceId, userId: request.requesterUserId },
      { $setOnInsert: { role: 'member' } },
      { upsert: true },
    );

    await this.seats.updateOne(
      {
        sponsorUserId: principal.userId,
        $or: [
          { collaboratorUserId: request.requesterUserId },
          { email },
        ],
        status: { $in: ['pending', 'active'] },
      },
      {
        $set: {
          collaboratorUserId: request.requesterUserId,
          email,
          status: 'active',
        },
      },
    );

    request.status = 'accepted';
    request.resolvedAt = new Date();
    await request.save();

    return {
      accepted: true,
      resourceType: 'workspace' as const,
      workspaceId: request.workspaceId.toString(),
    };
  }

  async rejectAccessRequest(requestId: string, principal: AuthPrincipal) {
    const request = await this.accessRequests.findOne({
      _id: requestId,
      status: 'pending',
    });
    if (!request) throw new NotFoundException('Access request not found');
    const isCalendar =
      request.resourceType === 'calendar' || Boolean(request.calendarId);
    if (isCalendar) {
      if (!request.calendarId) {
        throw new BadRequestException('Calendar access request is incomplete');
      }
      await this.assertCanInvite(
        'calendar',
        request.calendarId.toString(),
        principal.userId,
      );
    } else {
      if (!request.workspaceId) {
        throw new BadRequestException('Workspace access request is incomplete');
      }
      await this.assertCanInvite(
        'workspace',
        request.workspaceId.toString(),
        principal.userId,
      );
    }
    request.status = 'rejected';
    request.resolvedAt = new Date();
    await request.save();
    return { rejected: true };
  }

  async createInvite(
    dto: CreateCollaborationInviteDto,
    principal: AuthPrincipal,
  ): Promise<CreatedCollaborationInvite> {
    await this.assertSharingPlus(principal.userId, 'invite');

    const email = dto.email.trim().toLowerCase();
    if (email === principal.email.trim().toLowerCase()) {
      throw new BadRequestException('You cannot sponsor yourself');
    }
    this.assertRoleForResource(dto.resourceType, dto.role);
    const resourceName = await this.assertCanInvite(
      dto.resourceType,
      dto.resourceId,
      principal.userId,
    );

    const invitee = await this.users
      .findOne({ email, active: true })
      .select('_id email')
      .lean();
    await this.assertNoExistingAccess(
      dto.resourceType,
      dto.resourceId,
      invitee?._id,
    );

    const resource: CollaborationResourceRef = {
      resourceType: dto.resourceType,
      resourceId: new Types.ObjectId(dto.resourceId),
      role: dto.role,
    };
    await this.reserveSeat(principal.userId, email, invitee?._id, resource);

    const rawToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    let invite: CollaborationInvite;
    try {
      invite = await this.invites.create({
        tokenHash: this.digest(rawToken),
        email,
        inviteeUserId: invitee?._id,
        sponsorUserId: new Types.ObjectId(principal.userId),
        resourceType: dto.resourceType,
        resourceId: new Types.ObjectId(dto.resourceId),
        role: dto.role,
        status: 'pending',
        expiresAt,
      });
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new ConflictException('A pending invite already exists');
      }
      throw error;
    }

    const inviteUrl = this.buildInviteUrl(rawToken);
    return {
      response: {
        id: invite._id,
        email,
        resourceType: invite.resourceType,
        resourceId: invite.resourceId,
        role: invite.role,
        status: 'pending',
        expiresAt,
        ...(this.isNonProduction() ? { inviteUrl } : {}),
      },
      mailDispatch: {
        to: email,
        inviteUrl,
        resourceType: dto.resourceType,
        resourceName,
      },
    };
  }

  async lookupInvite(rawToken: string) {
    const invite = await this.findPendingInvite(rawToken);
    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.expireInvite(invite);
      throw new NotFoundException('Invite is invalid or expired');
    }
    const [sponsor, resourceName] = await Promise.all([
      this.users.findById(invite.sponsorUserId).select('name').lean(),
      this.resourceName(invite.resourceType, invite.resourceId.toString()),
    ]);
    return {
      resourceType: invite.resourceType,
      resourceName,
      role: invite.role,
      sponsorName: sponsor?.name ?? 'TecnoWallet user',
      emailHint: this.maskEmail(invite.email),
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(
    dto: AcceptCollaborationInviteDto,
    principal: AuthPrincipal,
  ) {
    const invite = await this.findPendingInvite(dto.token);
    if (invite.expiresAt.getTime() <= Date.now()) {
      await this.expireInvite(invite);
      throw new BadRequestException('Invite has expired');
    }
    if (invite.email !== principal.email.trim().toLowerCase()) {
      throw new ForbiddenException(
        'This invite belongs to a different email address',
      );
    }
    if (!(await this.entitlements.isPlus(invite.sponsorUserId.toString()))) {
      throw this.paymentRequired(
        'SHARING_REQUIRED',
        'The sponsor no longer has Plus',
      );
    }

    const userId = new Types.ObjectId(principal.userId);
    const seat = await this.seats.findOne({
      sponsorUserId: invite.sponsorUserId,
      $or: [{ collaboratorUserId: userId }, { email: invite.email }],
      status: { $in: ['pending', 'active'] },
    });
    if (!seat) {
      throw new ConflictException('The sponsored seat is no longer available');
    }

    if (invite.resourceType === 'workspace') {
      await this.memberships.updateOne(
        { workspaceId: invite.resourceId, userId },
        { $setOnInsert: { role: 'member' } },
        { upsert: true },
      );
    } else {
      await this.calendarMemberships.updateOne(
        { calendarId: invite.resourceId, userId },
        {
          $set: {
            role: invite.role,
            sponsorUserId: invite.sponsorUserId,
          },
        },
        { upsert: true },
      );
    }

    const acceptedAt = new Date();
    const accepted = await this.invites.findOneAndUpdate(
      { _id: invite._id, status: 'pending' },
      {
        $set: {
          status: 'accepted',
          acceptedAt,
          inviteeUserId: userId,
        },
      },
      { new: true },
    );
    if (!accepted) throw new ConflictException('Invite was already used');

    seat.collaboratorUserId = userId;
    seat.email = invite.email;
    seat.status = 'active';
    await seat.save();
    return {
      accepted: true,
      resourceType: invite.resourceType,
      resourceId: invite.resourceId,
      role: invite.resourceType === 'workspace' ? 'member' : invite.role,
    };
  }

  async listSeats(sponsorUserId: string) {
    await this.assertSharingPlus(sponsorUserId, 'list_seats');
    return this.seats
      .find({ sponsorUserId, status: { $in: ['pending', 'active'] } })
      .sort({ slot: 1 })
      .lean();
  }

  async listResourceInvites(
    resourceType: CollaborationResourceType,
    resourceId: string,
    principal: AuthPrincipal,
  ) {
    await this.assertCanInvite(resourceType, resourceId, principal.userId);

    const now = new Date();
    const expiredPending = await this.invites
      .find({
        resourceType,
        resourceId: new Types.ObjectId(resourceId),
        status: 'pending',
        expiresAt: { $lte: now },
      })
      .exec();
    for (const invite of expiredPending) {
      await this.expireInvite(invite);
    }

    const rows = await this.invites
      .find({
        resourceType,
        resourceId: new Types.ObjectId(resourceId),
        status: { $in: ['pending', 'accepted'] },
      })
      .sort({ createdAt: -1 })
      .lean();

    return {
      invites: rows.map((row) => ({
        id: row._id.toString(),
        email: row.email,
        role: row.role,
        status: row.status as 'pending' | 'accepted',
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        acceptedAt: row.acceptedAt ?? null,
      })),
    };
  }

  async revokeInvite(inviteId: string, principal: AuthPrincipal) {
    const invite = await this.invites.findOne({
      _id: inviteId,
      status: 'pending',
    });
    if (!invite) throw new NotFoundException('Invite not found');
    await this.assertCanInvite(
      invite.resourceType,
      invite.resourceId.toString(),
      principal.userId,
    );

    await this.invites.updateOne(
      { _id: invite._id, status: 'pending' },
      { $set: { status: 'revoked' } },
    );
    await this.seats.updateOne(
      {
        sponsorUserId: invite.sponsorUserId,
        email: invite.email,
        status: 'pending',
      },
      {
        $pull: {
          resources: {
            resourceType: invite.resourceType,
            resourceId: invite.resourceId,
          },
        },
      },
    );
    const seat = await this.seats.findOne({
      sponsorUserId: invite.sponsorUserId,
      email: invite.email,
      status: 'pending',
    });
    if (seat && seat.resources.length === 0) {
      seat.status = 'revoked';
      seat.slot = undefined;
      await seat.save();
    }
    return { revoked: true };
  }

  async removeWorkspaceMember(
    workspaceId: string,
    memberUserId: string,
    principal: AuthPrincipal,
  ) {
    await this.assertCanInvite('workspace', workspaceId, principal.userId);
    if (memberUserId === principal.userId) {
      throw new BadRequestException('You cannot remove yourself');
    }
    const membership = await this.memberships.findOne({
      workspaceId,
      userId: memberUserId,
    });
    if (!membership) throw new NotFoundException('Member not found');
    if (membership.role === 'owner') {
      throw new ForbiddenException('Cannot remove the workspace owner');
    }

    await this.memberships.deleteOne({ _id: membership._id });

    const user = await this.users.findById(memberUserId).select('email').lean();
    const seat = await this.seats.findOne({
      sponsorUserId: principal.userId,
      $or: [
        { collaboratorUserId: new Types.ObjectId(memberUserId) },
        ...(user?.email ? [{ email: user.email.toLowerCase() }] : []),
      ],
      status: { $in: ['pending', 'active'] },
    });
    if (seat) {
      seat.resources = seat.resources.filter(
        (item) =>
          !(
            item.resourceType === 'workspace' &&
            item.resourceId.toString() === workspaceId
          ),
      );
      if (seat.resources.length === 0) {
        seat.status = 'revoked';
        seat.slot = undefined;
      }
      await seat.save();
    }

    await this.invites.updateMany(
      {
        resourceType: 'workspace',
        resourceId: new Types.ObjectId(workspaceId),
        inviteeUserId: new Types.ObjectId(memberUserId),
        status: 'pending',
      },
      { $set: { status: 'revoked' } },
    );

    return { removed: true };
  }

  async revokeSeat(seatId: string, sponsorUserId: string) {
    const seat = await this.seats.findOne({
      _id: seatId,
      sponsorUserId,
      status: { $in: ['pending', 'active'] },
    });
    if (!seat) throw new NotFoundException('Collaboration seat not found');

    const workspaceIds = seat.resources
      .filter((item) => item.resourceType === 'workspace')
      .map((item) => item.resourceId);
    const calendarIds = seat.resources
      .filter((item) => item.resourceType === 'calendar')
      .map((item) => item.resourceId);

    if (seat.collaboratorUserId && workspaceIds.length) {
      await this.memberships.deleteMany({
        workspaceId: { $in: workspaceIds },
        userId: seat.collaboratorUserId,
        role: 'member',
      });
    }
    if (seat.collaboratorUserId && calendarIds.length) {
      await this.calendarMemberships.deleteMany({
        calendarId: { $in: calendarIds },
        userId: seat.collaboratorUserId,
        sponsorUserId: seat.sponsorUserId,
      });
    }
    await this.invites.updateMany(
      {
        sponsorUserId: seat.sponsorUserId,
        email: seat.email,
        status: 'pending',
      },
      { $set: { status: 'revoked' } },
    );
    seat.status = 'revoked';
    seat.resources = [];
    seat.slot = undefined;
    await seat.save();
    return { revoked: true };
  }

  private async reserveSeat(
    sponsorUserId: string,
    email: string,
    collaboratorUserId: Types.ObjectId | undefined,
    resource: CollaborationResourceRef,
  ): Promise<CollaborationSeatDocument> {
    const seatLimit =
      (await this.entitlements.collaboratorSeatLimit(sponsorUserId)) || 5;
    const identity = collaboratorUserId
      ? { $or: [{ collaboratorUserId }, { email }] }
      : { email };
    let seat = await this.seats.findOne({ sponsorUserId, ...identity });
    if (seat && seat.status !== 'revoked') {
      await this.seats.updateOne(
        { _id: seat._id },
        { $addToSet: { resources: resource } },
      );
      seat = await this.seats.findById(seat._id);
      if (!seat) throw new ConflictException('Seat changed concurrently');
      return seat;
    }

    for (let slot = 1; slot <= seatLimit; slot += 1) {
      try {
        if (seat) {
          const reactivated = await this.seats.findOneAndUpdate(
            { _id: seat._id, status: 'revoked' },
            {
              $set: {
                status: 'pending',
                slot,
                email,
                ...(collaboratorUserId ? { collaboratorUserId } : {}),
                resources: [resource],
              },
            },
            { new: true },
          );
          if (reactivated) return reactivated;
        } else {
          return await this.seats.create({
            sponsorUserId: new Types.ObjectId(sponsorUserId),
            collaboratorUserId,
            email,
            slot,
            status: 'pending',
            resources: [resource],
          });
        }
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
        const concurrentlyCreated = await this.seats.findOne({
          sponsorUserId,
          ...identity,
          status: { $ne: 'revoked' },
        });
        if (concurrentlyCreated) {
          await this.seats.updateOne(
            { _id: concurrentlyCreated._id },
            { $addToSet: { resources: resource } },
          );
          return concurrentlyCreated;
        }
      }
    }
    const status = await this.entitlements.statusFor(sponsorUserId);
    throw this.paymentRequired(
      'SEAT_LIMIT',
      `A ${status.isBusiness ? 'Business' : 'Plus'} owner can sponsor at most ${seatLimit} collaborators`,
      undefined,
      {
        seatLimit,
        ...(status.isBusiness ? {} : { upgradeTo: 'business' as const }),
      },
    );
  }

  private async assertCanInvite(
    resourceType: 'workspace' | 'calendar',
    resourceId: string,
    sponsorUserId: string,
  ): Promise<string> {
    if (resourceType === 'workspace') {
      const [workspace, membership] = await Promise.all([
        this.workspaces
          .findOne({ _id: resourceId, deletedAt: { $exists: false } })
          .lean(),
        this.memberships
          .findOne({
            workspaceId: resourceId,
            userId: sponsorUserId,
            role: { $in: ['owner', 'admin'] },
          })
          .lean(),
      ]);
      if (!workspace) throw new NotFoundException('Workspace not found');
      if (!membership) {
        throw new ForbiddenException('Only workspace owners/admins can invite');
      }
      return workspace.name;
    }
    const calendar = await this.calendars
      .findOne({ _id: resourceId, deletedAt: { $exists: false } })
      .lean();
    if (!calendar) throw new NotFoundException('Calendar not found');
    if (calendar.ownerId.toString() !== sponsorUserId) {
      throw new ForbiddenException('Only the calendar owner can invite');
    }
    return calendar.name;
  }

  private async assertNoExistingAccess(
    resourceType: 'workspace' | 'calendar',
    resourceId: string,
    inviteeUserId?: Types.ObjectId,
  ) {
    if (!inviteeUserId) return;
    const existing =
      resourceType === 'workspace'
        ? await this.memberships.exists({
            workspaceId: resourceId,
            userId: inviteeUserId,
          })
        : await this.calendarMemberships.exists({
            calendarId: resourceId,
            userId: inviteeUserId,
          });
    if (existing) throw new ConflictException('User already has access');
  }

  private assertRoleForResource(
    resourceType: 'workspace' | 'calendar',
    role: 'member' | 'editor' | 'viewer',
  ) {
    if (resourceType === 'workspace' && role !== 'member') {
      throw new BadRequestException('Workspace invites must use member role');
    }
    if (resourceType === 'calendar' && role === 'member') {
      throw new BadRequestException(
        'Calendar invites must use editor or viewer role',
      );
    }
  }

  private findPendingInvite(rawToken: string) {
    return this.invites
      .findOne({ tokenHash: this.digest(rawToken), status: 'pending' })
      .select('+tokenHash')
      .orFail(() => new NotFoundException('Invite is invalid or expired'));
  }

  private async expireInvite(invite: CollaborationInvite) {
    await this.invites.updateOne(
      { _id: invite._id, status: 'pending' },
      { $set: { status: 'expired' } },
    );
    await this.seats.updateOne(
      {
        sponsorUserId: invite.sponsorUserId,
        email: invite.email,
        status: 'pending',
      },
      {
        $pull: {
          resources: {
            resourceType: invite.resourceType,
            resourceId: invite.resourceId,
          },
        },
      },
    );
    const seat = await this.seats.findOne({
      sponsorUserId: invite.sponsorUserId,
      email: invite.email,
      status: 'pending',
    });
    if (seat && seat.resources.length === 0) {
      seat.status = 'revoked';
      seat.slot = undefined;
      await seat.save();
    }
  }

  private async resourceName(
    resourceType: 'workspace' | 'calendar',
    resourceId: string,
  ) {
    const resource =
      resourceType === 'workspace'
        ? await this.workspaces.findById(resourceId).select('name').lean()
        : await this.calendars.findById(resourceId).select('name').lean();
    return resource?.name ?? 'Shared resource';
  }

  private buildInviteUrl(token: string): string {
    const base = (
      this.config.get<string>('APP_WEB_URL') ||
      this.config.get<string>('APP_PUBLIC_URL') ||
      this.config.get<string>('PUBLIC_WEB_ORIGIN') ||
      'https://tecnowallet.app'
    ).replace(/\/+$/, '');
    // Separate path from /invite/[token] (recaudos). Hostinger static export
    // only deep-links reliably via directory/index.html (not *.html URLs —
    // Expo Router treats those as unmatched).
    return `${base}/colaborar/?token=${encodeURIComponent(token)}`;
  }

  private isNonProduction() {
    return this.config.get<string>('NODE_ENV', 'development') !== 'production';
  }

  private digest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
  }

  private isDuplicateKey(error: unknown): error is { code: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private paymentRequired(
    code: 'SEAT_LIMIT' | 'SHARING_REQUIRED',
    message: string,
    action?: string,
    extra?: { seatLimit?: number; upgradeTo?: 'business' },
  ) {
    return new PaymentRequiredException({
      statusCode: 402,
      error: 'Payment Required',
      message,
      code,
      reason: {
        feature: 'collaboration',
        code,
        ...(action ? { action } : {}),
        ...(extra?.seatLimit !== undefined
          ? { seatLimit: extra.seatLimit }
          : {}),
        ...(extra?.upgradeTo ? { upgradeTo: extra.upgradeTo } : {}),
      },
    });
  }

  private async assertSharingPlus(userId: string, action: string) {
    if (await this.entitlements.isPlus(userId)) return;
    throw this.paymentRequired(
      'SHARING_REQUIRED',
      'TecnoWallet Plus is required to sponsor collaborators',
      action,
    );
  }
}

@Injectable()
export class CalendarService {
  constructor(
    @InjectModel(Calendar.name)
    private readonly calendars: Model<Calendar>,
    @InjectModel(CalendarMembership.name)
    private readonly memberships: Model<CalendarMembership>,
    @InjectModel(CalendarItemRecord.name)
    private readonly items: Model<CalendarItemRecord>,
    @InjectModel(Membership.name)
    private readonly workspaceMemberships: Model<Membership>,
    @InjectModel(CollaborationSeat.name)
    private readonly seats: Model<CollaborationSeat>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    private readonly entitlements: EntitlementService,
    private readonly push: PushService,
  ) {}

  async create(dto: CreateCalendarDto, userId: string) {
    const workspaceRole = await this.workspaceMemberships.findOne({
      workspaceId: dto.workspaceId,
      userId,
      role: { $in: ['owner', 'admin'] },
    });
    if (!workspaceRole) {
      throw new ForbiddenException(
        'Only workspace owners/admins can create calendars',
      );
    }
    const calendar = await this.calendars.create({
      workspaceId: new Types.ObjectId(dto.workspaceId),
      ownerId: new Types.ObjectId(userId),
      name: dto.name.trim(),
      color: dto.color,
      icon: dto.icon,
      migrationSourceId: dto.migrationSourceId,
    });
    await this.memberships.create({
      calendarId: calendar._id,
      userId: new Types.ObjectId(userId),
      role: 'owner',
    });
    return calendar;
  }

  async list(query: ListCalendarsQueryDto, userId: string) {
    const memberships = await this.memberships.find({ userId }).lean();
    const allowedIds: Types.ObjectId[] = [];
    for (const membership of memberships) {
      if (!membership.sponsorUserId) {
        allowedIds.push(membership.calendarId);
        continue;
      }
      if (
        (await this.entitlements.isPlus(membership.sponsorUserId.toString())) &&
        (await this.seats.exists({
          sponsorUserId: membership.sponsorUserId,
          collaboratorUserId: userId,
          status: 'active',
          resources: {
            $elemMatch: {
              resourceType: 'calendar',
              resourceId: membership.calendarId,
            },
          },
        }))
      ) {
        allowedIds.push(membership.calendarId);
      }
    }
    return this.calendars
      .find({
        _id: { $in: allowedIds },
        deletedAt: { $exists: false },
        ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
      })
      .sort({ updatedAt: -1 })
      .lean();
  }

  async update(id: string, dto: UpdateCalendarDto, userId: string) {
    const calendar = await this.calendars.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');
    await this.assertAccess(id, userId, ['owner', 'editor']);
    if (dto.name !== undefined) calendar.name = dto.name;
    if (dto.color !== undefined) calendar.color = dto.color;
    if (dto.icon !== undefined) calendar.icon = dto.icon;
    return calendar.save();
  }

  async remove(id: string, userId: string) {
    const calendar = await this.calendars.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!calendar) throw new NotFoundException('Calendar not found');
    await this.assertAccess(id, userId, ['owner']);
    calendar.deletedAt = new Date();
    await calendar.save();
    await this.items.updateMany(
      { calendarId: id, deletedAt: { $exists: false } },
      { $set: { deletedAt: new Date() } },
    );
    return { deleted: true, id };
  }

  /** Owner-only gate for viewing/creating the public share code. */
  async requireOwner(id: string, userId: string) {
    await this.assertAccess(id, userId, ['owner']);
  }

  async members(id: string, userId: string) {
    await this.assertAccess(id, userId, ['owner', 'editor', 'viewer']);
    const memberships = await this.memberships.find({ calendarId: id }).lean();
    const userIds = memberships.map((membership) => membership.userId);
    const users = await this.usersForMemberships(userIds);
    return memberships.map((membership) => ({
      id: membership._id,
      userId: membership.userId,
      role: membership.role,
      name: users.get(membership.userId.toString())?.name,
      email: users.get(membership.userId.toString())?.email,
      sponsored: Boolean(membership.sponsorUserId),
    }));
  }

  async removeMember(
    calendarId: string,
    memberUserId: string,
    ownerId: string,
  ) {
    await this.assertAccess(calendarId, ownerId, ['owner']);
    const membership = await this.memberships.findOne({
      calendarId,
      userId: memberUserId,
      role: { $ne: 'owner' },
    });
    if (!membership) throw new NotFoundException('Calendar member not found');
    await membership.deleteOne();
    if (membership.sponsorUserId) {
      const seat = await this.seats.findOne({
        sponsorUserId: membership.sponsorUserId,
        collaboratorUserId: memberUserId,
        status: { $in: ['active', 'pending'] },
      });
      if (seat) {
        seat.resources = seat.resources.filter(
          (resource) =>
            !(
              resource.resourceType === 'calendar' &&
              resource.resourceId.toString() === calendarId
            ),
        );
        if (seat.resources.length === 0) {
          seat.status = 'revoked';
          seat.slot = undefined;
        }
        await seat.save();
      }
    }
    return { removed: true };
  }

  async listItems(calendarId: string, userId: string) {
    await this.assertAccess(calendarId, userId, ['owner', 'editor', 'viewer']);
    return this.items
      .find({ calendarId, deletedAt: { $exists: false } })
      .sort({ 'data.date': 1, createdAt: 1 })
      .lean();
  }

  async createItem(dto: CreateCalendarItemDto, userId: string) {
    await this.assertAccess(dto.calendarId, userId, ['owner', 'editor']);
    this.validateItemData(dto.data);
    const created = await this.items.create({
      ...(dto.id ? { _id: new Types.ObjectId(dto.id) } : {}),
      calendarId: new Types.ObjectId(dto.calendarId),
      ownerId: new Types.ObjectId(userId),
      data: dto.data,
    });
    const [actor, calendar] = await Promise.all([
      this.users.findById(userId).select('name').lean(),
      this.calendars.findById(dto.calendarId).select('name').lean(),
    ]);
    const who = actor?.name?.trim() || 'Un colaborador';
    const calendarName = calendar?.name?.trim() || 'Calendario';
    const title =
      typeof dto.data.title === 'string' ? dto.data.title.trim() : 'Elemento';
    const date =
      typeof dto.data.date === 'string' ? dto.data.date : '';
    const type = String(dto.data.type || 'event');
    const kindLabel =
      type === 'task' ? 'tarea' : type === 'birthday' ? 'cumpleaños' : 'evento';
    this.push.notifyCalendarMembers(dto.calendarId, userId, {
      title: 'Calendario compartido',
      body: `${who} agregó ${kindLabel} «${title}»${date ? ` · ${date}` : ''} · ${calendarName}`,
      data: {
        kind: 'calendar',
        route: '/(tabs)/calendario',
        notificationId: `cal-${dto.calendarId}-${String(created._id)}`,
      },
      sound: 'calendario.wav',
    });
    return created;
  }

  async updateItem(id: string, dto: UpdateCalendarItemDto, userId: string) {
    const item = await this.items.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!item) throw new NotFoundException('Calendar item not found');
    await this.assertAccess(item.calendarId.toString(), userId, [
      'owner',
      'editor',
    ]);
    this.validateItemData(dto.data);
    item.data = dto.data;
    return item.save();
  }

  async removeItem(id: string, userId: string) {
    const item = await this.items.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!item) throw new NotFoundException('Calendar item not found');
    await this.assertAccess(item.calendarId.toString(), userId, [
      'owner',
      'editor',
    ]);
    item.deletedAt = new Date();
    await item.save();
    return { deleted: true, id };
  }

  private validateItemData(data: Record<string, unknown>) {
    if (
      typeof data.title !== 'string' ||
      !data.title.trim() ||
      data.title.length > 200
    ) {
      throw new BadRequestException('Calendar item title is required');
    }
    if (
      typeof data.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.date)
    ) {
      throw new BadRequestException('Calendar item date must be YYYY-MM-DD');
    }
    if (
      !['event', 'task', 'birthday'].includes(String(data.type)) ||
      typeof data.allDay !== 'boolean'
    ) {
      throw new BadRequestException('Invalid calendar item type');
    }
  }

  private async usersForMemberships(userIds: Types.ObjectId[]) {
    const users = await this.users
      .find({ _id: { $in: userIds } })
      .select('name email')
      .lean();
    return new Map(users.map((user) => [user._id.toString(), user]));
  }

  async assertAccess(
    calendarId: string,
    userId: string,
    roles: Array<'owner' | 'editor' | 'viewer'>,
  ) {
    const membership = await this.memberships.findOne({
      calendarId,
      userId,
      role: { $in: roles },
    });
    if (!membership) throw new ForbiddenException('Calendar access denied');
    if (!membership.sponsorUserId) return membership;

    const [sponsorIsPlus, activeSeat] = await Promise.all([
      this.entitlements.isPlus(membership.sponsorUserId.toString()),
      this.seats.exists({
        sponsorUserId: membership.sponsorUserId,
        collaboratorUserId: userId,
        status: 'active',
        resources: {
          $elemMatch: {
            resourceType: 'calendar',
            resourceId: membership.calendarId,
          },
        },
      }),
    ]);
    if (!sponsorIsPlus || !activeSeat) {
      throw this.suspendedAccess();
    }
    return membership;
  }

  private suspendedAccess() {
    return new PaymentRequiredException({
      statusCode: 402,
      error: 'Payment Required',
      message: 'Sponsored calendar access is suspended',
      code: 'SHARING_REQUIRED',
      reason: { feature: 'collaboration', action: 'calendar_access' },
    });
  }
}
