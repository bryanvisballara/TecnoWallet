import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../auth/auth.module';
import {
  AdminPayoutsQueryDto,
  AdminUserSearchQueryDto,
  ManualUpgradeDto,
  MarkCommissionsPaidDto,
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
    return this.admin.searchUsers(query.q);
  }

  @Post('users/:id/upgrade')
  upgradeUser(@Param('id') id: string, @Body() body: ManualUpgradeDto) {
    return this.admin.upgradeUser(id, body);
  }
}
