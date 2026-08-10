import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../auth/auth.module';

export const subscriptionStatuses = [
  'active',
  'grace_period',
  'billing_retry',
  'expired',
  'cancelled',
  'refunded',
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];

@Schema({ timestamps: true })
export class Subscription {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
    ref: User.name,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true, trim: true })
  appUserId!: string;

  @Prop({
    required: true,
    type: String,
    enum: subscriptionStatuses,
    default: 'expired',
    index: true,
  })
  status!: SubscriptionStatus;

  @Prop({ required: true, trim: true })
  entitlementId!: string;

  @Prop({ trim: true })
  productId?: string;

  @Prop({ trim: true, index: true })
  originalTransactionId?: string;

  @Prop({ trim: true, index: true })
  latestTransactionId?: string;

  @Prop({ trim: true })
  environment?: string;

  @Prop()
  purchasedAt?: Date;

  @Prop({ index: true })
  expiresAt?: Date;

  @Prop({ required: true, default: false })
  willRenew!: boolean;

  @Prop({ required: true, default: 'revenuecat', trim: true })
  provider!: string;

  @Prop({ trim: true })
  lastEventId?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ appUserId: 1, entitlementId: 1 });

@Schema({ timestamps: true })
export class RevenueCatWebhookEvent {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true, trim: true })
  eventId!: string;

  @Prop({ required: true, index: true, trim: true })
  eventType!: string;

  @Prop({ index: true, trim: true })
  appUserId?: string;

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
export const RevenueCatWebhookEventSchema = SchemaFactory.createForClass(
  RevenueCatWebhookEvent,
);
