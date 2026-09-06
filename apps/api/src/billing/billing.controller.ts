import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { createHash, timingSafeEqual } from 'node:crypto';
import { CurrentUser, Public, type AuthPrincipal } from '../auth/auth.module';
import { CollaborationService } from '../collaboration/collaboration.service';
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
    @Inject(forwardRef(() => CollaborationService))
    private readonly collaboration: CollaborationService,
  ) {}

  @Get('status')
  status(@CurrentUser() user: AuthPrincipal) {
    return this.statusWithGuestAccess(user);
  }

  @Post('sync')
  async sync(@CurrentUser() user: AuthPrincipal, @Body() body: SyncBillingDto) {
    await this.billing.sync(user.userId, body.appUserId);
    return this.statusWithGuestAccess(user);
  }

  private async statusWithGuestAccess(user: AuthPrincipal) {
    await this.collaboration.acceptPendingInvitesForUser(user);
    const [status, guest] = await Promise.all([
      this.entitlements.statusFor(user.userId),
      this.collaboration.guestAccessFor(user.userId, user.email),
    ]);
    return { ...status, ...guest };
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
