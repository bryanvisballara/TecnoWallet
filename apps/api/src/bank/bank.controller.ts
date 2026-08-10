import { Body, Controller, Get, Logger, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser, Public, type AuthPrincipal } from '../auth/auth.module';
import { BankService } from './bank.service';

class WorkspaceQueryDto {
  @IsString()
  workspaceId!: string;
}

class RegisterLinkDto {
  @IsString()
  workspaceId!: string;

  @IsString()
  @Length(8, 80)
  belvoLinkId!: string;

  @IsOptional()
  @IsString()
  institutionName?: string;

  @IsOptional()
  @IsString()
  institutionCode?: string;
}

class ConfirmPendingDto {
  @IsString()
  accountId!: string;

  @IsString()
  clearingAccountId!: string;
}

@ApiTags('bank')
@ApiBearerAuth()
@Controller('bank')
export class BankController {
  constructor(private readonly bank: BankService) {}

  @Get('status')
  status() {
    return this.bank.status();
  }

  @Post('belvo/widget-token')
  widgetToken(
    @Body() body: WorkspaceQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.createWidgetToken(body.workspaceId, user.userId);
  }

  @Post('belvo/links')
  registerLink(
    @Body() body: RegisterLinkDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.registerLink({
      workspaceId: body.workspaceId,
      userId: user.userId,
      belvoLinkId: body.belvoLinkId,
      institutionName: body.institutionName,
      institutionCode: body.institutionCode,
    });
  }

  @Get('connections')
  listConnections(
    @Query() query: WorkspaceQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.listConnections(query.workspaceId, user.userId);
  }

  @Post('sync')
  sync(
    @Body() body: WorkspaceQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.syncWorkspace(body.workspaceId, user.userId);
  }

  @Get('pending')
  listPending(
    @Query() query: WorkspaceQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.listPending(query.workspaceId, user.userId);
  }

  @Post('pending/:id/dismiss')
  dismiss(
    @Param('id') id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.dismissPending(id, user.userId);
  }

  @Post('pending/:id/confirm')
  confirm(
    @Param('id') id: string,
    @Body() body: ConfirmPendingDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.bank.confirmPending({
      id,
      userId: user.userId,
      accountId: body.accountId,
      clearingAccountId: body.clearingAccountId,
    });
  }
}

type BelvoWebhookBody = {
  webhook_id?: string;
  webhook_type?: string;
  webhook_code?: string;
  process_type?: string;
  link_id?: string;
  request_id?: string;
  data?: Record<string, unknown>;
};

@ApiTags('webhooks')
@Controller('webhooks')
export class BelvoWebhookController {
  private readonly logger = new Logger(BelvoWebhookController.name);

  constructor(private readonly bank: BankService) {}

  /**
   * Belvo dashboard → Webhooks URL (sandbox/production):
   * https://tecnowallet.onrender.com/api/v1/webhooks/belvo
   */
  @Public()
  @Post('belvo')
  async belvo(@Body() body: BelvoWebhookBody) {
    const linkId = body.link_id?.trim();
    const type = (body.webhook_type || '').toUpperCase();
    const code = (body.webhook_code || '').toLowerCase();
    this.logger.log(
      `Belvo webhook ${type}/${code} link=${linkId || '—'} id=${body.webhook_id || '—'}`,
    );

    if (!linkId) {
      return { received: true, synced: false };
    }

    const shouldSync =
      type === 'TRANSACTIONS' ||
      type === 'ACCOUNTS' ||
      code.includes('transaction') ||
      code === 'historical_update' ||
      code === 'new_transactions_available';

    if (!shouldSync) {
      return { received: true, synced: false };
    }

    const result = await this.bank.syncByBelvoLinkId(linkId);
    return { received: true, synced: result.matched, ...result };
  }
}
