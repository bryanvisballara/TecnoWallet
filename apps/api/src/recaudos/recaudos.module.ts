import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InjectModel,
  MongooseModule,
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  inviteEmailHtml,
  inviteEmailSubject,
} from '../mail/invite-email';
import {
  HydratedDocument,
  Model,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';
import { AuthModule, CurrentUser, Membership, User } from '../auth/auth.module';
import type { AuthPrincipal } from '../auth/auth.module';
import { BridgeModule } from '../bridge/bridge.module';
import { RecaudoBridgeService } from '../bridge/recaudo-bridge.service';
import { PushModule } from '../push/push.module';
import { PushService } from '../push/push.service';
import {
  DIGITAL_KYC_ABSORB_TARGET_MINOR,
  DIGITAL_MIN_TARGET_MINOR,
  digitalPricingPublic,
  isDigitalCurrency,
  isDigitalInactive,
  quoteDigitalWithdrawal,
} from './recaudo-digital-pricing';

const planFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
const paymentModes = ['manual', 'card_simulated', 'bank_ach'] as const;
const recaudoCategories = [
  'travel',
  'gift',
  'event',
  'purchase',
  'other',
] as const;
const payoutMethods = ['digital', 'personal'] as const;
type PlanFrequency = (typeof planFrequencies)[number];
type PaymentMode = (typeof paymentModes)[number];
type RecaudoCategory = (typeof recaudoCategories)[number];
type RecaudoPayoutMethod = (typeof payoutMethods)[number];
type ParticipantRole = 'organizer' | 'member';

type SimulatedCard = {
  brand: 'visa_simulated' | 'mastercard_simulated';
  last4: string;
};

type ParticipantPlan = {
  amountMinor: number;
  frequency: PlanFrequency;
  paymentMode: PaymentMode;
  remindersEnabled: boolean;
  reminderDaysBefore: number[];
  reminderTime: string;
  simulatedCard?: SimulatedCard;
};

@Schema({ timestamps: true })
export class Recaudo {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  organizerId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({
    required: true,
    type: String,
    enum: recaudoCategories,
    default: 'other',
  })
  category!: RecaudoCategory;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, min: 1 })
  targetMinor!: number;

  @Prop({ required: true, min: 1 })
  monthlyTargetMinor!: number;

  /** ISO-4217 (USD) or 4-letter tickers. Digital pots store USD and display as USDc. */
  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 4 })
  currency!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  })
  status!: 'open' | 'closed';

  @Prop()
  deadline?: Date;

  @Prop()
  closedAt?: Date;

  @Prop({ index: true })
  deletedAt?: Date;

  /** Short public code for join-by-ID (e.g. TR8F3K2M1Q). */
  @Prop({ uppercase: true, trim: true, unique: true, sparse: true, index: true })
  shareCode?: string;

  /** Where collected funds should be held / sent. */
  @Prop({ type: String, enum: payoutMethods, default: 'digital' })
  payoutMethod?: RecaudoPayoutMethod;

  /** Free-text bank/account details when payoutMethod is personal. */
  @Prop({ trim: true, maxlength: 2000 })
  payoutAccountDetails?: string;

  /** First funded (bank) contribution — Bridge VA may open only after this. */
  @Prop()
  digitalActivatedAt?: Date;

  @Prop()
  digitalClosedAt?: Date;

  @Prop()
  lastDigitalActivityAt?: Date;

  @Prop({ default: false })
  digitalMonthlyIncluded?: boolean;

  @Prop({ type: Object })
  tecnoAccount?: {
    customerId?: string;
    walletId?: string;
    walletAddress?: string;
    chain?: string;
    kycUrl?: string;
    tosUrl?: string;
    status?: string;
    virtualAccounts?: Array<{
      id: string;
      currency: string;
      paymentRails: string[];
      instructions?: Record<string, unknown>;
    }>;
    error?: string;
  };

  @Prop({ default: 0 })
  digitalMonthlyBilledMinor?: number;

  @Prop({ default: 0 })
  digitalKycBilledMinor?: number;

  createdAt!: Date;
  updatedAt!: Date;
}
export const RecaudoSchema = SchemaFactory.createForClass(Recaudo);
RecaudoSchema.index({ organizerId: 1, status: 1, updatedAt: -1 });

@Schema({ timestamps: true })
export class Participant {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: ['organizer', 'member'] })
  role!: ParticipantRole;

  @Prop({ type: Object })
  plan?: ParticipantPlan;

  @Prop({ required: true, default: Date.now })
  joinedAt!: Date;
}
export const ParticipantSchema = SchemaFactory.createForClass(Participant);
ParticipantSchema.index({ recaudoId: 1, userId: 1 }, { unique: true });

@Schema({ timestamps: true })
export class Contribution {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  participantId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ trim: true, maxlength: 500 })
  note?: string;

  @Prop({ required: true, type: String, enum: paymentModes })
  paymentMode!: PaymentMode;

  @Prop({ type: Object })
  simulatedCard?: SimulatedCard;

  @Prop({ required: true })
  idempotencyKey!: string;

  createdAt!: Date;
}
export const ContributionSchema = SchemaFactory.createForClass(Contribution);
ContributionSchema.index(
  { recaudoId: 1, userId: 1, idempotencyKey: 1 },
  { unique: true },
);
ContributionSchema.pre('save', function immutableContributionSave(next) {
  next(this.isNew ? undefined : new Error('Contributions are immutable'));
});
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  ContributionSchema.pre(operation, function immutableContribution(next) {
    next(new Error('Contributions are immutable'));
  });
}

@Schema({ timestamps: true })
export class Withdrawal {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  organizerId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ required: true, uppercase: true })
  currency!: string;

  @Prop({ trim: true, maxlength: 500 })
  note?: string;

  @Prop({ required: true })
  idempotencyKey!: string;

  /** 2% facilitator spread; 0 on personal rail. */
  @Prop({ default: 0 })
  platformFeeMinor?: number;

  /** Accrued monthly VA + KYC taken from the pot. */
  @Prop({ default: 0 })
  digitalFeesMinor?: number;

  @Prop({ default: 0 })
  netPayoutMinor?: number;

  createdAt!: Date;
}
export const WithdrawalSchema = SchemaFactory.createForClass(Withdrawal);
WithdrawalSchema.index(
  { recaudoId: 1, organizerId: 1, idempotencyKey: 1 },
  { unique: true },
);
WithdrawalSchema.pre('save', function immutableWithdrawalSave(next) {
  next(this.isNew ? undefined : new Error('Withdrawals are immutable'));
});
for (const operation of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
] as const) {
  WithdrawalSchema.pre(operation, function immutableWithdrawal(next) {
    next(new Error('Withdrawals are immutable'));
  });
}

@Schema({ timestamps: true })
export class Invite {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ required: true, type: String, enum: ['member'], default: 'member' })
  role!: 'member';

  @Prop({ required: true, select: false, index: true })
  tokenHash!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['pending', 'accepted', 'revoked'],
  })
  status!: 'pending' | 'accepted' | 'revoked';

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  @Prop()
  acceptedAt?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  acceptedBy?: Types.ObjectId;

  createdAt!: Date;
}
export const InviteSchema = SchemaFactory.createForClass(Invite);
InviteSchema.index(
  { recaudoId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

@Schema({ timestamps: true })
export class RecaudoAccessRequest {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  requesterUserId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  organizerUserId!: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
  })
  status!: 'pending' | 'accepted' | 'rejected' | 'cancelled';

  @Prop()
  resolvedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const RecaudoAccessRequestSchema = SchemaFactory.createForClass(
  RecaudoAccessRequest,
);
RecaudoAccessRequestSchema.index(
  { recaudoId: 1, requesterUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
  },
);

class CreateRecaudoDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @Length(1, 120)
  title!: string;

  @IsEnum(recaudoCategories)
  category!: RecaudoCategory;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsInt()
  @Min(1)
  targetMinor!: number;

  @IsInt()
  @Min(1)
  monthlyTargetMinor!: number;

  @IsString()
  @Length(3, 4)
  currency!: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(payoutMethods)
  payoutMethod?: RecaudoPayoutMethod;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  payoutAccountDetails?: string;
}

class UpdateRecaudoDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  title?: string;

  @IsOptional()
  @IsEnum(recaudoCategories)
  category?: RecaudoCategory;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  targetMinor?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyTargetMinor?: number;

  @IsOptional()
  @IsString()
  @Length(3, 4)
  currency?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsEnum(payoutMethods)
  payoutMethod?: RecaudoPayoutMethod;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  payoutAccountDetails?: string;
}

class ContributionDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

class WithdrawalDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;
}

class ConfigurePlanDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsEnum(planFrequencies)
  frequency!: PlanFrequency;

  @IsEnum(paymentModes)
  paymentMode!: PaymentMode;

  @IsBoolean()
  remindersEnabled!: boolean;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  reminderTime!: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(365, { each: true })
  reminderDaysBefore!: number[];
}

class CreateInviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}

class AcceptInviteDto {
  @IsString()
  @Length(20, 200)
  token!: string;
}

class JoinByCodeDto {
  @IsString()
  @Length(4, 24)
  shareCode!: string;
}

export abstract class RecaudoMailer {
  abstract sendInvite(input: {
    to: string;
    recaudoTitle: string;
    acceptLink: string;
    inviterName?: string;
  }): Promise<{ delivered: boolean }>;
}

@Injectable()
class ConfiguredRecaudoMailer implements RecaudoMailer {
  constructor(private readonly config: ConfigService) {}

  async sendInvite(input: {
    to: string;
    recaudoTitle: string;
    acceptLink: string;
    inviterName?: string;
  }): Promise<{ delivered: boolean }> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      if (this.config.get('NODE_ENV', 'development') !== 'production') {
        return { delivered: false };
      }
      throw new ServiceUnavailableException(
        'Invite email provider unavailable',
      );
    }
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: this.config.get<string>(
            'BREVO_SENDER_EMAIL',
            'contact@tecnowallet.app',
          ),
          name: this.config.get<string>('BREVO_SENDER_NAME', 'TecnoWallet'),
        },
        to: [{ email: input.to }],
        subject: inviteEmailSubject({
          kind: 'recaudo',
          resourceName: input.recaudoTitle,
          acceptLink: input.acceptLink,
          inviterName: input.inviterName,
        }),
        htmlContent: inviteEmailHtml({
          kind: 'recaudo',
          resourceName: input.recaudoTitle,
          acceptLink: input.acceptLink,
          inviterName: input.inviterName,
        }),
      }),
    });
    if (!response.ok) {
      throw new ServiceUnavailableException('Invite email could not be sent');
    }
    return { delivered: true };
  }
}

@Injectable()
export class RecaudosService {
  private readonly logger = new Logger(RecaudosService.name);

  constructor(
    @InjectModel(Recaudo.name) private readonly recaudos: Model<Recaudo>,
    @InjectModel(Participant.name)
    private readonly participants: Model<Participant>,
    @InjectModel(Contribution.name)
    private readonly contributions: Model<Contribution>,
    @InjectModel(Withdrawal.name)
    private readonly withdrawals: Model<Withdrawal>,
    @InjectModel(Invite.name) private readonly invites: Model<Invite>,
    @InjectModel(RecaudoAccessRequest.name)
    private readonly accessRequests: Model<RecaudoAccessRequest>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly mailer: RecaudoMailer,
    private readonly config: ConfigService,
    private readonly push: PushService,
    private readonly tecnoAccounts: RecaudoBridgeService,
  ) {}

  async create(dto: CreateRecaudoDto, principal: AuthPrincipal) {
    assertObjectId(dto.workspaceId);
    const workspaceMember = await this.memberships.exists({
      workspaceId: dto.workspaceId,
      userId: principal.userId,
    });
    if (!workspaceMember)
      throw new ForbiddenException('Workspace access denied');
    if (dto.deadline && new Date(dto.deadline) <= new Date()) {
      throw new BadRequestException('deadline must be in the future');
    }
    const payoutMethod = dto.payoutMethod === 'personal' ? 'personal' : 'digital';
    const payoutAccountDetails = dto.payoutAccountDetails?.trim() || '';
    if (payoutMethod === 'digital') {
      this.assertDigitalEligible(dto.currency, dto.targetMinor);
    } else if (payoutAccountDetails.length < 8) {
      throw new BadRequestException(
        'Indica los datos de la cuenta personal donde se guardará el recaudo.',
      );
    }
    const shareCode = await this.allocateShareCode();
    // Persist ISO USD for digital pots: USDC is not ISO-4217 (breaks Intl + old maxlength: 3).
    const currency =
      payoutMethod === 'digital' ? 'USD' : dto.currency.toUpperCase();
    const recaudo = await this.recaudos.create({
      workspaceId: dto.workspaceId,
      organizerId: principal.userId,
      title: dto.title,
      category: dto.category,
      description: dto.description,
      targetMinor: dto.targetMinor,
      monthlyTargetMinor: dto.monthlyTargetMinor,
      currency,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      shareCode,
      payoutMethod,
      payoutAccountDetails,
      digitalMonthlyIncluded: false,
    });
    await this.participants.create({
      recaudoId: recaudo._id,
      userId: principal.userId,
      role: 'organizer',
    });
    if (payoutMethod === 'digital') {
      try {
        await this.provisionTecnoAccount(recaudo, principal.userId);
      } catch (error) {
        this.logger.warn(
          `TecnoWallet provision skipped: ${
            error instanceof Error ? error.message : 'error'
          }`,
        );
        recaudo.tecnoAccount = { status: 'failed', virtualAccounts: [] };
        await recaudo.save();
      }
    }
    return this.detail(recaudo._id.toString(), principal);
  }

  async list(principal: AuthPrincipal) {
    const memberships = await this.participants.find({
      userId: principal.userId,
    });
    const recaudos = await this.recaudos
      .find({
        _id: { $in: memberships.map((item) => item.recaudoId) },
        deletedAt: { $exists: false },
      })
      .sort({ updatedAt: -1 });
    return Promise.all(recaudos.map((item) => this.present(item)));
  }

  async detail(id: string, principal: AuthPrincipal) {
    const participant = await this.assertParticipant(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    const [presented, participantDocs, contributionDocs, withdrawalDocs] =
      await Promise.all([
        this.present(recaudo),
        this.participants.find({ recaudoId: id }).sort({ joinedAt: 1 }),
        this.contributions.find({ recaudoId: id }).sort({ createdAt: -1 }),
        this.withdrawals.find({ recaudoId: id }).sort({ createdAt: -1 }),
      ]);
    const users = await this.users.find({
      _id: { $in: participantDocs.map((item) => item.userId) },
    });
    const userById = new Map(users.map((user) => [user._id.toString(), user]));
    const contributionByParticipant = new Map<string, number>();
    for (const contribution of contributionDocs) {
      const participantId = contribution.participantId.toString();
      contributionByParticipant.set(
        participantId,
        (contributionByParticipant.get(participantId) ?? 0) +
          contribution.amountMinor,
      );
    }
    const participants = participantDocs.map((item) => {
      const user = userById.get(item.userId.toString());
      return {
        id: item._id.toString(),
        recaudoId: item.recaudoId.toString(),
        userId: item.userId.toString(),
        name: user?.name ?? 'Participante',
        email: user?.email ?? '',
        role: item.role,
        plan: item.plan,
        contributedMinor:
          contributionByParticipant.get(item._id.toString()) ?? 0,
        joinedAt: item.joinedAt.toISOString(),
      };
    });
    const participantName = new Map(
      participants.map((item) => [item.id, item.name]),
    );
    const organizer = participants.find((item) => item.role === 'organizer');
    const contributions = [
      ...contributionDocs.map((item) => ({
        id: item._id.toString(),
        recaudoId: item.recaudoId.toString(),
        participantId: item.participantId.toString(),
        userId: item.userId.toString(),
        participantName:
          participantName.get(item.participantId.toString()) ?? 'Participante',
        amountMinor: item.amountMinor,
        currency: item.currency,
        paymentMode: item.paymentMode,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
        occurredAt: item.createdAt.toISOString(),
      })),
      ...withdrawalDocs.map((item) => ({
        id: item._id.toString(),
        recaudoId: item.recaudoId.toString(),
        participantId: organizer?.id ?? item.organizerId.toString(),
        userId: item.organizerId.toString(),
        participantName: organizer?.name ?? 'Organizador',
        amountMinor: item.amountMinor,
        currency: item.currency,
        paymentMode: 'withdrawal' as const,
        note: item.note,
        createdAt: item.createdAt.toISOString(),
        occurredAt: item.createdAt.toISOString(),
      })),
    ].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    return {
      ...presented,
      currentRole: participant.role,
      participants,
      contributions,
    };
  }

  async update(id: string, dto: UpdateRecaudoDto, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.status === 'closed') {
      throw new ConflictException('Closed recaudos cannot be edited');
    }
    if (dto.deadline && new Date(dto.deadline) <= new Date()) {
      throw new BadRequestException('deadline must be in the future');
    }
    if (dto.payoutMethod === 'digital') {
      this.assertDigitalEligible(
        dto.currency ?? recaudo.currency,
        dto.targetMinor ?? recaudo.targetMinor,
      );
    }
    if (
      (dto.payoutMethod === 'personal' ||
        (!dto.payoutMethod && recaudo.payoutMethod !== 'digital')) &&
      dto.payoutAccountDetails !== undefined &&
      dto.payoutAccountDetails.trim().length < 8
    ) {
      throw new BadRequestException(
        'Indica los datos de la cuenta personal donde se guardará el recaudo.',
      );
    }
    if (dto.targetMinor !== undefined) {
      const collected = await this.collected(id);
      if (dto.targetMinor < collected) {
        throw new BadRequestException('targetMinor cannot be below collected');
      }
    }
    Object.assign(recaudo, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.category !== undefined ? { category: dto.category } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.targetMinor !== undefined
        ? { targetMinor: dto.targetMinor }
        : {}),
      ...(dto.monthlyTargetMinor !== undefined
        ? { monthlyTargetMinor: dto.monthlyTargetMinor }
        : {}),
      ...(dto.currency !== undefined
        ? {
            currency:
              (dto.payoutMethod ?? recaudo.payoutMethod) === 'digital'
                ? 'USD'
                : dto.currency.trim().toUpperCase(),
          }
        : {}),
      ...(dto.deadline !== undefined
        ? { deadline: new Date(dto.deadline) }
        : {}),
      ...(dto.payoutMethod !== undefined
        ? { payoutMethod: dto.payoutMethod }
        : {}),
      ...(dto.payoutAccountDetails !== undefined
        ? { payoutAccountDetails: dto.payoutAccountDetails.trim() }
        : {}),
    });
    await recaudo.save();
    return this.detail(id, principal);
  }

  async close(id: string, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.status === 'closed') return this.detail(id, principal);
    recaudo.status = 'closed';
    recaudo.closedAt = new Date();
    recaudo.digitalClosedAt = recaudo.digitalClosedAt ?? new Date();
    await recaudo.save();
    return this.detail(id, principal);
  }

  /**
   * Soft-delete a collection. Organizer only; net collected balance must be 0
   * (withdraw remaining funds first).
   */
  async remove(id: string, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    const availableMinor = await this.collected(id);
    if (availableMinor > 0) {
      throw new ConflictException({
        statusCode: 409,
        code: 'RECAUDO_HAS_FUNDS',
        message:
          'Retira el dinero del recaudo antes de eliminarlo. El pozo debe quedar en 0.',
        availableMinor,
      });
    }
    recaudo.deletedAt = new Date();
    recaudo.status = 'closed';
    recaudo.closedAt = recaudo.closedAt ?? new Date();
    recaudo.digitalClosedAt = recaudo.digitalClosedAt ?? new Date();
    await recaudo.save();
    // Revoke pending invites so they cannot be accepted after delete.
    await this.invites.updateMany(
      { recaudoId: recaudo._id, status: 'pending' },
      { $set: { status: 'revoked' } },
    );
    return { deleted: true, id: recaudo._id.toString() };
  }

  async configurePlan(
    id: string,
    dto: ConfigurePlanDto,
    principal: AuthPrincipal,
  ) {
    const participant = await this.assertParticipant(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.status === 'closed') {
      throw new ConflictException('Closed recaudos cannot change plans');
    }
    const simulatedCard =
      dto.paymentMode === 'card_simulated'
        ? createSimulatedCard(participant.plan?.simulatedCard)
        : undefined;
    participant.plan = {
      amountMinor: dto.amountMinor,
      frequency: dto.frequency,
      paymentMode: dto.paymentMode,
      remindersEnabled: dto.remindersEnabled,
      reminderTime: dto.reminderTime,
      reminderDaysBefore: dto.remindersEnabled
        ? [...new Set(dto.reminderDaysBefore)].sort((a, b) => a - b)
        : [],
      simulatedCard,
    };
    await participant.save();
    return participant;
  }

  /**
   * Read-only context for the financial layer (does not change Recaudos product rules).
   */
  async getFundingContext(
    recaudoId: string,
    userId: string,
    options?: { requireOrganizer?: boolean },
  ) {
    if (options?.requireOrganizer) {
      await this.assertOrganizer(recaudoId, userId);
    }
    const participant = await this.assertParticipant(recaudoId, userId);
    const recaudo = await this.findRecaudo(recaudoId);
    return { recaudo, participant };
  }

  /**
   * Called only by PaymentOrchestration after Unit settlement confirmation.
   */
  async createSettledContributionFromIntent(input: {
    recaudoId: string;
    userId: string;
    participantId: string;
    amountMinor: number;
    note?: string;
    idempotencyKey: string;
  }) {
    return this.contribute(
      input.recaudoId,
      { amountMinor: input.amountMinor, note: input.note },
      input.idempotencyKey,
      { userId: input.userId, email: '', platformRole: 'user' },
    ).then(async (result) => {
      const recaudo = await this.findRecaudo(input.recaudoId);
      if (recaudo.payoutMethod === 'digital') {
        await this.markDigitalActive(recaudo);
      }
      return result;
    });
  }

  /**
   * Called only by PaymentOrchestration after Unit settlement confirmation.
   */
  async createSettledWithdrawalFromIntent(input: {
    recaudoId: string;
    organizerId: string;
    amountMinor: number;
    note?: string;
    idempotencyKey: string;
  }) {
    return this.withdraw(
      input.recaudoId,
      { amountMinor: input.amountMinor, note: input.note },
      input.idempotencyKey,
      { userId: input.organizerId, email: '', platformRole: 'user' },
    );
  }

  async contribute(
    id: string,
    dto: ContributionDto,
    idempotencyKey: string | undefined,
    principal: AuthPrincipal,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new BadRequestException(
        'Idempotency-Key header is required (max 200 characters)',
      );
    }
    const participant = await this.assertParticipant(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }
    const paymentMode = participant.plan?.paymentMode ?? 'manual';
    const replay = await this.contributions.findOne({
      recaudoId: id,
      userId: principal.userId,
      idempotencyKey,
    });
    if (replay) {
      if (replay.amountMinor !== dto.amountMinor) {
        throw new ConflictException(
          'Idempotency key was already used with different input',
        );
      }
      return {
        contribution: replay,
        ...(await this.totals(recaudo)),
        idempotentReplay: true,
      };
    }
    try {
      const contribution = await this.contributions.create({
        recaudoId: recaudo._id,
        participantId: participant._id,
        userId: principal.userId,
        amountMinor: dto.amountMinor,
        currency: recaudo.currency,
        paymentMode,
        note: dto.note,
        simulatedCard:
          paymentMode === 'card_simulated'
            ? createSimulatedCard(participant.plan?.simulatedCard)
            : undefined,
        idempotencyKey,
      });
      if (recaudo.payoutMethod === 'digital' && paymentMode === 'bank_ach') {
        await this.markDigitalActive(recaudo);
      }
      void this.notifyRecaudoActivity({
        recaudo,
        actorUserId: principal.userId,
        amountMinor: dto.amountMinor,
        withdrawal: false,
        contributionId: contribution._id.toString(),
      });
      return {
        contribution,
        ...(await this.totals(recaudo)),
        idempotentReplay: false,
      };
    } catch (error: unknown) {
      if (!isDuplicateKey(error)) throw error;
      const existing = await this.contributions.findOne({
        recaudoId: id,
        userId: principal.userId,
        idempotencyKey,
      });
      if (!existing) throw error;
      if (existing.amountMinor !== dto.amountMinor) {
        throw new ConflictException(
          'Idempotency key was already used with different input',
        );
      }
      return {
        contribution: existing,
        ...(await this.totals(recaudo)),
        idempotentReplay: true,
      };
    }
  }

  async withdraw(
    id: string,
    dto: WithdrawalDto,
    idempotencyKey: string | undefined,
    principal: AuthPrincipal,
  ) {
    if (!idempotencyKey || idempotencyKey.length > 200) {
      throw new BadRequestException(
        'Idempotency-Key header is required (max 200 characters)',
      );
    }
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }
    const replay = await this.withdrawals.findOne({
      recaudoId: id,
      organizerId: principal.userId,
      idempotencyKey,
    });
    if (replay) {
      if (replay.amountMinor !== dto.amountMinor) {
        throw new ConflictException(
          'Idempotency key was already used with different input',
        );
      }
      return {
        withdrawal: replay,
        ...(await this.totals(recaudo)),
        idempotentReplay: true,
      };
    }
    const available = await this.collected(id);
    if (dto.amountMinor > available) {
      throw new BadRequestException(
        'amountMinor cannot exceed the collected pool',
      );
    }
    const participantCount = await this.participants.countDocuments({
      recaudoId: id,
    });
    const quote =
      recaudo.payoutMethod === 'digital' && recaudo.digitalActivatedAt
        ? quoteDigitalWithdrawal({
            amountMinor: dto.amountMinor,
            activatedAt: recaudo.digitalActivatedAt,
            monthlyIncluded: false,
            monthlyBilledMinor: recaudo.digitalMonthlyBilledMinor ?? 0,
            participantCount,
            kycBilledMinor: recaudo.digitalKycBilledMinor ?? 0,
            absorbKyc:
              recaudo.targetMinor >= DIGITAL_KYC_ABSORB_TARGET_MINOR,
          })
        : {
            spreadMinor: 0,
            monthlyDueMinor: 0,
            kycDueMinor: 0,
            digitalFeesMinor: 0,
            netPayoutMinor: dto.amountMinor,
          };
    if (quote.netPayoutMinor < 1) {
      throw new BadRequestException(
        'El pozo no cubre la comisión (2% al retiro, cuota mensual y KYC). Retira un monto mayor.',
      );
    }
    try {
      const withdrawal = await this.withdrawals.create({
        recaudoId: recaudo._id,
        organizerId: principal.userId,
        amountMinor: dto.amountMinor,
        currency: recaudo.currency,
        note: dto.note,
        idempotencyKey,
        platformFeeMinor: quote.spreadMinor,
        digitalFeesMinor: quote.digitalFeesMinor,
        netPayoutMinor: quote.netPayoutMinor,
      });
      recaudo.digitalMonthlyBilledMinor =
        (recaudo.digitalMonthlyBilledMinor ?? 0) + quote.monthlyDueMinor;
      recaudo.digitalKycBilledMinor =
        (recaudo.digitalKycBilledMinor ?? 0) + quote.kycDueMinor;
      recaudo.lastDigitalActivityAt = new Date();
      await recaudo.save();
      void this.notifyRecaudoActivity({
        recaudo,
        actorUserId: principal.userId,
        amountMinor: dto.amountMinor,
        withdrawal: true,
        contributionId: withdrawal._id.toString(),
      });
      const totals = await this.totals(recaudo);
      if (totals.collectedMinor <= 0) {
        recaudo.status = 'closed';
        recaudo.closedAt = new Date();
        recaudo.digitalClosedAt = recaudo.digitalClosedAt ?? new Date();
        await recaudo.save();
      }
      return {
        withdrawal,
        fees: quote,
        ...totals,
        idempotentReplay: false,
      };
    } catch (error: unknown) {
      if (!isDuplicateKey(error)) throw error;
      const existing = await this.withdrawals.findOne({
        recaudoId: id,
        organizerId: principal.userId,
        idempotencyKey,
      });
      if (!existing) throw error;
      if (existing.amountMinor !== dto.amountMinor) {
        throw new ConflictException(
          'Idempotency key was already used with different input',
        );
      }
      return {
        withdrawal: existing,
        ...(await this.totals(recaudo)),
        idempotentReplay: true,
      };
    }
  }

  async invite(id: string, dto: CreateInviteDto, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }
    const email = dto.email.toLowerCase();
    const rawToken = randomBytes(32).toString('base64url');
    let invite: Invite;
    try {
      invite = await this.invites.create({
        recaudoId: recaudo._id,
        email,
        role: 'member',
        tokenHash: digestInviteToken(rawToken),
        status: 'pending',
        expiresAt: new Date(
          Date.now() + (dto.expiresInDays ?? 7) * 24 * 60 * 60 * 1000,
        ),
      });
    } catch (error: unknown) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('A pending invite already exists');
      }
      throw error;
    }
    const acceptBase = this.config
      .get<string>('RECAUDO_INVITE_BASE_URL', 'http://localhost:8081/invite')
      .replace(/\/+$/, '');
    const acceptLink = `${acceptBase}/${encodeURIComponent(rawToken)}`;
    let delivery: { delivered: boolean };
    try {
      const inviter = await this.users.findById(principal.userId).lean();
      delivery = await this.mailer.sendInvite({
        to: email,
        recaudoTitle: recaudo.title,
        acceptLink,
        inviterName:
          typeof inviter?.name === 'string' && inviter.name.trim()
            ? inviter.name.trim()
            : principal.email.split('@')[0],
      });
    } catch (error: unknown) {
      await this.invites.updateOne(
        { _id: invite._id, status: 'pending' },
        { $set: { status: 'revoked' } },
      );
      throw error;
    }
    const development =
      this.config.get('NODE_ENV', 'development') !== 'production';
    return {
      invite,
      delivered: delivery.delivered,
      ...(!delivery.delivered && development
        ? { previewLink: acceptLink }
        : {}),
    };
  }

  async acceptInvite(rawToken: string, principal: AuthPrincipal) {
    const email = principal.email.toLowerCase();
    const invite = await this.invites.findOneAndUpdate(
      {
        tokenHash: digestInviteToken(rawToken),
        email,
        status: 'pending',
        expiresAt: { $gt: new Date() },
      },
      {
        $set: {
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: principal.userId,
        },
      },
      { new: true },
    );
    if (!invite) {
      throw new ForbiddenException(
        'Invite is invalid, expired, used, or belongs to another email',
      );
    }
    await this.participants.findOneAndUpdate(
      { recaudoId: invite.recaudoId, userId: principal.userId },
      {
        $setOnInsert: {
          role: 'member',
          joinedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
    return this.detail(invite.recaudoId.toString(), principal);
  }

  async ensureShareCode(id: string, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.shareCode) {
      return { shareCode: recaudo.shareCode };
    }
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const shareCode = await this.allocateShareCode();
      try {
        recaudo.shareCode = shareCode;
        await recaudo.save();
        return { shareCode };
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
      }
    }
    throw new ConflictException('Could not allocate a recaudo share code');
  }

  async requestJoin(shareCodeRaw: string, principal: AuthPrincipal) {
    const shareCode = shareCodeRaw.trim().toUpperCase();
    const recaudo = await this.recaudos.findOne({
      shareCode,
      deletedAt: { $exists: false },
    });
    if (!recaudo) throw new NotFoundException('ID not found');
    if (recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }
    const requesterId = new Types.ObjectId(principal.userId);
    if (recaudo.organizerId.equals(requesterId)) {
      throw new BadRequestException('You already organize this collection');
    }
    const alreadyMember = await this.participants.exists({
      recaudoId: recaudo._id,
      userId: requesterId,
    });
    if (alreadyMember) {
      throw new ConflictException('You already have access to this collection');
    }
    try {
      const created = await this.accessRequests.create({
        recaudoId: recaudo._id,
        requesterUserId: requesterId,
        organizerUserId: recaudo.organizerId,
        status: 'pending',
      });
      const requester = await this.users
        .findById(principal.userId)
        .select('name')
        .lean();
      const who = requester?.name?.trim() || principal.email.split('@')[0];
      this.push.notifyUsers(
        [recaudo.organizerId.toString()],
        principal.userId,
        {
          title: 'Solicitud de recaudo',
          body: `${who} quiere unirse a ${recaudo.title}`,
          data: {
            kind: 'recaudo',
            route: `/(tabs)/recaudos?focus=${recaudo._id.toString()}&tab=share`,
            notificationId: `rec-join-${created._id.toString()}`,
          },
        },
      );
      return {
        id: created._id.toString(),
        status: 'pending' as const,
        recaudoId: recaudo._id.toString(),
        title: recaudo.title,
      };
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictException('You already requested access');
      }
      throw error;
    }
  }

  async listAccessRequests(id: string, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const rows = await this.accessRequests
      .find({ recaudoId: id, status: 'pending' })
      .sort({ createdAt: -1 });
    const users = await this.users.find({
      _id: { $in: rows.map((item) => item.requesterUserId) },
    });
    const userById = new Map(users.map((user) => [user._id.toString(), user]));
    return rows.map((item) => {
      const user = userById.get(item.requesterUserId.toString());
      return {
        id: item._id.toString(),
        name: user?.name?.trim() || 'Usuario',
        email: user?.email || '',
        status: item.status,
        createdAt: item.createdAt.toISOString(),
      };
    });
  }

  async acceptAccessRequest(requestId: string, principal: AuthPrincipal) {
    assertObjectId(requestId);
    const request = await this.accessRequests.findById(requestId);
    if (!request || request.status !== 'pending') {
      throw new NotFoundException('Access request not found');
    }
    await this.assertOrganizer(
      request.recaudoId.toString(),
      principal.userId,
    );
    const recaudo = await this.findRecaudo(request.recaudoId.toString());
    if (recaudo.status !== 'open') {
      throw new ConflictException('Recaudo is closed');
    }
    request.status = 'accepted';
    request.resolvedAt = new Date();
    await request.save();
    await this.participants.findOneAndUpdate(
      {
        recaudoId: request.recaudoId,
        userId: request.requesterUserId,
      },
      {
        $setOnInsert: {
          role: 'member',
          joinedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
    this.push.notifyUsers(
      [request.requesterUserId.toString()],
      principal.userId,
      {
        title: 'Solicitud aceptada',
        body: `Ya puedes aportar en ${recaudo.title}`,
        data: {
          kind: 'recaudo',
          route: `/(tabs)/recaudo/${recaudo._id.toString()}`,
          notificationId: `rec-join-ok-${request._id.toString()}`,
        },
      },
    );
    return { ok: true };
  }

  async rejectAccessRequest(requestId: string, principal: AuthPrincipal) {
    assertObjectId(requestId);
    const request = await this.accessRequests.findById(requestId);
    if (!request || request.status !== 'pending') {
      throw new NotFoundException('Access request not found');
    }
    await this.assertOrganizer(
      request.recaudoId.toString(),
      principal.userId,
    );
    request.status = 'rejected';
    request.resolvedAt = new Date();
    await request.save();
    return { ok: true };
  }

  private async allocateShareCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const bytes = randomBytes(8);
      let code = 'TR';
      for (let i = 0; i < 8; i += 1) {
        code += alphabet[bytes[i]! % alphabet.length];
      }
      const exists = await this.recaudos.exists({ shareCode: code });
      if (!exists) return code;
    }
    throw new ConflictException('Could not allocate a recaudo share code');
  }

  private async assertParticipant(recaudoId: string, userId: string) {
    assertObjectId(recaudoId);
    const participant = await this.participants.findOne({ recaudoId, userId });
    if (!participant) {
      throw new ForbiddenException('Recaudo access denied');
    }
    return participant;
  }

  private async assertOrganizer(recaudoId: string, userId: string) {
    const participant = await this.assertParticipant(recaudoId, userId);
    if (participant.role !== 'organizer') {
      throw new ForbiddenException('Organizer access required');
    }
  }

  private async findRecaudo(id: string): Promise<HydratedDocument<Recaudo>> {
    assertObjectId(id);
    const recaudo = await this.recaudos.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!recaudo) throw new NotFoundException('Recaudo not found');
    return recaudo;
  }

  private async collected(id: string): Promise<number> {
    const recaudoObjectId = new Types.ObjectId(id);
    const [[contributionTotal], [withdrawalTotal]] = await Promise.all([
      this.contributions.aggregate<{ collectedMinor: number }>([
        { $match: { recaudoId: recaudoObjectId } },
        { $group: { _id: null, collectedMinor: { $sum: '$amountMinor' } } },
      ]),
      this.withdrawals.aggregate<{ withdrawnMinor: number }>([
        { $match: { recaudoId: recaudoObjectId } },
        { $group: { _id: null, withdrawnMinor: { $sum: '$amountMinor' } } },
      ]),
    ]);
    return Math.max(
      0,
      (contributionTotal?.collectedMinor ?? 0) -
        (withdrawalTotal?.withdrawnMinor ?? 0),
    );
  }

  private async notifyRecaudoActivity(input: {
    recaudo: HydratedDocument<Recaudo>;
    actorUserId: string;
    amountMinor: number;
    withdrawal: boolean;
    contributionId: string;
  }) {
    const participants = await this.participants
      .find({ recaudoId: input.recaudo._id })
      .select('userId')
      .lean();
    const recipientIds = participants
      .map((item) => item.userId.toString())
      .filter((id) => id !== input.actorUserId);
    if (!recipientIds.length) return;
    const actor = await this.users
      .findById(input.actorUserId)
      .select('name')
      .lean();
    const who = actor?.name?.trim() || 'Un colaborador';
    const amount = (input.amountMinor / 100).toLocaleString('es-CO', {
      style: 'currency',
      currency: isDigitalCurrency(input.recaudo.currency)
        ? 'USD'
        : input.recaudo.currency || 'COP',
      maximumFractionDigits: 0,
    });
    this.push.notifyUsers(recipientIds, input.actorUserId, {
      title: input.withdrawal ? 'Retiro del recaudo' : 'Aporte del equipo',
      body: input.withdrawal
        ? `${who} retiró ${amount} de ${input.recaudo.title}`
        : `${who} aportó ${amount} a ${input.recaudo.title}`,
      data: {
        kind: 'recaudo',
        route: `/(tabs)/recaudo/${input.recaudo._id.toString()}`,
        notificationId: `rec-${input.recaudo._id.toString()}-${input.contributionId}`,
      },
      sound: input.withdrawal ? 'gasto.wav' : 'ingreso.wav',
    });
  }

  private async totals(recaudo: HydratedDocument<Recaudo>) {
    const collectedMinor = await this.collected(recaudo._id.toString());
    return {
      collectedMinor,
      progressPercent: calculateProgress(collectedMinor, recaudo.targetMinor),
    };
  }

  private async markDigitalActive(recaudo: HydratedDocument<Recaudo>) {
    const now = new Date();
    recaudo.lastDigitalActivityAt = now;
    if (!recaudo.digitalActivatedAt) recaudo.digitalActivatedAt = now;
    await recaudo.save();
  }

  private assertDigitalEligible(currency: string, targetMinor: number) {
    if (!isDigitalCurrency(currency)) {
      throw new BadRequestException(
        'El recaudo TecnoWallet se ahorra en USDc.',
      );
    }
    if (targetMinor < DIGITAL_MIN_TARGET_MINOR) {
      throw new BadRequestException(
        'El recaudo TecnoWallet pide una meta de al menos 250 USDc.',
      );
    }
  }

  private async provisionTecnoAccount(
    recaudo: HydratedDocument<Recaudo>,
    organizerId: string,
  ) {
    const organizer = await this.users.findById(organizerId);
    if (!organizer?.email) {
      recaudo.tecnoAccount = { status: 'failed', virtualAccounts: [] };
      await recaudo.save();
      return;
    }
    const prior = await this.recaudos
      .findOne({
        organizerId,
        'tecnoAccount.customerId': { $exists: true, $nin: [null, ''] },
        deletedAt: { $exists: false },
      })
      .sort({ createdAt: -1 });
    const snapshot = await this.tecnoAccounts.provision({
      recaudoId: recaudo._id.toString(),
      organizerEmail: organizer.email,
      organizerName: organizer.name,
      existingCustomerId: prior?.tecnoAccount?.customerId,
    });
    recaudo.tecnoAccount = snapshot;
    this.logger.log(
      `TecnoWallet account ${snapshot.status} for recaudo ${recaudo._id.toString()}`,
    );
    await recaudo.save();
  }

  async syncTecnoAccount(id: string, principal: AuthPrincipal) {
    await this.assertOrganizer(id, principal.userId);
    const recaudo = await this.findRecaudo(id);
    if (recaudo.payoutMethod !== 'digital') {
      throw new BadRequestException('Este recaudo no usa una cuenta TecnoWallet.');
    }
    try {
      await this.provisionTecnoAccount(recaudo, recaudo.organizerId.toString());
    } catch (error) {
      this.logger.warn(
        `TecnoWallet sync failed: ${error instanceof Error ? error.message : 'error'}`,
      );
      recaudo.tecnoAccount = {
        ...(recaudo.tecnoAccount ?? {}),
        status: 'failed',
        virtualAccounts: recaudo.tecnoAccount?.virtualAccounts ?? [],
        error: 'sync_failed',
      };
      await recaudo.save();
    }
    return this.detail(id, principal);
  }

  async quoteForRecaudo(
    recaudo: HydratedDocument<Recaudo>,
    amountMinor?: number,
  ) {
    if (recaudo.payoutMethod !== 'digital') return null;
    const collectedMinor = await this.collected(recaudo._id.toString());
    const participantCount = await this.participants.countDocuments({
      recaudoId: recaudo._id,
    });
    const gross = amountMinor ?? collectedMinor;
    if (gross <= 0) {
      return {
        spreadMinor: 0,
        monthlyDueMinor: 0,
        kycDueMinor: 0,
        digitalFeesMinor: 0,
        netPayoutMinor: 0,
      };
    }
    return quoteDigitalWithdrawal({
      amountMinor: gross,
      activatedAt: recaudo.digitalActivatedAt,
      monthlyIncluded: false,
      monthlyBilledMinor: recaudo.digitalMonthlyBilledMinor ?? 0,
      participantCount,
      kycBilledMinor: recaudo.digitalKycBilledMinor ?? 0,
      absorbKyc: recaudo.targetMinor >= DIGITAL_KYC_ABSORB_TARGET_MINOR,
    });
  }

  digitalPricing() {
    return digitalPricingPublic;
  }

  assertDigitalAccountOpen(recaudo: HydratedDocument<Recaudo>) {
    if (recaudo.payoutMethod !== 'digital') {
      throw new BadRequestException(
        'Este recaudo no usa una cuenta TecnoWallet.',
      );
    }
    if (recaudo.status !== 'open' || recaudo.digitalClosedAt) {
      throw new BadRequestException('Este recaudo digital ya está cerrado.');
    }
    if (isDigitalInactive(recaudo.lastDigitalActivityAt)) {
      throw new BadRequestException(
        'Esta cuenta TecnoWallet se cerró por 30 días inactiva. Crea un recaudo nuevo si hace falta.',
      );
    }
  }

  private async present(recaudo: HydratedDocument<Recaudo>) {
    return {
      id: recaudo._id.toString(),
      workspaceId: recaudo.workspaceId.toString(),
      organizerId: recaudo.organizerId.toString(),
      title: recaudo.title,
      category: recaudo.category,
      description: recaudo.description,
      targetMinor: recaudo.targetMinor,
      monthlyTargetMinor: recaudo.monthlyTargetMinor,
      currency: recaudo.currency,
      status: recaudo.status,
      deadline: recaudo.deadline?.toISOString(),
      closedAt: recaudo.closedAt?.toISOString(),
      shareCode: recaudo.shareCode?.trim().toUpperCase() || undefined,
      payoutMethod: recaudo.payoutMethod === 'digital' ? 'digital' : 'personal',
      payoutAccountDetails: recaudo.payoutAccountDetails?.trim() || undefined,
      digitalMonthlyIncluded: false,
      digitalActivatedAt: recaudo.digitalActivatedAt?.toISOString(),
      digitalClosedAt: recaudo.digitalClosedAt?.toISOString(),
      digitalPricing: digitalPricingPublic,
      digitalQuote: await this.quoteForRecaudo(recaudo),
      tecnoAccount: recaudo.tecnoAccount
        ? {
            status: recaudo.tecnoAccount.status,
            kycUrl: recaudo.tecnoAccount.kycUrl,
            tosUrl: recaudo.tecnoAccount.tosUrl,
            chain: recaudo.tecnoAccount.chain,
            error: recaudo.tecnoAccount.error,
            virtualAccounts: (recaudo.tecnoAccount.virtualAccounts ?? []).map(
              (item) => ({
                id: item.id,
                currency: item.currency,
                paymentRails: item.paymentRails ?? [],
                instructions: item.instructions ?? undefined,
              }),
            ),
          }
        : undefined,
      createdAt: recaudo.createdAt.toISOString(),
      updatedAt: recaudo.updatedAt.toISOString(),
      ...(await this.totals(recaudo)),
    };
  }
}

@ApiTags('recaudos')
@ApiBearerAuth()
@Controller('recaudos')
class RecaudosController {
  constructor(private readonly service: RecaudosService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) {
    return this.service.list(user);
  }

  @Get('digital-pricing')
  digitalPricing() {
    return this.service.digitalPricing();
  }

  @Post()
  create(@Body() dto: CreateRecaudoDto, @CurrentUser() user: AuthPrincipal) {
    return this.service.create(dto, user);
  }

  @Post('join')
  join(@Body() dto: JoinByCodeDto, @CurrentUser() user: AuthPrincipal) {
    return this.service.requestJoin(dto.shareCode, user);
  }

  @Post('invites/accept')
  accept(@Body() dto: AcceptInviteDto, @CurrentUser() user: AuthPrincipal) {
    return this.service.acceptInvite(dto.token, user);
  }

  @Post('access-requests/:requestId/accept')
  acceptAccessRequest(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.acceptAccessRequest(requestId, user);
  }

  @Post('access-requests/:requestId/reject')
  rejectAccessRequest(
    @Param('requestId') requestId: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.rejectAccessRequest(requestId, user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.service.detail(id, user);
  }

  @Get(':id/share-code')
  shareCode(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.service.ensureShareCode(id, user);
  }

  @Get(':id/access-requests')
  accessRequests(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.listAccessRequests(id, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRecaudoDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.service.close(id, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.service.remove(id, user);
  }

  @Post(':id/delete')
  removeViaPost(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.service.remove(id, user);
  }

  @Patch(':id/participants/me/plan')
  configurePlan(
    @Param('id') id: string,
    @Body() dto: ConfigurePlanDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.configurePlan(id, dto, user);
  }

  @Post(':id/contributions')
  contribute(
    @Param('id') id: string,
    @Body() dto: ContributionDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.contribute(id, dto, idempotencyKey, user);
  }

  @Post(':id/withdrawals')
  withdraw(
    @Param('id') id: string,
    @Body() dto: WithdrawalDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.withdraw(id, dto, idempotencyKey, user);
  }

  @Post(':id/tecno-account')
  syncTecnoAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.syncTecnoAccount(id, user);
  }

  @Post(':id/invites')
  invite(
    @Param('id') id: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.invite(id, dto, user);
  }
}

export function calculateProgress(
  collectedMinor: number,
  targetMinor: number,
): number {
  if (targetMinor <= 0) return 0;
  return Math.round((collectedMinor / targetMinor) * 10_000) / 100;
}

export function digestInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createSimulatedCard(existing?: SimulatedCard): SimulatedCard {
  return (
    existing ?? {
      brand: randomInt(2) === 0 ? 'visa_simulated' : 'mastercard_simulated',
      last4: randomInt(0, 10_000).toString().padStart(4, '0'),
    }
  );
}

function assertObjectId(value: string): void {
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException('Invalid identifier');
  }
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Module({
  imports: [
    AuthModule,
    PushModule,
    BridgeModule,
    MongooseModule.forFeature([
      { name: Recaudo.name, schema: RecaudoSchema },
      { name: Participant.name, schema: ParticipantSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: Withdrawal.name, schema: WithdrawalSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: RecaudoAccessRequest.name, schema: RecaudoAccessRequestSchema },
    ]),
  ],
  controllers: [RecaudosController],
  providers: [
    RecaudosService,
    ConfiguredRecaudoMailer,
    { provide: RecaudoMailer, useExisting: ConfiguredRecaudoMailer },
  ],
  exports: [RecaudosService, RecaudoMailer],
})
export class RecaudosModule {}
