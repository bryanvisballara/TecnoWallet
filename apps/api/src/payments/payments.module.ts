import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { Recaudo, RecaudoSchema, RecaudosModule } from '../recaudos/recaudos.module';
import { CardPaymentProvider, PaymentProvider } from './payment-provider';
import { UnconfiguredCardPaymentProvider } from './card-provider.stub';
import { ContributionSchedulerService } from './contribution-scheduler.service';
import { PaymentOrchestrationService } from './payment-orchestration.service';
import {
  FinancialAllocation,
  FinancialAllocationSchema,
  PaymentIntent,
  PaymentIntentSchema,
  ProviderWebhookEvent,
  ProviderWebhookEventSchema,
  RecurringFundingSchedule,
  RecurringFundingScheduleSchema,
} from './payments.schemas';
import { BridgeClient } from '../bridge/bridge-client';
import { UnitClient } from '../unit/unit-client';
import { UnitCustomerService } from '../unit/unit-customer.service';
import { UnitAccountService } from '../unit/unit-account.service';
import { UnitCounterpartyService } from '../unit/unit-counterparty.service';
import {
  UnitPaymentProvider,
  UnitPaymentService,
  UnitRecurringPaymentService,
} from '../unit/unit-payment.service';
import {
  UnitIdentity,
  UnitIdentitySchema,
  UnitRecaudoAccount,
  UnitRecaudoAccountSchema,
  UnitCounterparty,
  UnitCounterpartySchema,
} from '../unit/unit.schemas';
import {
  PaymentsController,
  UnitController,
  UnitWebhookController,
} from '../unit/unit.controllers';

@Module({
  imports: [
    AuthModule,
    RecaudosModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: PaymentIntent.name, schema: PaymentIntentSchema },
      { name: ProviderWebhookEvent.name, schema: ProviderWebhookEventSchema },
      {
        name: RecurringFundingSchedule.name,
        schema: RecurringFundingScheduleSchema,
      },
      { name: FinancialAllocation.name, schema: FinancialAllocationSchema },
      { name: UnitIdentity.name, schema: UnitIdentitySchema },
      { name: UnitRecaudoAccount.name, schema: UnitRecaudoAccountSchema },
      { name: UnitCounterparty.name, schema: UnitCounterpartySchema },
      { name: Recaudo.name, schema: RecaudoSchema },
    ]),
  ],
  controllers: [UnitController, PaymentsController, UnitWebhookController],
  providers: [
    BridgeClient,
    UnitClient,
    UnitCustomerService,
    UnitAccountService,
    UnitCounterpartyService,
    UnitPaymentService,
    UnitRecurringPaymentService,
    UnitPaymentProvider,
    UnconfiguredCardPaymentProvider,
    PaymentOrchestrationService,
    ContributionSchedulerService,
    { provide: PaymentProvider, useExisting: UnitPaymentProvider },
    { provide: CardPaymentProvider, useExisting: UnconfiguredCardPaymentProvider },
  ],
  exports: [
    PaymentProvider,
    CardPaymentProvider,
    PaymentOrchestrationService,
    BridgeClient,
    UnitCustomerService,
    UnitAccountService,
    UnitCounterpartyService,
  ],
})
export class PaymentsModule {}
