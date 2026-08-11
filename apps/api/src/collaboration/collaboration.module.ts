import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { MailModule } from '../mail/mail.module';
import { PushModule } from '../push/push.module';
import {
  CalendarController,
  CollaborationController,
} from './collaboration.controller';
import {
  Calendar,
  CalendarMembership,
  CalendarMembershipSchema,
  CalendarItemRecord,
  CalendarItemRecordSchema,
  CalendarSchema,
  CollaborationAccessRequest,
  CollaborationAccessRequestSchema,
  CollaborationInvite,
  CollaborationInviteSchema,
  CollaborationSeat,
  CollaborationSeatSchema,
} from './collaboration.schemas';
import { CalendarService, CollaborationService } from './collaboration.service';
import { CalendarReminderSchedulerService } from './calendar-reminder.scheduler';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    MailModule,
    PushModule,
    MongooseModule.forFeature([
      { name: CollaborationInvite.name, schema: CollaborationInviteSchema },
      { name: CollaborationSeat.name, schema: CollaborationSeatSchema },
      {
        name: CollaborationAccessRequest.name,
        schema: CollaborationAccessRequestSchema,
      },
      { name: Calendar.name, schema: CalendarSchema },
      { name: CalendarMembership.name, schema: CalendarMembershipSchema },
      { name: CalendarItemRecord.name, schema: CalendarItemRecordSchema },
    ]),
  ],
  controllers: [CollaborationController, CalendarController],
  providers: [
    CollaborationService,
    CalendarService,
    CalendarReminderSchedulerService,
  ],
  exports: [CollaborationService, CalendarService, MongooseModule],
})
export class CollaborationModule {}
