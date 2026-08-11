import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, Types } from 'mongoose';

export const pushPlatforms = ['ios', 'android', 'expo'] as const;
export type PushPlatform = (typeof pushPlatforms)[number];

@Schema({ timestamps: true })
export class DevicePushToken {
  _id!: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
    type: MongooseSchema.Types.ObjectId,
  })
  userId!: Types.ObjectId;

  /** Expo push token or native APNS/FCM device token. */
  @Prop({ required: true, unique: true, trim: true })
  token!: string;

  @Prop({ required: true, enum: pushPlatforms })
  platform!: PushPlatform;

  /**
   * Cached APNS environment that last accepted this device token.
   * Xcode/debug → sandbox; TestFlight/App Store → production.
   * Null means unknown (try both).
   */
  @Prop({ required: false, default: null, type: Boolean })
  apnsProduction!: boolean | null;

  updatedAt!: Date;
  createdAt!: Date;
}

export const DevicePushTokenSchema =
  SchemaFactory.createForClass(DevicePushToken);
DevicePushTokenSchema.index({ userId: 1, platform: 1 });
