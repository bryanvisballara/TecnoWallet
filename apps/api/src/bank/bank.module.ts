import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { LedgerService, LedgerTransaction, LedgerTransactionSchema } from '../ledger/ledger';
import { BelvoClient } from './belvo.client';
import { BankController, BelvoWebhookController } from './bank.controller';
import {
  BankConnection,
  BankConnectionSchema,
  PendingBankTransaction,
  PendingBankTransactionSchema,
} from './bank.schemas';
import { BankService } from './bank.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: BankConnection.name, schema: BankConnectionSchema },
      {
        name: PendingBankTransaction.name,
        schema: PendingBankTransactionSchema,
      },
      { name: LedgerTransaction.name, schema: LedgerTransactionSchema },
    ]),
  ],
  controllers: [BankController, BelvoWebhookController],
  providers: [BelvoClient, BankService, LedgerService],
  exports: [BankService],
})
export class BankModule {}
