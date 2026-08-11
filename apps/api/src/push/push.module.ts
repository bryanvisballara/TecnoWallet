import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AuthModule,
  Membership,
  MembershipSchema,
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
} from '../auth/auth.module';
import {
  Calendar,
  CalendarMembership,
  CalendarMembershipSchema,
  CalendarSchema,
} from '../collaboration/collaboration.schemas';
import { PushController } from './push.controller';
import { DevicePushToken, DevicePushTokenSchema } from './push.schemas';
import { PushService } from './push.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: DevicePushToken.name, schema: DevicePushTokenSchema },
      { name: Membership.name, schema: MembershipSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: User.name, schema: UserSchema },
      { name: CalendarMembership.name, schema: CalendarMembershipSchema },
      { name: Calendar.name, schema: CalendarSchema },
    ]),
  ],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
