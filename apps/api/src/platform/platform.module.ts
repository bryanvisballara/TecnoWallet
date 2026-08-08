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
import {
  CreateTransactionDto,
  LedgerService,
  LedgerTransaction,
  LedgerTransactionSchema,
} from '../ledger/ledger';

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
class FinanceResource {
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
const FinanceResourceSchema = SchemaFactory.createForClass(FinanceResource);
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

  async assertMember(workspaceId: string, userId: string): Promise<void> {
    const member = await this.memberships.exists({ workspaceId, userId });
    if (!member) throw new ForbiddenException('Workspace access denied');
  }
}

@Injectable()
class ResourceService {
  constructor(
    @InjectModel(FinanceResource.name)
    private readonly resources: Model<FinanceResource>,
    private readonly access: WorkspaceAccessService,
    private readonly ocr: OcrProvider,
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
    return this.resources.create({
      ...dto,
      kind,
      ownerId: principal.userId,
    });
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
    const changes = { ...dto };
    delete changes.baseVersion;
    Object.assign(resource, changes, { version: resource.version + 1 });
    return resource.save();
  }

  async remove(kind: string, id: string, principal: AuthPrincipal) {
    return this.update(kind, id, { data: { tombstone: true } }, principal).then(
      async (resource) => {
        resource.deletedAt = new Date();
        return resource.save();
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
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthPrincipal) {
    const memberships = await this.memberships.find({ userId: user.userId });
    return this.workspaces.find({
      _id: { $in: memberships.map((member) => member.workspaceId) },
    });
  }

  @Post()
  async create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const workspace = await this.workspaces.create({
      ...dto,
      baseCurrency: dto.baseCurrency.toUpperCase(),
      ownerId: user.userId,
    });
    await this.memberships.create({
      workspaceId: workspace._id,
      userId: user.userId,
      role: 'owner',
    });
    return workspace;
  }

  @Get(':id/members')
  async members(
    @Param('id') workspaceId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const requester = await this.memberships.findOne({
      workspaceId,
      userId: user.userId,
    });
    if (!requester) throw new ForbiddenException('Workspace access denied');
    const memberships = await this.memberships.find({ workspaceId });
    const users = await this.users.find({
      _id: { $in: memberships.map((member) => member.userId) },
    });
    return memberships.map((member) => {
      const profile = users.find((item) => item._id.equals(member.userId));
      return {
        userId: member.userId,
        role: member.role,
        name: profile?.name,
        email: profile?.email,
      };
    });
  }

  @Post(':id/members')
  async addMember(
    @Param('id') workspaceId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const requester = await this.memberships.findOne({
      workspaceId,
      userId: user.userId,
      role: { $in: ['owner', 'admin'] },
    });
    if (!requester) throw new ForbiddenException('Admin access required');
    const invited = await this.users.findOne({
      email: dto.email.toLowerCase(),
      active: true,
    });
    if (!invited) throw new NotFoundException('User not found');
    return this.memberships.findOneAndUpdate(
      { workspaceId, userId: invited._id },
      { $set: { role: dto.role } },
      { upsert: true, new: true },
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
    @InjectModel(LedgerTransaction.name)
    private readonly transactions: Model<LedgerTransaction>,
  ) {}

  @Post()
  async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    await this.access.assertMember(dto.workspaceId, user.userId);
    return this.ledger.create(dto, user.userId);
  }

  @Get()
  async list(
    @Query('workspaceId') workspaceId: string,
    @Query('search') search: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    await this.access.assertMember(workspaceId, user.userId);
    return this.transactions
      .find({
        workspaceId,
        $or: [
          { privacy: 'workspace' },
          { privacy: 'private', ownerId: user.userId },
        ],
        ...(search
          ? { description: { $regex: escapeRegex(search), $options: 'i' } }
          : {}),
      })
      .sort({ occurredAt: -1, _id: -1 })
      .limit(100);
  }

  @Post(':id/reverse')
  async reverse(
    @Param('id') id: string,
    @Body('description') description: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const transaction = await this.transactions.findById(id);
    if (!transaction) throw new NotFoundException('Transaction not found');
    await this.access.assertMember(
      transaction.workspaceId.toString(),
      user.userId,
    );
    return this.ledger.reverse(id, description);
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
  exports: [AiInsightsProvider, BankProvider, OcrProvider],
})
export class PlatformModule {}
