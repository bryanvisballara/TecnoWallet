import {
  BadRequestException,
  Body,
  Controller,
  ConflictException,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  InjectConnection,
  InjectModel,
  MongooseModule,
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Connection, Model, Types } from 'mongoose';
import type { FastifyReply } from 'fastify';
import {
  AuthModule,
  CurrentUser,
  Membership,
  User,
  Workspace,
} from '../auth/auth.module';
import type { AuthPrincipal } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import {
  EntitlementService,
  PaymentRequiredException,
} from '../billing/entitlement.service';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { CollaborationService } from '../collaboration/collaboration.service';
import {
  CreateTransactionDto,
  LedgerService,
  LedgerTransaction,
  LedgerTransactionSchema,
} from '../ledger/ledger';
import { BrevoMailer } from '../mail/brevo';
import { inviteEmailHtml, inviteEmailSubject } from '../mail/invite-email';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import { PushService } from '../push/push.service';

const resourceKinds = [
  'category',
  'account',
  'envelope',
  'budget',
  'goal',
  'bill',
  'subscription',
  'notification',
  'attachment',
  'receipt',
  'setting',
  'achievement',
  'bank_connection',
] as const;
type ResourceKind = (typeof resourceKinds)[number];

@Schema({ timestamps: true, optimisticConcurrency: true })
export class FinanceResource {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: resourceKinds, index: true })
  kind!: ResourceKind;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['workspace', 'private'],
    default: 'workspace',
  })
  privacy!: 'workspace' | 'private';

  @Prop({ required: true, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  data!: Record<string, unknown>;

  @Prop({ default: 1 })
  version!: number;

  @Prop({ index: true })
  deletedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const FinanceResourceSchema =
  SchemaFactory.createForClass(FinanceResource);
FinanceResourceSchema.index({
  workspaceId: 1,
  kind: 1,
  deletedAt: 1,
  updatedAt: -1,
});
FinanceResourceSchema.index(
  { workspaceId: 1, kind: 1, name: 1 },
  { collation: { locale: 'en', strength: 2 } },
);
FinanceResourceSchema.index({ name: 'text', 'data.description': 'text' });
FinanceResourceSchema.index(
  { workspaceId: 1, kind: 1, 'data.kind': 1, 'data.freeQuotaSlot': 1 },
  {
    unique: true,
    partialFilterExpression: {
      kind: 'envelope',
      'data.freeQuotaSlot': { $type: 'number' },
    },
  },
);

@Schema({ timestamps: true })
class IdempotencyRecord {
  @Prop({ required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  key!: string;

  @Prop({ required: true, type: Object })
  response!: Record<string, unknown>;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;
}
const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecord);
IdempotencyRecordSchema.index({ userId: 1, key: 1 }, { unique: true });

class ResourceDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsEnum(['workspace', 'private'])
  privacy?: 'workspace' | 'private';

  @IsObject()
  data!: Record<string, unknown>;
}

class UpdateResourceDto {
  @IsOptional()
  @IsInt()
  baseVersion?: number;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsEnum(['workspace', 'private'])
  privacy?: 'workspace' | 'private';

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

class CreateWorkspaceDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsEnum(['personal', 'shared'])
  type!: 'personal' | 'shared';

  @IsString()
  @Length(3, 3)
  baseCurrency!: string;

  @IsOptional()
  @IsString()
  @Length(4, 16)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  icon?: string;
}

class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @IsOptional()
  @IsEnum(['personal', 'shared'])
  type?: 'personal' | 'shared';

  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;

  @IsOptional()
  @IsString()
  @Length(4, 16)
  color?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  icon?: string;
}

class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(['admin', 'member', 'viewer'])
  role!: 'admin' | 'member' | 'viewer';
}

class ProjectionQuery {
  @IsOptional()
  @Min(1)
  @Max(365)
  days?: number;
}

class InsightQuery {
  @IsOptional()
  @IsBoolean()
  deterministic?: boolean;
}

export abstract class OcrProvider {
  abstract extract(sourceUri: string): Promise<{
    amountMinor?: number;
    date?: string;
    merchant?: string;
    taxMinor?: number;
    products: string[];
    suggestedCategory?: string;
  }>;
}

@Injectable()
class ReviewRequiredOcrProvider implements OcrProvider {
  extract(sourceUri: string) {
    return Promise.resolve({
      merchant: sourceUri.split('/').at(-1)?.slice(0, 80) ?? 'Recibo',
      products: [],
      suggestedCategory: 'uncategorized',
    });
  }
}

@Injectable()
class WorkspaceAccessService {
  constructor(
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
  ) {}

  /**
   * Membership is the source of truth for book access.
   * Plus is enforced when inviting/sharing — not on every collaborator read/write
   * (otherwise Free collaborators freeze/fail mid-session if sponsor billing lags).
   */
  async assertMember(workspaceId: string, userId: string): Promise<void> {
    const member = await this.memberships
      .findOne({ workspaceId, userId })
      .select('role')
      .lean();
    if (!member) throw new ForbiddenException('Workspace access denied');
  }
}

@Injectable()
class ResourceService {
  constructor(
    @InjectModel(FinanceResource.name)
    private readonly resources: Model<FinanceResource>,
    @InjectModel(Workspace.name)
    private readonly workspaces: Model<Workspace>,
    private readonly access: WorkspaceAccessService,
    private readonly ocr: OcrProvider,
    private readonly entitlements: EntitlementService,
    private readonly push: PushService,
    private readonly ledger: LedgerService,
  ) {}

  assertKind(kind: string): asserts kind is ResourceKind {
    if (!resourceKinds.includes(kind as ResourceKind)) {
      throw new NotFoundException('Unknown resource type');
    }
  }

  async create(kind: string, dto: ResourceDto, principal: AuthPrincipal) {
    this.assertKind(kind);
    await this.access.assertMember(dto.workspaceId, principal.userId);
    this.validatePayload(kind, dto.data);
    if (kind === 'envelope') {
      const created = await this.createEnvelopeWithPlanLimit(dto, principal);
      this.notifyTeamResourceCreated(created, principal);
      return created;
    }
    const created = await this.resources.create({
      ...dto,
      kind,
      ownerId: principal.userId,
    });
    this.notifyTeamResourceCreated(created, principal);
    return created;
  }

  private isTeamNotifiableKind(kind: string): kind is ResourceKind {
    return (
      kind === 'envelope' ||
      kind === 'account' ||
      kind === 'goal' ||
      kind === 'bill' ||
      kind === 'subscription'
    );
  }

  /** Push to other workspace members for collaborative creates/updates/deletes. */
  private notifyTeamResourceCreated(
    created: FinanceResource,
    principal: AuthPrincipal,
  ) {
    this.notifyTeamResourceChange(created, principal, 'created');
  }

  private notifyTeamResourceChange(
    resource: FinanceResource,
    principal: AuthPrincipal,
    action: 'created' | 'updated' | 'deleted',
  ) {
    const kind = resource.kind;
    if (!this.isTeamNotifiableKind(kind)) return;
    if (resource.privacy === 'private') return;
    // Never ping for system/clearing accounts.
    if (
      kind === 'account' &&
      (resource.name === '__clearing__' || resource.data?.system === true)
    ) {
      return;
    }

    const workspaceId = resource.workspaceId.toString();
    const resourceId = resource._id.toString();
    const name = resource.name?.trim() || 'Elemento';
    const copy = this.teamChangeCopy(kind, resourceId, action);

    void (async () => {
      const [who, book] = await Promise.all([
        this.push.userDisplayName(principal.userId),
        this.push.workspaceName(workspaceId),
      ]);
      this.push.notifyWorkspaceMembers(workspaceId, principal.userId, {
        title: copy.title,
        body: `${who} ${copy.verb} «${name}» · ${book}`,
        data: {
          kind: copy.dataKind,
          route: copy.route,
          notificationId: `${copy.idPrefix}-${action.slice(0, 3)}-${workspaceId}-${resourceId}-${Date.now()}`,
        },
        sound: 'sobres.wav',
      });
    })().catch(() => {
      // Push must never roll back resource mutations.
    });
  }

  private teamChangeCopy(
    kind: ResourceKind,
    resourceId: string,
    action: 'created' | 'updated' | 'deleted',
  ): {
    title: string;
    verb: string;
    dataKind: string;
    route: string;
    idPrefix: string;
  } {
    const verbs = {
      created: {
        envelope: 'creó el sobre',
        account: 'agregó la cuenta',
        goal: 'creó la meta',
        plan: 'agregó',
      },
      updated: {
        envelope: 'actualizó el sobre',
        account: 'actualizó la cuenta',
        goal: 'actualizó la meta',
        plan: 'actualizó',
      },
      deleted: {
        envelope: 'eliminó el sobre',
        account: 'eliminó la cuenta',
        goal: 'eliminó la meta',
        plan: 'eliminó',
      },
    } as const;

    if (kind === 'envelope') {
      return {
        title: 'Sobre del equipo',
        verb: verbs[action].envelope,
        dataKind: 'envelope',
        route: `/(tabs)/envelope/${resourceId}`,
        idPrefix: 'env',
      };
    }
    if (kind === 'account') {
      return {
        title: 'Cuenta del equipo',
        verb: verbs[action].account,
        dataKind: 'account',
        route: `/(tabs)/account/${resourceId}`,
        idPrefix: 'acc',
      };
    }
    if (kind === 'goal') {
      return {
        title: 'Meta del equipo',
        verb: verbs[action].goal,
        dataKind: 'goal',
        route: `/(tabs)/goal/${resourceId}`,
        idPrefix: 'goal',
      };
    }
    // bill / subscription → salud financiera
    return {
      title: 'Salud financiera',
      verb: verbs[action].plan,
      dataKind: 'planning',
      route: '/(tabs)/salud-financiera',
      idPrefix: 'plan',
    };
  }

  private async createEnvelopeWithPlanLimit(
    dto: ResourceDto,
    principal: AuthPrincipal,
  ) {
    const envelopeKind = dto.data.kind;
    if (!['income', 'expense', 'savings'].includes(String(envelopeKind))) {
      throw new BadRequestException(
        'Envelope kind must be income, expense, or savings',
      );
    }
    const workspace = await this.workspaces
      .findOne({ _id: dto.workspaceId, deletedAt: { $exists: false } })
      .select('ownerId')
      .lean();
    if (!workspace) throw new NotFoundException('Workspace not found');

    const ownerId = workspace.ownerId.toString();
    const ownerIsPlus = await this.entitlements.isPlus(ownerId);
    const requesterIsOwner = ownerId === principal.userId;
    // Collaborators already passed membership. Envelope quotas/Plus apply to the
    // book owner only — never block a teammate mid-create with a paywall.
    if (!requesterIsOwner) {
      return this.resources.create({
        ...dto,
        kind: 'envelope',
        ownerId: principal.userId,
      });
    }
    if (ownerIsPlus || envelopeKind === 'savings') {
      return this.resources.create({
        ...dto,
        kind: 'envelope',
        ownerId: principal.userId,
      });
    }

    const quotaKind = String(envelopeKind);
    const existing = await this.resources
      .find({
        workspaceId: dto.workspaceId,
        kind: 'envelope',
        'data.kind': quotaKind,
        deletedAt: { $exists: false },
      })
      .sort({ createdAt: 1, _id: 1 })
      .limit(6);
    if (existing.length >= 5) {
      throw this.envelopeLimit();
    }

    const occupied = new Set<number>();
    for (const item of existing) {
      const slot = Number(item.data.freeQuotaSlot);
      if (Number.isInteger(slot) && slot >= 1 && slot <= 5) {
        occupied.add(slot);
      }
    }
    for (const item of existing) {
      if (Number.isInteger(Number(item.data.freeQuotaSlot))) continue;
      const slot = [1, 2, 3, 4, 5].find((value) => !occupied.has(value));
      if (!slot) throw this.envelopeLimit();
      try {
        await this.resources.updateOne(
          { _id: item._id, 'data.freeQuotaSlot': { $exists: false } },
          { $set: { 'data.freeQuotaSlot': slot } },
        );
        occupied.add(slot);
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
      }
    }

    for (const slot of [1, 2, 3, 4, 5]) {
      if (occupied.has(slot)) continue;
      try {
        return await this.resources.create({
          ...dto,
          data: { ...dto.data, freeQuotaSlot: slot },
          kind: 'envelope',
          ownerId: principal.userId,
        });
      } catch (error) {
        if (!this.isDuplicateKey(error)) throw error;
      }
    }
    throw this.envelopeLimit();
  }

  private envelopeLimit() {
    return new PaymentRequiredException({
      statusCode: 402,
      code: 'PLUS_REQUIRED',
      message: 'Free includes up to 5 envelopes of each type',
      reason: 'ENVELOPE_LIMIT',
    });
  }

  private isDuplicateKey(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    );
  }

  async list(
    kind: string,
    workspaceId: string,
    principal: AuthPrincipal,
    search?: string,
    limit = 50,
  ) {
    this.assertKind(kind);
    await this.access.assertMember(workspaceId, principal.userId);
    const privacy = {
      $or: [
        { privacy: 'workspace' },
        { privacy: 'private', ownerId: principal.userId },
      ],
    };
    return this.resources
      .find({
        workspaceId,
        kind,
        deletedAt: { $exists: false },
        ...privacy,
        ...(search ? { $text: { $search: search } } : {}),
      })
      .sort({ updatedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async update(
    kind: string,
    id: string,
    dto: UpdateResourceDto,
    principal: AuthPrincipal,
  ) {
    this.assertKind(kind);
    if (dto.data) this.validatePayload(kind, dto.data);
    const resource = await this.resources.findOne({
      _id: id,
      kind,
      deletedAt: { $exists: false },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    await this.access.assertMember(
      resource.workspaceId.toString(),
      principal.userId,
    );
    if (dto.baseVersion !== undefined && resource.version !== dto.baseVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        serverVersion: resource.version,
        serverValue: resource.toObject(),
      });
    }
    if (
      resource.privacy === 'private' &&
      resource.ownerId.toString() !== principal.userId
    ) {
      throw new ForbiddenException('Private resource access denied');
    }
    // Only apply defined fields. Spreading the ValidationPipe DTO includes
    // `privacy: undefined` / etc., and Object.assign would wipe required paths
    // so Mongoose save() fails on every edit.
    if (dto.name !== undefined) resource.name = dto.name;
    if (dto.privacy !== undefined) resource.privacy = dto.privacy;
    if (dto.data !== undefined) {
      resource.data = { ...(resource.data ?? {}), ...dto.data };
      resource.markModified('data');
    }
    resource.version = (resource.version ?? 1) + 1;
    const saved = await resource.save();
    const isTombstone = Boolean(
      dto.data &&
        typeof dto.data === 'object' &&
        (dto.data as Record<string, unknown>).tombstone === true,
    );
    if (!isTombstone) {
      this.notifyTeamResourceChange(saved, principal, 'updated');
    }
    return saved;
  }

  async remove(kind: string, id: string, principal: AuthPrincipal) {
    // Deleting a bank/cash account must void its income/expense movements so
    // liquidity and the movements list stay consistent.
    if (kind === 'account') {
      await this.ledger.reverseAllForAccount(id, 'Cuenta eliminada');
    }
    return this.update(kind, id, { data: { tombstone: true } }, principal).then(
      async (resource) => {
        resource.deletedAt = new Date();
        // Free freemium envelope slots so soft-deleted docs don't block recreates.
        if (
          kind === 'envelope' &&
          resource.data &&
          Object.prototype.hasOwnProperty.call(resource.data, 'freeQuotaSlot')
        ) {
          const next = { ...resource.data };
          delete next.freeQuotaSlot;
          resource.data = next;
          resource.markModified('data');
        }
        const saved = await resource.save();
        this.notifyTeamResourceChange(saved, principal, 'deleted');
        return saved;
      },
    );
  }

  async processReceipt(id: string, principal: AuthPrincipal) {
    const receipt = await this.resources.findOne({
      _id: id,
      kind: 'receipt',
      deletedAt: { $exists: false },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    await this.access.assertMember(
      receipt.workspaceId.toString(),
      principal.userId,
    );
    const sourceUri =
      typeof receipt.data.sourceUri === 'string' ? receipt.data.sourceUri : '';
    if (!sourceUri) throw new BadRequestException('Receipt has no source URI');
    const extracted = await this.ocr.extract(sourceUri);
    receipt.data = {
      ...receipt.data,
      ocrState: 'completed',
      extracted,
      requiresReview: true,
    };
    receipt.version += 1;
    return receipt.save();
  }

  private validatePayload(kind: ResourceKind, data: Record<string, unknown>) {
    const moneyFields: Record<string, string[]> = {
      account: ['balanceMinor'],
      envelope: ['budgetMinor', 'balanceMinor'],
      budget: ['limitMinor'],
      goal: ['targetMinor', 'savedMinor'],
      bill: ['amountMinor'],
      subscription: ['amountMinor'],
    };
    for (const field of moneyFields[kind] ?? []) {
      if (data[field] !== undefined && !Number.isSafeInteger(data[field])) {
        throw new BadRequestException(`${field} must be integer minor units`);
      }
    }
    if (
      data.currency !== undefined &&
      (typeof data.currency !== 'string' || !/^[A-Z]{3}$/.test(data.currency))
    ) {
      throw new BadRequestException('currency must be uppercase ISO 4217');
    }
    if (
      (kind === 'attachment' || kind === 'receipt') &&
      data.ocrState !== undefined &&
      (typeof data.ocrState !== 'string' ||
        !['pending', 'processing', 'completed', 'failed'].includes(
          data.ocrState,
        ))
    ) {
      throw new BadRequestException('Invalid OCR state');
    }
    if (
      kind === 'envelope' &&
      data.rollover !== undefined &&
      typeof data.rollover !== 'boolean'
    ) {
      throw new BadRequestException('rollover must be boolean');
    }
  }
}

@ApiTags('resources')
@ApiBearerAuth()
@Controller('resources')
class ResourceController {
  constructor(private readonly resources: ResourceService) {}

  @Post(':kind')
  create(
    @Param('kind') kind: string,
    @Body() dto: ResourceDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.resources.create(kind, dto, user);
  }

  @Get(':kind')
  list(
    @Param('kind') kind: string,
    @Query('workspaceId') workspaceId: string,
    @Query('search') search: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.resources.list(
      kind,
      workspaceId,
      user,
      search,
      limit ? Number(limit) : 50,
    );
  }

  @Patch(':kind/:id')
  update(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() dto: UpdateResourceDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.resources.update(kind, id, dto, user);
  }

  @Delete(':kind/:id')
  remove(
    @Param('kind') kind: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.resources.remove(kind, id, user);
  }

  @Post('receipt/:id/ocr')
  processReceipt(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.resources.processReceipt(id, user);
  }
}

@ApiTags('workspaces')
@ApiBearerAuth()
@Controller('workspaces')
class WorkspaceController {
  constructor(
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly mailer: BrevoMailer,
    private readonly entitlements: EntitlementService,
    private readonly collaboration: CollaborationService,
    private readonly access: WorkspaceAccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const memberships = await this.memberships.find({ userId: user.userId });
    const workspaces = await this.workspaces.find({
      _id: { $in: memberships.map((member) => member.workspaceId) },
      deletedAt: { $exists: false },
    });
    const visible = await Promise.all(
      workspaces.map(async (workspace) => {
        if (workspace.ownerId.toString() === user.userId) return workspace;
        return (await this.entitlements.isPlus(workspace.ownerId.toString()))
          ? workspace
          : null;
      }),
    );
    const books = visible.filter(Boolean) as Workspace[];
    // Lazy backfill share codes for owners so join-by-ID works on older books.
    await Promise.all(
      books.map(async (workspace) => {
        if (
          workspace.ownerId.toString() === user.userId &&
          !workspace.shareCode
        ) {
          workspace.shareCode = await this.collaboration.ensureShareCode(
            workspace._id.toString(),
          );
        }
      }),
    );
    return books;
  }

  @Post()
  async create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const isPlus = await this.entitlements.isPlus(user.userId);
    if (!isPlus) {
      const owned = await this.workspaces.countDocuments({
        ownerId: user.userId,
        deletedAt: { $exists: false },
      });
      if (owned >= 1) {
        await this.entitlements.assertPlus(user.userId, {
          feature: 'BOOK_LIMIT',
        });
      }
    }
    let workspace: Workspace;
    try {
      workspace = await this.workspaces.create({
        name: dto.name.trim(),
        type: dto.type,
        baseCurrency: dto.baseCurrency.toUpperCase(),
        ownerId: user.userId,
        color: dto.color?.trim() || '#F5C518',
        icon: dto.icon?.trim() || 'wallet.pass.fill',
        shareCode: await this.collaboration.allocateShareCode(),
        ...(isPlus ? {} : { freeSlot: 1 }),
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        await this.entitlements.assertPlus(user.userId, {
          feature: 'BOOK_LIMIT',
        });
      }
      throw error;
    }
    await this.memberships.create({
      workspaceId: workspace._id,
      userId: user.userId,
      role: 'owner',
    });
    return workspace;
  }

  @Patch(':id')
  async update(
    @Param('id') workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    // Collaborators (members) can edit book metadata; invite/share stay owner-only.
    const requester = await this.memberships.findOne({
      workspaceId,
      userId: user.userId,
      role: { $in: ['owner', 'admin', 'member'] },
    });
    if (!requester) throw new ForbiddenException('Member access required');
    const workspace = await this.workspaces.findOne({
      _id: workspaceId,
      deletedAt: { $exists: false },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    if (dto.name !== undefined) workspace.name = dto.name.trim();
    if (dto.type !== undefined) workspace.type = dto.type;
    if (dto.baseCurrency !== undefined) {
      workspace.baseCurrency = dto.baseCurrency.trim().toUpperCase();
    }
    if (dto.color !== undefined) workspace.color = dto.color.trim();
    if (dto.icon !== undefined) workspace.icon = dto.icon.trim();
    return workspace.save();
  }

  @Delete(':id')
  async remove(
    @Param('id') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const requester = await this.memberships.findOne({
      workspaceId,
      userId: user.userId,
      role: 'owner',
    });
    if (!requester) throw new ForbiddenException('Owner access required');
    const activeCount = await this.memberships
      .find({ userId: user.userId })
      .then(async (memberships) => {
        const ids = memberships.map((member) => member.workspaceId);
        return this.workspaces.countDocuments({
          _id: { $in: ids },
          deletedAt: { $exists: false },
        });
      });
    if (activeCount <= 1) {
      throw new BadRequestException('Debes conservar al menos un libro.');
    }
    const workspace = await this.workspaces.findOne({
      _id: workspaceId,
      deletedAt: { $exists: false },
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    workspace.deletedAt = new Date();
    workspace.freeSlot = undefined;
    await workspace.save();
    return { deleted: true, id: workspaceId };
  }

  @Get(':id/share-code')
  async shareCode(
    @Param('id') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const membership = await this.memberships.findOne({
      workspaceId,
      userId: user.userId,
      role: { $in: ['owner', 'admin'] },
    });
    if (!membership) {
      throw new ForbiddenException('Only owners/admins can view the book ID');
    }
    const shareCode = await this.collaboration.ensureShareCode(workspaceId);
    return { shareCode };
  }

  @Get(':id/members')
  async members(
    @Param('id') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    await this.access.assertMember(workspaceId, user.userId);
    const memberships = await this.memberships.find({ workspaceId });
    const users = await this.users.find({
      _id: { $in: memberships.map((member) => member.userId) },
    });
    const seen = new Set<string>();
    return memberships.flatMap((member) => {
      const userId = member.userId?.toString?.() ?? String(member.userId ?? '');
      if (!userId || seen.has(userId)) return [];
      seen.add(userId);
      const profile = users.find((item) => item._id.equals(member.userId));
      return [
        {
          userId: member.userId,
          role: member.role,
          name: profile?.name,
          email: profile?.email,
        },
      ];
    });
  }

  @Post(':id/members')
  async addMember(
    @Param('id') workspaceId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const created = await this.collaboration.createInvite(
      {
        resourceType: 'workspace',
        resourceId: workspaceId,
        email: dto.email,
        role: 'member',
      },
      user,
    );
    const inviter = await this.users.findById(user.userId).lean();
    const inviterName =
      typeof inviter?.name === 'string' && inviter.name.trim()
        ? inviter.name.trim()
        : user.email.split('@')[0];
    const invited = await this.users.findOne({
      email: dto.email.toLowerCase(),
      active: true,
    });
    const payload = {
      kind: 'workspace' as const,
      resourceName: created.mailDispatch.resourceName,
      acceptLink: created.mailDispatch.inviteUrl,
      inviterName,
      roleLabel: 'miembro',
      pendingSignup: !invited,
    };
    const delivery = await this.mailer.sendHtml({
      to: created.mailDispatch.to,
      subject: inviteEmailSubject(payload),
      htmlContent: inviteEmailHtml(payload),
    });
    return {
      ...created.response,
      pendingSignup: !invited,
      delivered: delivery.delivered,
    };
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') memberUserId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.collaboration.removeWorkspaceMember(
      workspaceId,
      memberUserId,
      user,
    );
  }
}

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
class TransactionController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly access: WorkspaceAccessService,
    private readonly push: PushService,
    @InjectModel(LedgerTransaction.name)
    private readonly transactions: Model<LedgerTransaction>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectModel(Workspace.name)
    private readonly workspaces: Model<Workspace>,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    await this.access.assertMember(dto.workspaceId, user.userId);
    if (dto.private) {
      return this.ledger.create(dto, user.userId);
    }
    const created = await this.ledger.create(dto, user.userId);
    const [actor, workspace] = await Promise.all([
      this.users.findById(user.userId).select('name').lean(),
      this.workspaces.findById(dto.workspaceId).select('name').lean(),
    ]);
    const who = actor?.name?.trim() || 'Un colaborador';
    const book = workspace?.name?.trim() || 'Libro';
    const isIncome = dto.kind === 'income';
    const amountLabel = dto.entries
      ?.find((entry) => entry.amountMinor !== 0)
      ?.amountMinor;
    const absMinor = amountLabel ? Math.abs(amountLabel) : 0;
    const money =
      absMinor > 0
        ? (absMinor / 100).toLocaleString('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0,
          })
        : '';
    this.push.notifyWorkspaceMembers(dto.workspaceId, user.userId, {
      title: isIncome ? 'Ingreso del equipo' : 'Gasto del equipo',
      body: money
        ? `${who} registró ${dto.description} · ${money} · ${book}`
        : `${who} registró ${dto.description} · ${book}`,
      data: {
        kind: isIncome ? 'income' : 'expense',
        route: '/(tabs)/movimientos',
        notificationId: `tx-${dto.workspaceId}-${String(created._id)}`,
      },
      sound: isIncome ? 'ingreso.wav' : 'gasto.wav',
    });
    return created;
  }

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @Query('search') search: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Query('offset') offsetRaw: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    await this.access.assertMember(workspaceId, user.userId);
    const limit = Math.min(Math.max(Number(limitRaw) || 250, 1), 500);
    const offset = Math.max(Number(offsetRaw) || 0, 0);
    return this.transactions
      .find({
        workspaceId,
        $or: [
          { privacy: { $ne: 'private' } },
          { privacy: 'private', ownerId: user.userId },
        ],
        ...(search
          ? { description: { $regex: escapeRegex(search), $options: 'i' } }
          : {}),
      })
      .sort({ occurredAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit);
  }

  @Post(':id/reverse')
  async reverse(
    @Param('id') id: string,
    @Body('description') description: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const transaction = await this.transactions.findById(id);
    if (!transaction) throw new NotFoundException('Transaction not found');
    const workspaceId = transaction.workspaceId.toString();
    await this.access.assertMember(workspaceId, user.userId);
    const reversed = await this.ledger.reverse(id, description);
    if (transaction.privacy !== 'private') {
      const [who, book] = await Promise.all([
        this.push.userDisplayName(user.userId),
        this.push.workspaceName(workspaceId),
      ]);
      const isIncome = transaction.kind === 'income';
      this.push.notifyWorkspaceMembers(workspaceId, user.userId, {
        title: isIncome ? 'Ingreso del equipo' : 'Gasto del equipo',
        body: `${who} eliminó ${transaction.description || 'un movimiento'} · ${book}`,
        data: {
          kind: isIncome ? 'income' : 'expense',
          route: '/(tabs)/movimientos',
          notificationId: `tx-del-${workspaceId}-${id}`,
        },
        sound: isIncome ? 'ingreso.wav' : 'gasto.wav',
      });
    }
    return reversed;
  }
}

export abstract class AiInsightsProvider {
  abstract generate(input: {
    incomeMinor: number;
    expenseMinor: number;
  }): Promise<string[]>;
}

@Injectable()
class DeterministicInsightsProvider implements AiInsightsProvider {
  generate(input: {
    incomeMinor: number;
    expenseMinor: number;
  }): Promise<string[]> {
    const savings = input.incomeMinor - input.expenseMinor;
    return Promise.resolve([
      savings >= 0
        ? `You saved ${savings} minor units in this period.`
        : `Spending exceeded income by ${Math.abs(savings)} minor units.`,
      input.incomeMinor > 0
        ? `Savings rate: ${Math.round((savings / input.incomeMinor) * 100)}%.`
        : 'Add income transactions to calculate a savings rate.',
    ]);
  }
}

export abstract class BankProvider {
  abstract readonly name: 'plaid' | 'belvo' | 'fintoc';
  abstract exchangePublicToken(
    token: string,
  ): Promise<{ connectionId: string }>;
}

@Injectable()
class UnconfiguredBankProvider implements BankProvider {
  readonly name = 'plaid' as const;
  exchangePublicToken(): Promise<{ connectionId: string }> {
    return Promise.reject(
      new BadRequestException(
        'No bank provider is configured; inject a Plaid, Belvo, or Fintoc adapter',
      ),
    );
  }
}

@Injectable()
class AnalyticsService {
  constructor(
    @InjectModel(LedgerTransaction.name)
    private readonly transactions: Model<LedgerTransaction>,
    @InjectModel(FinanceResource.name)
    private readonly resources: Model<FinanceResource>,
    private readonly access: WorkspaceAccessService,
    private readonly insights: AiInsightsProvider,
  ) {}

  async summary(workspaceId: string, userId: string) {
    await this.access.assertMember(workspaceId, userId);
    const [ledger] = await this.transactions.aggregate<{
      incomeMinor: number;
      expenseMinor: number;
    }>([
      {
        $match: {
          workspaceId: new Types.ObjectId(workspaceId),
          $or: [
            { privacy: 'workspace' },
            { privacy: 'private', ownerId: new Types.ObjectId(userId) },
          ],
        },
      },
      { $unwind: '$entries' },
      {
        $group: {
          _id: null,
          incomeMinor: {
            $sum: {
              $cond: [
                { $gt: ['$entries.amountMinor', 0] },
                '$entries.amountMinor',
                0,
              ],
            },
          },
          expenseMinor: {
            $sum: {
              $cond: [
                { $lt: ['$entries.amountMinor', 0] },
                { $abs: '$entries.amountMinor' },
                0,
              ],
            },
          },
        },
      },
    ]);
    const accounts = await this.resources.find({
      workspaceId,
      kind: 'account',
      deletedAt: { $exists: false },
    });
    const netWorthMinor = accounts.reduce(
      (sum, account) =>
        sum +
        (Number.isSafeInteger(account.data.balanceMinor)
          ? Number(account.data.balanceMinor)
          : 0),
      0,
    );
    return {
      incomeMinor: ledger?.incomeMinor ?? 0,
      expenseMinor: ledger?.expenseMinor ?? 0,
      netWorthMinor,
    };
  }

  async insightsFor(workspaceId: string, userId: string) {
    return this.insights.generate(await this.summary(workspaceId, userId));
  }

  async projection(workspaceId: string, userId: string, days: number) {
    const summary = await this.summary(workspaceId, userId);
    const dailyNetMinor = Math.trunc(
      (summary.incomeMinor - summary.expenseMinor) / 30,
    );
    return Array.from({ length: days }, (_, index) => ({
      date: new Date(Date.now() + (index + 1) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      projectedNetWorthMinor:
        summary.netWorthMinor + dailyNetMinor * (index + 1),
    }));
  }
}

@ApiTags('analytics')
@ApiBearerAuth()
@Controller()
class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('dashboard')
  dashboard(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.analytics.summary(workspaceId, user.userId);
  }

  @Get('net-worth')
  netWorth(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.analytics.summary(workspaceId, user.userId).then((value) => ({
      netWorthMinor: value.netWorthMinor,
    }));
  }

  @Get('cashflow/projection')
  projection(
    @Query('workspaceId') workspaceId: string,
    @Query() query: ProjectionQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.analytics.projection(
      workspaceId,
      user.userId,
      query.days ?? 30,
    );
  }

  @Get('insights')
  insights(
    @Query('workspaceId') workspaceId: string,
    @Query() _query: InsightQuery,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.analytics.insightsFor(workspaceId, user.userId);
  }
}

@Injectable()
class SyncService {
  constructor(
    @InjectModel(FinanceResource.name)
    private readonly resources: Model<FinanceResource>,
    @InjectModel(IdempotencyRecord.name)
    private readonly idempotency: Model<IdempotencyRecord>,
    private readonly access: WorkspaceAccessService,
  ) {}

  async pull(
    workspaceId: string,
    userId: string,
    cursor?: string,
    idempotencyKey?: string,
  ) {
    await this.access.assertMember(workspaceId, userId);
    if (idempotencyKey) {
      const cached = await this.idempotency.findOne({
        userId,
        key: idempotencyKey,
      });
      if (cached) return cached.response;
    }
    const after = cursor
      ? new Date(Buffer.from(cursor, 'base64url').toString())
      : new Date(0);
    if (Number.isNaN(after.valueOf()))
      throw new BadRequestException('Invalid cursor');
    const changes = await this.resources
      .find({ workspaceId, updatedAt: { $gt: after } })
      .sort({ updatedAt: 1 })
      .limit(500);
    const newest = changes.at(-1)?.updatedAt ?? after;
    const response = {
      changes,
      tombstones: changes
        .filter((item) => item.deletedAt)
        .map((item) => ({
          id: item._id,
          kind: item.kind,
          deletedAt: item.deletedAt,
        })),
      cursor: Buffer.from(newest.toISOString()).toString('base64url'),
      hasMore: changes.length === 500,
    };
    if (idempotencyKey) {
      await this.idempotency.create({
        userId,
        key: idempotencyKey,
        response,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
    return response;
  }
}

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
class SyncController {
  constructor(
    private readonly sync: SyncService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  @Get()
  pull(
    @Query('workspaceId') workspaceId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('idempotencyKey') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sync.pull(workspaceId, user.userId, cursor, idempotencyKey);
  }

  @Get('status')
  status() {
    return { databaseReadyState: this.connection.readyState };
  }
}

@ApiTags('exports')
@ApiBearerAuth()
@Controller('exports')
class ExportController {
  constructor(
    @InjectModel(LedgerTransaction.name)
    private readonly transactions: Model<LedgerTransaction>,
    private readonly access: WorkspaceAccessService,
  ) {}

  @Get('transactions.csv')
  async csv(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() reply: FastifyReply,
  ) {
    await this.access.assertMember(workspaceId, user.userId);
    const transactions = await this.transactions
      .find({
        workspaceId,
        $or: [
          { privacy: 'workspace' },
          { privacy: 'private', ownerId: user.userId },
        ],
      })
      .sort({ occurredAt: 1 });
    const lines = ['id,date,kind,description'];
    for (const item of transactions) {
      lines.push(
        [
          item._id,
          item.occurredAt.toISOString(),
          item.kind,
          csvCell(item.description),
        ].join(','),
      );
    }
    return reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="transactions.csv"')
      .send(lines.join('\n'));
  }
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Module({
  imports: [
    AuthModule,
    BillingModule,
    CollaborationModule,
    MailModule,
    PushModule,
    MongooseModule.forFeature([
      { name: FinanceResource.name, schema: FinanceResourceSchema },
      { name: LedgerTransaction.name, schema: LedgerTransactionSchema },
      { name: IdempotencyRecord.name, schema: IdempotencyRecordSchema },
    ]),
  ],
  controllers: [
    ResourceController,
    WorkspaceController,
    TransactionController,
    AnalyticsController,
    SyncController,
    ExportController,
  ],
  providers: [
    WorkspaceAccessService,
    ResourceService,
    LedgerService,
    AnalyticsService,
    SyncService,
    DeterministicInsightsProvider,
    UnconfiguredBankProvider,
    ReviewRequiredOcrProvider,
    { provide: AiInsightsProvider, useExisting: DeterministicInsightsProvider },
    { provide: BankProvider, useExisting: UnconfiguredBankProvider },
    { provide: OcrProvider, useExisting: ReviewRequiredOcrProvider },
  ],
  exports: [
    AiInsightsProvider,
    BankProvider,
    OcrProvider,
    LedgerService,
    MongooseModule,
  ],
})
export class PlatformModule {}
