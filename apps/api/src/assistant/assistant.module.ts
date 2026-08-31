import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule, Workspace, WorkspaceSchema } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { LedgerService, LedgerTransaction, LedgerTransactionSchema } from '../ledger/ledger';
import {
  FinanceResource,
  FinanceResourceSchema,
} from '../platform/platform.module';
import { AssistantController } from './assistant.controller';
import { AssistantQueryService } from './assistant-query.service';
import { AssistantService } from './assistant.service';
import { OpenAiClient } from './openai.client';

@Module({
  imports: [
    AuthModule,
    BillingModule,
    MongooseModule.forFeature([
      { name: LedgerTransaction.name, schema: LedgerTransactionSchema },
      { name: FinanceResource.name, schema: FinanceResourceSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
    ]),
  ],
  controllers: [AssistantController],
  providers: [OpenAiClient, AssistantQueryService, AssistantService, LedgerService],
})
export class AssistantModule {}
