import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MercadoPagoModule } from '../payments/mercadopago.module';
import { BridgeClient } from './bridge-client';
import { BridgeKycController, BridgeWebhookController } from './bridge-kyc.controller';
import { BridgeKycService } from './bridge-kyc.service';
import { RecaudoBridgeService } from './recaudo-bridge.service';

@Module({
  imports: [AuthModule, MercadoPagoModule],
  controllers: [BridgeKycController, BridgeWebhookController],
  providers: [BridgeClient, RecaudoBridgeService, BridgeKycService],
  exports: [BridgeClient, RecaudoBridgeService, BridgeKycService],
})
export class BridgeModule {}
