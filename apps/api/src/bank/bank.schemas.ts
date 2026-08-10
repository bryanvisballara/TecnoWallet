import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const pendingBankTxStatuses = [
  'pending',
  'accepted',
  'dismissed',
] as const;
export type PendingBankTxStatus = (typeof pendingBankTxStatuses)[number];

@Schema({ timestamps: true, collection: 'bankconnections' })
export class BankConnection {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  workspaceId!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: 'belvo' })
  provider!: 'belvo';

  @Prop({ required: true, unique: true, index: true })
  belvoLinkId!: string;

  @Prop({ trim: true })
  institutionName?: string;

  @Prop({ trim: true })
  institutionCode?: string;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'invalid', 'token_required', 'disconnected'],
    default: 'active',
  })
  status!: 'active' | 'invalid' | 'token_required' | 'disconnected';

  @Prop()
  lastSyncedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const BankConnectionSchema = SchemaFactory.createForClass(BankConnection);
BankConnectionSchema.index({ workspaceId: 1, userId: 1 });

@Schema({ timestamps: true, collection: 'pendingbanktransactions' })
export class PendingBankTransaction {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  workspaceId!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  connectionId!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  belvoTransactionId!: string;

  @Prop({ trim: true })
  belvoAccountId?: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ trim: true })
  merchantName?: string;

  @Prop({ required: true })
  amountMinor!: number;

  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 })
  currency!: string;

  /** Belvo sign: typically negative = outflow (expense). */
  @Prop({ required: true, type: String, enum: ['income', 'expense'] })
  kind!: 'income' | 'expense';

  @Prop({ required: true })
  occurredAt!: Date;

  @Prop({
    required: true,
    type: String,
    enum: pendingBankTxStatuses,
    default: 'pending',
  })
  status!: PendingBankTxStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  ledgerTransactionId?: Types.ObjectId;

  createdAt!: Date;
  updatedAt!: Date;
}
export const PendingBankTransactionSchema = SchemaFactory.createForClass(
  PendingBankTransaction,
);
PendingBankTransactionSchema.index(
  { workspaceId: 1, belvoTransactionId: 1 },
  { unique: true },
);
PendingBankTransactionSchema.index({ workspaceId: 1, status: 1, occurredAt: -1 });
