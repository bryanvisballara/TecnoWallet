import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import {
  Subscription,
  SubscriptionSchema,
} from '../billing/billing.schemas';
import {
  AffiliateController,
  BranchWebhookController,
} from './affiliate.controller';
import {
  Affiliate,
  AffiliateClick,
  AffiliateClickSchema,
  AffiliateInstall,
  AffiliateInstallSchema,
  AffiliateSchema,
  CommissionEvent,
  CommissionEventSchema,
  UserAttribution,
  UserAttributionSchema,
} from './affiliate.schemas';
import { AffiliateService } from './affiliate.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Affiliate.name, schema: AffiliateSchema },
      { name: AffiliateClick.name, schema: AffiliateClickSchema },
      { name: AffiliateInstall.name, schema: AffiliateInstallSchema },
      { name: UserAttribution.name, schema: UserAttributionSchema },
      { name: CommissionEvent.name, schema: CommissionEventSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
  ],
  controllers: [AffiliateController, BranchWebhookController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
