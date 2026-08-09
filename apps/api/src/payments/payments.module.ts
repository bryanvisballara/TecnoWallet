import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule, Workspace, WorkspaceSchema } from '../auth/auth.module';
import { RecaudosModule } from '../recaudos/recaudos.module';
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
  UnitWorkspaceAccount,
  UnitWorkspaceAccountSchema,
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
      { name: UnitWorkspaceAccount.name, schema: UnitWorkspaceAccountSchema },
      { name: UnitCounterparty.name, schema: UnitCounterpartySchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  controllers: [UnitController, PaymentsController, UnitWebhookController],
  providers: [
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
    UnitCustomerService,
    UnitAccountService,
    UnitCounterpartyService,
  ],
})
export class PaymentsModule {}
