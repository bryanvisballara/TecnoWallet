import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const commissionEventStatuses = [
  'pending',
  'approved',
  'paid',
  'reversed',
] as const;
export type CommissionEventStatus = (typeof commissionEventStatuses)[number];

export const AFFILIATE_PAYOUT_TYPES = ['usdt_wallet'] as const;
export type AffiliatePayoutType = (typeof AFFILIATE_PAYOUT_TYPES)[number];

export const AFFILIATE_USDT_NETWORKS = [
  'bep20',
  'trc20',
  'erc20',
  'sol',
] as const;
export type AffiliateUsdtNetwork = (typeof AFFILIATE_USDT_NETWORKS)[number];

@Schema({ _id: false })
export class AffiliatePayoutMethod {
  @Prop({
    required: true,
    type: String,
    enum: AFFILIATE_PAYOUT_TYPES,
    default: 'usdt_wallet',
  })
  type!: AffiliatePayoutType;

  @Prop({ required: true, uppercase: true, default: 'USDT' })
  asset!: string;

  @Prop({
    required: true,
    type: String,
    enum: AFFILIATE_USDT_NETWORKS,
  })
  network!: AffiliateUsdtNetwork;

  @Prop({ required: true, trim: true, maxlength: 128 })
  address!: string;

  @Prop()
  updatedAt?: Date;
}
export const AffiliatePayoutMethodSchema = SchemaFactory.createForClass(
  AffiliatePayoutMethod,
);

@Schema({ timestamps: true })
export class Affiliate {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
    minlength: 2,
    maxlength: 40,
  })
  code!: string;

  @Prop({ required: true, trim: true, maxlength: 160 })
  name!: string;

  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true,
    default: randomUUID,
  })
  affiliateId!: string;

  @Prop({ required: true, min: 0, max: 100 })
  commissionPercent!: number;

  @Prop({ required: true, default: true, index: true })
  active!: boolean;

  @Prop({ required: true, default: 12, min: 0 })
  revenueShareMonths!: number;

  @Prop({ trim: true, maxlength: 2048 })
  branchUrl?: string;

  /** TecnoWallet user who owns this partner profile (self-serve enroll). */
  @Prop({
    index: true,
    unique: true,
    sparse: true,
    type: MongooseSchema.Types.ObjectId,
  })
  ownerUserId?: Types.ObjectId;

  @Prop({ type: AffiliatePayoutMethodSchema })
  payoutMethod?: AffiliatePayoutMethod;

  createdAt!: Date;
  updatedAt!: Date;
}
export const AffiliateSchema = SchemaFactory.createForClass(Affiliate);

@Schema({ timestamps: true })
export class AffiliateClick {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, trim: true })
  affiliateId!: string;

  @Prop({ required: true, index: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ required: true, unique: true, index: true, trim: true })
  clickId!: string;

  @Prop({ index: true, trim: true, maxlength: 256 })
  branchClickId?: string;

  @Prop({ trim: true, maxlength: 160 })
  campaign?: string;

  @Prop({ default: Date.now, index: true })
  timestamp?: Date;

  @Prop({ trim: true, maxlength: 512 })
  userAgent?: string;

  @Prop({ minlength: 64, maxlength: 64 })
  ipHash?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export const AffiliateClickSchema =
  SchemaFactory.createForClass(AffiliateClick);
AffiliateClickSchema.index({ affiliateId: 1, timestamp: -1 });

@Schema({ timestamps: true })
export class AffiliateInstall {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true })
  providerEventId!: string;

  @Prop({ required: true, index: true, trim: true })
  affiliateId!: string;

  @Prop({ required: true, index: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ trim: true, maxlength: 256 })
  branchClickId?: string;

  @Prop({ trim: true, maxlength: 256 })
  branchIdentity?: string;

  @Prop({ required: true, default: Date.now, index: true })
  installedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const AffiliateInstallSchema =
  SchemaFactory.createForClass(AffiliateInstall);
AffiliateInstallSchema.index({ affiliateId: 1, installedAt: -1 });

@Schema({ timestamps: true })
export class UserAttribution {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true, trim: true })
  affiliateId!: string;

  @Prop({ required: true, index: true, trim: true, uppercase: true })
  code!: string;

  @Prop({ trim: true, maxlength: 256 })
  branchClickId?: string;

  @Prop({ trim: true, maxlength: 128 })
  clickId?: string;

  @Prop({ required: true, trim: true, maxlength: 40 })
  source!: string;

  @Prop({ required: true, default: Date.now, immutable: true, index: true })
  attributedAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const UserAttributionSchema =
  SchemaFactory.createForClass(UserAttribution);

@Schema({ timestamps: true })
export class CommissionEvent {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true })
  providerEventId!: string;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true, trim: true })
  affiliateId!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  product!: string;

  @Prop({ required: true, index: true, trim: true, maxlength: 120 })
  eventType!: string;

  @Prop({ required: true })
  grossAmountMinor!: number;

  @Prop({ required: true })
  netAmountMinor!: number;

  @Prop({ required: true })
  storeFeeAmountMinor!: number;

  @Prop({ required: true })
  commissionAmountMinor!: number;

  @Prop({
    required: true,
    uppercase: true,
    minlength: 3,
    maxlength: 3,
  })
  currency!: string;

  @Prop({
    required: true,
    type: String,
    enum: commissionEventStatuses,
    default: 'pending',
    index: true,
  })
  status!: CommissionEventStatus;

  @Prop({ required: true, index: true })
  occurredAt!: Date;

  @Prop({ required: true, min: 0 })
  monthsSinceAttribution!: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  subscriptionId?: Types.ObjectId;

  /** Percent applied at event time (e.g. 20). */
  @Prop({ required: true, min: 0, max: 100, default: 0 })
  commissionRate!: number;

  @Prop()
  paidAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const CommissionEventSchema =
  SchemaFactory.createForClass(CommissionEvent);
CommissionEventSchema.index({ affiliateId: 1, status: 1, occurredAt: -1 });
CommissionEventSchema.index({ userId: 1, occurredAt: -1 });
