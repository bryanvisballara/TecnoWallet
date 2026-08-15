import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import {
  MercadoPagoReturnController,
  MercadoPagoWebhookController,
} from './mercadopago.controller';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  imports: [AuthModule],
  controllers: [MercadoPagoWebhookController, MercadoPagoReturnController],
  providers: [MercadoPagoService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
