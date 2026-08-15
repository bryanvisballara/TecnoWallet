import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { MercadoPagoWebhookController } from './mercadopago.controller';
import { MercadoPagoService } from './mercadopago.service';

@Module({
  imports: [AuthModule],
  controllers: [MercadoPagoWebhookController],
  providers: [MercadoPagoService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
