import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const unitIdentityStatuses = [
  'none',
  'pending',
  'awaitingDocuments',
  'approved',
  'denied',
  'canceled',
] as const;
export type UnitIdentityStatus = (typeof unitIdentityStatuses)[number];

@Schema({ timestamps: true })
export class UnitIdentity {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  userId!: Types.ObjectId;

  @Prop({ index: true })
  unitApplicationId?: string;

  @Prop({ index: true })
  unitCustomerId?: string;

  @Prop({
    required: true,
    type: String,
    enum: unitIdentityStatuses,
    default: 'none',
  })
  status!: UnitIdentityStatus;

  @Prop({ trim: true })
  denialReason?: string;

  createdAt!: Date;
  updatedAt!: Date;
}
export const UnitIdentitySchema = SchemaFactory.createForClass(UnitIdentity);

/** One Unit deposit account (checking) per recaudo pot. */
@Schema({ timestamps: true, collection: 'unitrecaudoaccounts' })
export class UnitRecaudoAccount {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    unique: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  recaudoId!: Types.ObjectId;

  /** Denormalized book/workspace for queries. */
  @Prop({ index: true, type: MongooseSchema.Types.ObjectId })
  workspaceId?: Types.ObjectId;

  @Prop({ index: true })
  unitCustomerId?: string;

  /** Unit deposit/wallet account id used as the recaudo pot. */
  @Prop({ index: true })
  unitWalletId?: string;

  @Prop({ default: 'checking' })
  walletTerms!: string;

  @Prop({
    required: true,
    type: String,
    enum: ['pending', 'open', 'frozen', 'closed'],
    default: 'pending',
  })
  status!: 'pending' | 'open' | 'frozen' | 'closed';

  createdAt!: Date;
  updatedAt!: Date;
}
export const UnitRecaudoAccountSchema =
  SchemaFactory.createForClass(UnitRecaudoAccount);

/** @deprecated Prefer UnitRecaudoAccount — kept as alias for gradual rename. */
export const UnitWorkspaceAccount = UnitRecaudoAccount;
export const UnitWorkspaceAccountSchema = UnitRecaudoAccountSchema;

@Schema({ timestamps: true })
export class UnitCounterparty {
  _id!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  unitCounterpartyId!: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true })
  bank?: string;

  @Prop({ trim: true })
  accountType?: string;

  @Prop({ trim: true })
  accountNumberMask?: string;

  @Prop({ trim: true })
  routingNumberMask?: string;

  @Prop({ trim: true })
  verificationMethod?: string;

  @Prop({ required: true, default: true })
  active!: boolean;

  createdAt!: Date;
  updatedAt!: Date;
}
export const UnitCounterpartySchema =
  SchemaFactory.createForClass(UnitCounterparty);
UnitCounterpartySchema.index(
  { userId: 1, unitCounterpartyId: 1 },
  { unique: true },
);
