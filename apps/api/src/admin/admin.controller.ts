import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly, CurrentUser, type AuthPrincipal } from '../auth/auth.module';
import {
  AdminPayoutsQueryDto,
  AdminUserSearchQueryDto,
  ManualUpgradeDto,
  MarkCommissionsPaidDto,
  PayAffiliateDto,
} from './admin.dto';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@AdminOnly()
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats/users')
  userStats() {
    return this.admin.userStats();
  }

  @Get('affiliate/payouts')
  affiliatePayouts(@Query() query: AdminPayoutsQueryDto) {
    return this.admin.affiliatePayouts(query);
  }

  @Post('affiliate/payouts/simulate')
  simulatePayouts(@CurrentUser() user: AuthPrincipal) {
    return this.admin.simulatePayouts(user.userId, user.email);
  }

  @Post('affiliate/payouts/clear-simulated')
  clearSimulatedPayouts() {
    return this.admin.clearSimulatedPayouts();
  }

  @Post('affiliate/payouts/:affiliateId/pay')
  payAffiliate(
    @Param('affiliateId') affiliateId: string,
    @Body() body: PayAffiliateDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.admin.payAffiliate(affiliateId, body, user.email);
  }

  @Post('affiliate/commissions/:id/approve')
  approveCommission(@Param('id') id: string) {
    return this.admin.approveCommission(id);
  }

  @Post('affiliate/commissions/mark-paid')
  markPaid(@Body() body: MarkCommissionsPaidDto) {
    return this.admin.markCommissionsPaid(body);
  }

  @Get('users')
  searchUsers(@Query() query: AdminUserSearchQueryDto) {
    return this.admin.searchUsers(query.q, query.plan);
  }

  @Get('users/:id')
  userDetail(@Param('id') id: string) {
    return this.admin.userDetail(id);
  }

  @Post('users/:id/upgrade')
  upgradeUser(@Param('id') id: string, @Body() body: ManualUpgradeDto) {
    return this.admin.upgradeUser(id, body);
  }
}
