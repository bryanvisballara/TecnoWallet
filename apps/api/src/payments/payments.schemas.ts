import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const paymentIntentStatuses = [
  'created',
  'pending',
  'clearing',
  'processing',
  'sent',
  'settled',
  'failed',
  'returned',
  'canceled',
  'rejected',
] as const;
export type PaymentIntentStatus = (typeof paymentIntentStatuses)[number];

export const paymentDirections = ['inbound', 'outbound'] as const;
export type PaymentDirection = (typeof paymentDirections)[number];

export const paymentMethods = [
  'ach_debit',
  'ach_credit',
  'book',
  'card_future',
] as const;
export type PaymentMethodKind = (typeof paymentMethods)[number];

export const fundingSources = ['unit_ach', 'external_record'] as const;
export type FundingSource = (typeof fundingSources)[number];

@Schema({ timestamps: true })
export class PaymentIntent {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  participantId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency!: string;

  @Prop({ required: true, type: String, enum: paymentDirections })
  direction!: PaymentDirection;

  @Prop({ required: true, type: String, enum: paymentMethods })
  method!: PaymentMethodKind;

  @Prop({
    required: true,
    type: String,
    enum: fundingSources,
    default: 'unit_ach',
  })
  fundingSource!: FundingSource;

  @Prop({
    required: true,
    type: String,
    enum: paymentIntentStatuses,
    default: 'created',
    index: true,
  })
  status!: PaymentIntentStatus;

  @Prop({ required: true, index: true })
  idempotencyKey!: string;

  @Prop({ default: 'unit' })
  provider!: string;

  @Prop({ index: true })
  providerPaymentId?: string;

  @Prop({ index: true })
  providerTransactionId?: string;

  @Prop({ index: true })
  providerRecurringId?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  contributionId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  withdrawalId?: Types.ObjectId;

  @Prop({ trim: true, maxlength: 500 })
  note?: string;

  @Prop({ trim: true, maxlength: 500 })
  failureReason?: string;

  @Prop({ type: Object, default: {} })
  tags!: Record<string, string>;

  createdAt!: Date;
  updatedAt!: Date;
}
export const PaymentIntentSchema = SchemaFactory.createForClass(PaymentIntent);
PaymentIntentSchema.index(
  { recaudoId: 1, userId: 1, idempotencyKey: 1 },
  { unique: true },
);

@Schema({ timestamps: true })
export class ProviderWebhookEvent {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, default: 'unit' })
  provider!: string;

  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true, index: true })
  eventType!: string;

  @Prop({ required: true, type: Object })
  payload!: Record<string, unknown>;

  @Prop({ required: true, default: false, index: true })
  processed!: boolean;

  @Prop()
  processedAt?: Date;

  @Prop({ trim: true })
  processingError?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export const ProviderWebhookEventSchema =
  SchemaFactory.createForClass(ProviderWebhookEvent);
ProviderWebhookEventSchema.index(
  { provider: 1, eventId: 1 },
  { unique: true },
);

@Schema({ timestamps: true })
export class RecurringFundingSchedule {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  participantId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amountMinor!: number;

  @Prop({
    required: true,
    type: String,
    enum: ['daily', 'weekly', 'biweekly', 'monthly'],
  })
  frequency!: 'daily' | 'weekly' | 'biweekly' | 'monthly';

  @Prop({
    required: true,
    type: String,
    enum: ['unit_native', 'local_scheduler'],
  })
  driver!: 'unit_native' | 'local_scheduler';

  @Prop({ required: true, default: true })
  enabled!: boolean;

  @Prop({ index: true })
  providerRecurringId?: string;

  @Prop()
  nextRunAt?: Date;

  @Prop()
  lastRunAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const RecurringFundingScheduleSchema = SchemaFactory.createForClass(
  RecurringFundingSchedule,
);
RecurringFundingScheduleSchema.index(
  { recaudoId: 1, participantId: 1 },
  { unique: true },
);

@Schema({ timestamps: true })
export class FinancialAllocation {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  recaudoId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  paymentIntentId!: Types.ObjectId;

  @Prop({ required: true })
  amountMinor!: number;

  @Prop({ required: true, type: String, enum: ['credit', 'debit'] })
  entry!: 'credit' | 'debit';

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency!: string;

  @Prop({ index: true })
  providerTransactionId?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export const FinancialAllocationSchema =
  SchemaFactory.createForClass(FinancialAllocation);
FinancialAllocationSchema.index({ recaudoId: 1, paymentIntentId: 1 });
