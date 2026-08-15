import { Body, Controller, Get, Headers, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

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
