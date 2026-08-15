import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/auth.module';
import { MercadoPagoService } from './mercadopago.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class MercadoPagoWebhookController {
  constructor(private readonly mp: MercadoPagoService) {}

  @Public()
  @Get('mercadopago')
  getNotice(
    @Headers() headers: Record<string, string | undefined>,
    @Query() query: Record<string, unknown>,
  ) {
    this.mp.assertWebhookSignature(headers, query, {});
    return this.mp.handleNotification(query, {});
  }

  @Public()
  @Post('mercadopago')
  postNotice(
    @Headers() headers: Record<string, string | undefined>,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    this.mp.assertWebhookSignature(headers, query, body ?? {});
    return this.mp.handleNotification(query, body ?? {});
  }
}
