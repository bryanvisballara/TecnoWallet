import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const COLLABORATION_RESOURCE_TYPES = ['workspace', 'calendar'] as const;
export type CollaborationResourceType =
  (typeof COLLABORATION_RESOURCE_TYPES)[number];

export const COLLABORATION_ROLES = ['member', 'editor', 'viewer'] as const;
export type CollaborationRole = (typeof COLLABORATION_ROLES)[number];

export const INVITE_STATUSES = [
  'pending',
  'accepted',
  'revoked',
  'expired',
] as const;
export type InviteStatus = (typeof INVITE_STATUSES)[number];

@Schema({ _id: false })
export class CollaborationResourceRef {
  @Prop({ required: true, type: String, enum: COLLABORATION_RESOURCE_TYPES })
  resourceType!: CollaborationResourceType;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  resourceId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: COLLABORATION_ROLES })
  role!: CollaborationRole;
}
export const CollaborationResourceRefSchema = SchemaFactory.createForClass(
  CollaborationResourceRef,
);

@Schema({ timestamps: true })
export class CollaborationInvite {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, select: false })
  tokenHash!: string;

  @Prop({ required: true, lowercase: true, trim: true, index: true })
  email!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  inviteeUserId?: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  sponsorUserId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: COLLABORATION_RESOURCE_TYPES })
  resourceType!: CollaborationResourceType;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  resourceId!: Types.ObjectId;

  @Prop({ required: true, type: String, enum: COLLABORATION_ROLES })
  role!: CollaborationRole;

  @Prop({
    required: true,
    type: String,
    enum: INVITE_STATUSES,
    default: 'pending',
  })
  status!: InviteStatus;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  @Prop()
  acceptedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export type CollaborationInviteDocument = HydratedDocument<CollaborationInvite>;
export const CollaborationInviteSchema =
  SchemaFactory.createForClass(CollaborationInvite);
CollaborationInviteSchema.index(
  { sponsorUserId: 1, resourceType: 1, resourceId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
    name: 'one_pending_invite_per_resource_and_email',
  },
);

@Schema({ timestamps: true })
export class CollaborationSeat {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  sponsorUserId!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  collaboratorUserId?: Types.ObjectId;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  /**
   * Slots 1..10 make the cap race-safe (Plus uses 1..5, Business 1..10).
   * A revoked seat unsets its slot while retaining its history and can later
   * be reactivated.
   */
  @Prop({ min: 1, max: 10 })
  slot?: number;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'pending', 'revoked'],
  })
  status!: 'active' | 'pending' | 'revoked';

  @Prop({
    type: [CollaborationResourceRefSchema],
    default: [],
  })
  resources!: CollaborationResourceRef[];

  createdAt!: Date;
  updatedAt!: Date;
}
export type CollaborationSeatDocument = HydratedDocument<CollaborationSeat>;
export const CollaborationSeatSchema =
  SchemaFactory.createForClass(CollaborationSeat);
CollaborationSeatSchema.index(
  { sponsorUserId: 1, collaboratorUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { collaboratorUserId: { $exists: true } },
    name: 'one_seat_per_sponsor_and_user',
  },
);
CollaborationSeatSchema.index(
  { sponsorUserId: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $exists: true } },
    name: 'one_seat_per_sponsor_and_email',
  },
);
CollaborationSeatSchema.index(
  { sponsorUserId: 1, slot: 1 },
  {
    unique: true,
    partialFilterExpression: { slot: { $exists: true } },
    name: 'ten_race_safe_sponsor_slots',
  },
);

export const ACCESS_REQUEST_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

@Schema({ timestamps: true })
export class CollaborationAccessRequest {
  _id!: Types.ObjectId;

  /** Present for book (workspace) join requests. */
  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  workspaceId?: Types.ObjectId;

  /** Present for calendar join requests. */
  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  calendarId?: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: COLLABORATION_RESOURCE_TYPES,
    default: 'workspace',
    index: true,
  })
  resourceType!: CollaborationResourceType;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  requesterUserId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  ownerUserId!: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ACCESS_REQUEST_STATUSES,
    default: 'pending',
  })
  status!: AccessRequestStatus;

  @Prop()
  resolvedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export type CollaborationAccessRequestDocument =
  HydratedDocument<CollaborationAccessRequest>;
export const CollaborationAccessRequestSchema = SchemaFactory.createForClass(
  CollaborationAccessRequest,
);
CollaborationAccessRequestSchema.index(
  { workspaceId: 1, requesterUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending',
      resourceType: 'workspace',
      workspaceId: { $exists: true },
    },
    name: 'one_pending_access_request_per_workspace_user',
  },
);
CollaborationAccessRequestSchema.index(
  { calendarId: 1, requesterUserId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'pending',
      resourceType: 'calendar',
      calendarId: { $exists: true },
    },
    name: 'one_pending_access_request_per_calendar_user',
  },
);

@Schema({ timestamps: true })
export class Calendar {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ trim: true, default: '#F5C518' })
  color!: string;

  @Prop({ trim: true, default: 'calendar' })
  icon!: string;

  @Prop({ trim: true, sparse: true })
  migrationSourceId?: string;

  /** Short public code for join-by-ID (e.g. TC8F3K2M1Q). */
  @Prop({ trim: true, uppercase: true, sparse: true, unique: true })
  shareCode?: string;

  @Prop({ index: true })
  deletedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export type CalendarDocument = HydratedDocument<Calendar>;
export const CalendarSchema = SchemaFactory.createForClass(Calendar);
CalendarSchema.index({ workspaceId: 1, deletedAt: 1, updatedAt: -1 });
CalendarSchema.index(
  { workspaceId: 1, migrationSourceId: 1 },
  {
    unique: true,
    partialFilterExpression: { migrationSourceId: { $exists: true } },
  },
);

@Schema({ timestamps: true })
export class CalendarMembership {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  calendarId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  userId!: Types.ObjectId;

  @Prop({
    required: true,
    type: String,
    enum: ['owner', 'editor', 'viewer'],
  })
  role!: 'owner' | 'editor' | 'viewer';

  /** Present only when this access is sponsored by another user's Plus plan. */
  @Prop({ type: MongooseSchema.Types.ObjectId, index: true })
  sponsorUserId?: Types.ObjectId;
}
export type CalendarMembershipDocument = HydratedDocument<CalendarMembership>;
export const CalendarMembershipSchema =
  SchemaFactory.createForClass(CalendarMembership);
CalendarMembershipSchema.index({ calendarId: 1, userId: 1 }, { unique: true });

@Schema({ timestamps: true })
export class CalendarItemRecord {
  _id!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  calendarId!: Types.ObjectId;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, index: true })
  ownerId!: Types.ObjectId;

  @Prop({ required: true, type: Object })
  data!: Record<string, unknown>;

  @Prop({ index: true })
  deletedAt?: Date;

  createdAt!: Date;
  updatedAt!: Date;
}
export const CalendarItemRecordSchema =
  SchemaFactory.createForClass(CalendarItemRecord);
CalendarItemRecordSchema.index({
  calendarId: 1,
  deletedAt: 1,
  'data.date': 1,
});
