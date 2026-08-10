import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, type AuthPrincipal } from '../auth/auth.module';
import {
  AffiliateCodeDto,
  ClaimAffiliateDto,
  EnrollAffiliateDto,
  RecordAffiliateClickDto,
  UpdateAffiliatePayoutDto,
} from './affiliate.dto';
import { AffiliateService } from './affiliate.service';
import { createHash, timingSafeEqual } from 'node:crypto';

@ApiTags('affiliate')
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Public()
  @Post('click')
  recordClick(
    @Body() body: RecordAffiliateClickDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ip: string | undefined,
  ) {
    return this.affiliate.recordClick(body.code, {
      branchClickId: body.branchClickId,
      campaign: body.campaign,
      userAgent,
      ip,
    });
  }

  @ApiBearerAuth()
  @Post('claim')
  claim(@Body() body: ClaimAffiliateDto, @CurrentUser() user: AuthPrincipal) {
    return this.affiliate.claim(user.userId, body);
  }

  @Public()
  @Get('code/:code')
  getByCode(@Param() params: AffiliateCodeDto) {
    return this.affiliate.getByCode(params.code);
  }

  @ApiBearerAuth()
  @Get('me')
  getMe(@CurrentUser() user: AuthPrincipal) {
    return this.affiliate.getMyAttribution(user.userId);
  }

  @ApiBearerAuth()
  @Post('partner/enroll')
  enrollPartner(
    @Body() body: EnrollAffiliateDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.affiliate.enrollPartner(user.userId, body.code);
  }

  @ApiBearerAuth()
  @Get('partner/dashboard')
  partnerDashboard(@CurrentUser() user: AuthPrincipal) {
    return this.affiliate.getPartnerDashboard(user.userId);
  }

  @ApiBearerAuth()
  @Patch('partner/payout')
  updatePayout(
    @Body() body: UpdateAffiliatePayoutDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.affiliate.updatePartnerPayout(user.userId, body);
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class BranchWebhookController {
  constructor(
    private readonly affiliate: AffiliateService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('branch')
  recordInstall(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    this.assertAuthorized(authorization);
    const data =
      typeof body.data === 'object' && body.data
        ? (body.data as Record<string, unknown>)
        : body;
    const custom =
      typeof data.custom_data === 'object' && data.custom_data
        ? (data.custom_data as Record<string, unknown>)
        : data;
    const text = (...values: unknown[]) =>
      values.find((value): value is string =>
        Boolean(typeof value === 'string' && value.trim()),
      );
    const providerEventId = text(body.event_id, body.id, data.event_id);
    const code = text(custom.affiliate_code, custom.code, data.affiliate_code);
    if (!providerEventId || !code) {
      return { received: true, ignored: true };
    }
    return this.affiliate.recordInstall({
      providerEventId,
      code,
      branchClickId: text(data.branch_click_id, data['~id']),
      branchIdentity: text(data.identity, data.developer_identity),
      installedAt: text(data.timestamp, body.timestamp),
    });
  }

  private assertAuthorized(authorization: string | undefined) {
    const expected = this.config.get<string>('BRANCH_SECRET')?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'Branch webhook authorization is not configured',
      );
    }
    const actual = authorization?.replace(/^Bearer\s+/i, '').trim() ?? '';
    const actualDigest = createHash('sha256').update(actual).digest();
    const expectedDigest = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(actualDigest, expectedDigest)) {
      throw new UnauthorizedException('Invalid Branch webhook authorization');
    }
  }
}
