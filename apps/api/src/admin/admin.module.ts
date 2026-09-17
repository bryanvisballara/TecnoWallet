import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Affiliate,
  AffiliateSchema,
  CommissionEvent,
  CommissionEventSchema,
  UserAttribution,
  UserAttributionSchema,
} from '../affiliate/affiliate.schemas';
import {
  AuthModule,
  RefreshSession,
  RefreshSessionSchema,
  User,
  UserSchema,
  Workspace,
  WorkspaceSchema,
} from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import {
  Subscription,
  SubscriptionSchema,
} from '../billing/billing.schemas';
import { MailModule } from '../mail/mail.module';
import { AdminController } from './admin.controller';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    MailModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: CommissionEvent.name, schema: CommissionEventSchema },
      { name: Affiliate.name, schema: AffiliateSchema },
      { name: UserAttribution.name, schema: UserAttributionSchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminBootstrapService],
})
export class AdminModule {}
