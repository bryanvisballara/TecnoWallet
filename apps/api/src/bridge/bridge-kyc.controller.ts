import { Body, Controller, Get, Headers, Logger, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import type { FastifyReply } from 'fastify';

import { CurrentUser, Public, type AuthPrincipal } from '../auth/auth.module';
import { BridgeKycService } from './bridge-kyc.service';

class StartKycDto {
  @IsOptional()
  @IsBoolean()
  retry?: boolean;
}

@ApiTags('bridge')
@ApiBearerAuth()
@Controller('bridge')
export class BridgeKycController {
  constructor(private readonly kyc: BridgeKycService) {}

  @Get('kyc')
  status(@CurrentUser() user: AuthPrincipal) {
    return this.kyc.status(user.userId);
  }

  @Post('kyc-links')
  start(@CurrentUser() user: AuthPrincipal, @Body() dto: StartKycDto) {
    return this.kyc.start(user.userId, Boolean(dto?.retry));
  }

  @Post('kyc/reset-draft')
  resetDraft(@CurrentUser() user: AuthPrincipal) {
    return this.kyc.resetDraft(user.userId);
  }

  @Public()
  @Get('tos-return')
  tosReturn(@Res() reply: FastifyReply) {
    return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Términos aceptados</title>
<body style="font-family:-apple-system,sans-serif;padding:32px;max-width:420px;margin:40px auto;color:#111">
<h1 style="font-size:22px">Términos aceptados</h1>
<p>Cierra esta ventana y, si la app no abre sola la verificación de identidad, pulsa <strong>Continuar verificación</strong>.</p>
</body></html>`);
  }

  @Public()
  @Get('kyc-return')
  kycReturn(@Res() reply: FastifyReply) {
    return reply.type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verificación enviada</title>
<body style="font-family:-apple-system,sans-serif;padding:32px;max-width:420px;margin:40px auto;color:#111">
<h1 style="font-size:22px">Datos enviados</h1>
<p>Cierra esta ventana y vuelve a TecnoWallet. Actualizaremos el estado de tu verificación.</p>
</body></html>`);
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class BridgeWebhookController {
  private readonly logger = new Logger(BridgeWebhookController.name);

  constructor(private readonly kyc: BridgeKycService) {}

  /**
   * Dashboard webhook URL:
   * https://tecnowallet.onrender.com/api/v1/webhooks/bridge
   */
  @Public()
  @Post('bridge')
  async notice(
    @Headers() _headers: Record<string, string | undefined>,
    @Body() body: Record<string, unknown>,
  ) {
    this.logger.log(
      `Webhook ${String(body.event_type ?? body.event_category ?? 'unknown')} id=${String(body.event_id ?? '')}`,
    );
    return this.kyc.handleWebhook(body ?? {});
  }
}
