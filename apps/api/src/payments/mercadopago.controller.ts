import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';

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

@ApiTags('payments')
@Controller('payments')
export class MercadoPagoReturnController {
  constructor(private readonly mp: MercadoPagoService) {}

  @Public()
  @Get('wallet-return')
  async walletReturn(
    @Query() query: Record<string, unknown>,
    @Res() reply: FastifyReply,
  ) {
    const html = await this.mp.handleReturn(query);
    return reply.type('text/html; charset=utf-8').send(html);
  }

  @Public()
  @Get('wallet-return/:result')
  async walletReturnWithResult(
    @Param('result') result: string,
    @Query() query: Record<string, unknown>,
    @Res() reply: FastifyReply,
  ) {
    const html = await this.mp.handleReturn({ ...query, result });
    return reply.type('text/html; charset=utf-8').send(html);
  }
}
