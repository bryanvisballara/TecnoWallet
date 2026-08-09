import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
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

const planFrequencies = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
const paymentModes = ['manual', 'card_simulated', 'bank_ach'] as const;
const recaudoCategories = [
  'travel',
  'gift',
  'event',
  'purchase',
  'other',
] as const;
type PlanFrequency = (typeof planFrequencies)[number];
type PaymentMode = (typeof paymentModes)[number];
type RecaudoCategory = (typeof recaudoCategories)[number];
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

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
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
  @Length(3, 3)
  currency!: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;
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
  @IsDateString()
  deadline?: string;
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
  constructor(
    @InjectModel(Recaudo.name) private readonly recaudos: Model<Recaudo>,
    @InjectModel(Participant.name)
    private readonly participants: Model<Participant>,
    @InjectModel(Contribution.name)
    private readonly contributions: Model<Contribution>,
    @InjectModel(Withdrawal.name)
    private readonly withdrawals: Model<Withdrawal>,
    @InjectModel(Invite.name) private readonly invites: Model<Invite>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly mailer: RecaudoMailer,
    private readonly config: ConfigService,
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
    const recaudo = await this.recaudos.create({
      workspaceId: dto.workspaceId,
      organizerId: principal.userId,
      title: dto.title,
      category: dto.category,
      description: dto.description,
      targetMinor: dto.targetMinor,
      monthlyTargetMinor: dto.monthlyTargetMinor,
      currency: dto.currency.toUpperCase(),
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
    });
    await this.participants.create({
      recaudoId: recaudo._id,
      userId: principal.userId,
      role: 'organizer',
    });
    return this.detail(recaudo._id.toString(), principal);
  }

  async list(principal: AuthPrincipal) {
    const memberships = await this.participants.find({
      userId: principal.userId,
    });
    const recaudos = await this.recaudos
      .find({ _id: { $in: memberships.map((item) => item.recaudoId) } })
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
      ...(dto.deadline !== undefined
        ? { deadline: new Date(dto.deadline) }
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
    await recaudo.save();
    return this.detail(id, principal);
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
      { userId: input.userId, email: '' },
    );
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
      { userId: input.organizerId, email: '' },
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
    try {
      const withdrawal = await this.withdrawals.create({
        recaudoId: recaudo._id,
        organizerId: principal.userId,
        amountMinor: dto.amountMinor,
        currency: recaudo.currency,
        note: dto.note,
        idempotencyKey,
      });
      const totals = await this.totals(recaudo);
      if (totals.collectedMinor <= 0) {
        recaudo.status = 'closed';
        recaudo.closedAt = new Date();
        await recaudo.save();
      }
      return {
        withdrawal,
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
    const recaudo = await this.recaudos.findById(id);
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

  private async totals(recaudo: HydratedDocument<Recaudo>) {
    const collectedMinor = await this.collected(recaudo._id.toString());
    return {
      collectedMinor,
      progressPercent: calculateProgress(collectedMinor, recaudo.targetMinor),
    };
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

  @Post()
  create(@Body() dto: CreateRecaudoDto, @CurrentUser() user: AuthPrincipal) {
    return this.service.create(dto, user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthPrincipal) {
    return this.service.detail(id, user);
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

  @Post(':id/invites')
  invite(
    @Param('id') id: string,
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.service.invite(id, dto, user);
  }

  @Post('invites/accept')
  accept(@Body() dto: AcceptInviteDto, @CurrentUser() user: AuthPrincipal) {
    return this.service.acceptInvite(dto.token, user);
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
    MongooseModule.forFeature([
      { name: Recaudo.name, schema: RecaudoSchema },
      { name: Participant.name, schema: ParticipantSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: Withdrawal.name, schema: WithdrawalSchema },
      { name: Invite.name, schema: InviteSchema },
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
