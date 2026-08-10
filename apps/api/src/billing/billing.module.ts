import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { AffiliateModule } from '../affiliate/affiliate.module';
import {
  BillingController,
  RevenueCatWebhookController,
} from './billing.controller';
import { BillingService } from './billing.service';
import {
  RevenueCatWebhookEvent,
  RevenueCatWebhookEventSchema,
  Subscription,
  SubscriptionSchema,
} from './billing.schemas';
import { EntitlementService } from './entitlement.service';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => AffiliateModule),
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      {
        name: RevenueCatWebhookEvent.name,
        schema: RevenueCatWebhookEventSchema,
      },
    ]),
  ],
  controllers: [BillingController, RevenueCatWebhookController],
  providers: [BillingService, EntitlementService],
  exports: [BillingService, EntitlementService, MongooseModule],
})
export class BillingModule {}
