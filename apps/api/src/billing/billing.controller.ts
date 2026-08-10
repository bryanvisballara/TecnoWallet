import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CurrentUser, Public, type AuthPrincipal } from '../auth/auth.module';
import { BillingService } from './billing.service';
import { EntitlementService } from './entitlement.service';

class SyncBillingDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-f\d]{24}$/i)
  appUserId?: string;
}

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Get('status')
  status(@CurrentUser() user: AuthPrincipal) {
    return this.entitlements.statusFor(user.userId);
  }

  @Post('sync')
  async sync(@CurrentUser() user: AuthPrincipal, @Body() body: SyncBillingDto) {
    await this.billing.sync(user.userId, body.appUserId);
    return this.entitlements.statusFor(user.userId);
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class RevenueCatWebhookController {
  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('revenuecat')
  revenueCat(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: Record<string, unknown>,
  ) {
    this.assertAuthorized(authorization);
    return this.billing.processWebhook(payload);
  }

  private assertAuthorized(authorization: string | undefined): void {
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTH')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'RevenueCat webhook authorization is not configured',
      );
    }

    const actualDigest = createHash('sha256')
      .update(authorization?.trim() ?? '')
      .digest();
    const expectedDigest = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(actualDigest, expectedDigest)) {
      throw new UnauthorizedException(
        'Invalid RevenueCat webhook authorization',
      );
    }
  }
}
