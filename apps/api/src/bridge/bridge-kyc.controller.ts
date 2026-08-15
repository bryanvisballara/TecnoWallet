import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CurrentUser, type AuthPrincipal } from '../auth/auth.module';
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
