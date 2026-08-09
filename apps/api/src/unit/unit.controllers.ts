import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Model } from 'mongoose';
import { CurrentUser, Public } from '../auth/auth.module';
import { PaymentOrchestrationService } from '../payments/payment-orchestration.service';
import { Recaudo } from '../recaudos/recaudos.module';
import { UnitAccountService } from './unit-account.service';
import { UnitCounterpartyService } from './unit-counterparty.service';
import { UnitCustomerService } from './unit-customer.service';

type RequestUser = { userId: string; email: string };
class AddressDto {
  @IsString()
  street!: string;

  @IsOptional()
  @IsString()
  street2?: string;

  @IsString()
  city!: string;

  @IsString()
  state!: string;

  @IsString()
  postalCode!: string;

  @IsString()
  country!: string;
}

class CreateApplicationDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  ssn?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

class CreateCounterpartyDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsOptional()
  @IsString()
  processorToken?: string;

  @IsOptional()
  @IsString()
  routingNumber?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  accountType?: 'Checking' | 'Savings';

  @IsOptional()
  @IsBoolean()
  verifyName?: boolean;
}

class EnsureWalletDto {
  @IsOptional()
  @IsString()
  unitCustomerId?: string;
}

class FundedAmountDto {
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  note?: string;

  @IsOptional()
  @IsString()
  counterpartyId?: string;
}

@ApiTags('unit')
@ApiBearerAuth()
@Controller('unit')
export class UnitController {
  constructor(
    private readonly customers: UnitCustomerService,
    private readonly accounts: UnitAccountService,
    private readonly counterparties: UnitCounterpartyService,
    @InjectModel(Recaudo.name) private readonly recaudos: Model<Recaudo>,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: RequestUser) {
    const identity = await this.customers.getByUserId(user.userId);
    return {
      unitApplicationId: identity?.unitApplicationId,
      unitCustomerId: identity?.unitCustomerId,
      status: identity?.status ?? 'none',
    };
  }

  @Post('applications')
  async createApplication(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: RequestUser,
  ) {
    const identity = await this.customers.createIndividualApplication({
      userId: user.userId,
      email: user.email,
      fullName: dto.fullName ?? user.email.split('@')[0] ?? 'Customer',
      phone: dto.phone,
      ssn: dto.ssn,
      dateOfBirth: dto.dateOfBirth,
      address: dto.address,
    });
    return {
      unitApplicationId: identity?.unitApplicationId,
      unitCustomerId: identity?.unitCustomerId,
      status: identity?.status ?? 'none',
    };
  }

  @Get('recaudos/:recaudoId/wallet')
  async getRecaudoWallet(@Param('recaudoId') recaudoId: string) {
    const recaudo = await this.recaudos.findById(recaudoId);
    if (!recaudo) throw new NotFoundException('Recaudo not found');
    const account = await this.accounts.getByRecaudoId(recaudoId);
    if (!account?.unitWalletId) {
      return { recaudoId, status: 'none' as const };
    }
    return {
      recaudoId,
      workspaceId: account.workspaceId?.toString(),
      unitWalletId: account.unitWalletId,
      unitCustomerId: account.unitCustomerId,
      status: account.status,
      walletTerms: account.walletTerms,
    };
  }

  @Post('recaudos/:recaudoId/wallet')
  async ensureRecaudoWallet(
    @Param('recaudoId') recaudoId: string,
    @Body() dto: EnsureWalletDto,
    @CurrentUser() user: RequestUser,
  ) {
    const recaudo = await this.recaudos.findById(recaudoId);
    if (!recaudo) throw new NotFoundException('Recaudo not found');
    if (recaudo.organizerId.toString() !== user.userId) {
      throw new ForbiddenException(
        'Only the recaudo organizer can open its digital account',
      );
    }
    const identity = await this.customers.getByUserId(user.userId);
    const unitCustomerId =
      identity?.unitCustomerId || dto.unitCustomerId || undefined;
    if (!unitCustomerId || identity?.status !== 'approved') {
      throw new BadRequestException(
        'Complete digital bank onboarding before opening the recaudo account',
      );
    }
    const account = await this.accounts.ensureRecaudoWallet({
      recaudoId,
      workspaceId: recaudo.workspaceId.toString(),
      unitCustomerId,
    });
    return {
      recaudoId: account.recaudoId.toString(),
      workspaceId: account.workspaceId?.toString(),
      unitWalletId: account.unitWalletId,
      unitCustomerId: account.unitCustomerId,
      status: account.status,
      walletTerms: account.walletTerms,
    };
  }

  @Get('counterparties')
  async listCounterparties(@CurrentUser() user: RequestUser) {
    const rows = await this.counterparties.listForUser(user.userId);
    return rows.map((row) => ({
      id: row._id.toString(),
      unitCounterpartyId: row.unitCounterpartyId,
      name: row.name,
      bank: row.bank,
      accountType: row.accountType,
      accountNumberMask: row.accountNumberMask,
      verificationMethod: row.verificationMethod,
      active: row.active,
    }));
  }

  @Post('counterparties')
  async createCounterparty(
    @Body() dto: CreateCounterpartyDto,
    @CurrentUser() user: RequestUser,
  ) {
    const customerId = await this.customers.requireApprovedCustomerId(
      user.userId,
    );
    const row = await this.counterparties.createForUser({
      userId: user.userId,
      unitCustomerId: customerId,
      name: dto.name,
      processorToken: dto.processorToken,
      routingNumber: dto.routingNumber,
      accountNumber: dto.accountNumber,
      accountType: dto.accountType,
      verifyName: dto.verifyName,
    });
    return {
      id: row._id.toString(),
      unitCounterpartyId: row.unitCounterpartyId,
      name: row.name,
      active: row.active,
    };
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly orchestration: PaymentOrchestrationService) {}

  @Post('recaudos/:recaudoId/contributions/funded')
  fundContribution(
    @Param('recaudoId') recaudoId: string,
    @Body() dto: FundedAmountDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.orchestration.fundContribution({
      recaudoId,
      amountMinor: dto.amountMinor,
      note: dto.note,
      counterpartyId: dto.counterpartyId,
      idempotencyKey,
      principal: user,
    });
  }

  @Post('recaudos/:recaudoId/withdrawals/funded')
  fundWithdrawal(
    @Param('recaudoId') recaudoId: string,
    @Body() dto: FundedAmountDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.orchestration.fundWithdrawal({
      recaudoId,
      amountMinor: dto.amountMinor,
      note: dto.note,
      counterpartyId: dto.counterpartyId,
      idempotencyKey,
      principal: user,
    });
  }

  @Get('recaudos/:recaudoId/balances')
  balances(@Param('recaudoId') recaudoId: string) {
    return this.orchestration.balances(recaudoId);
  }

  @Get('intents/:id')
  getIntent(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.orchestration.getIntent(id, user.userId);
  }

  @Post('schedules/recaudos/:recaudoId/me')
  syncSchedule(
    @Param('recaudoId') recaudoId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.orchestration.syncSchedule({
      recaudoId,
      principal: user,
    });
  }

  @Post('reconcile/recaudos/:recaudoId')
  reconcile(@Param('recaudoId') recaudoId: string) {
    return this.orchestration.reconcileRecaudo(recaudoId);
  }
}

@ApiTags('webhooks')
@Controller('webhooks')
export class UnitWebhookController {
  constructor(private readonly orchestration: PaymentOrchestrationService) {}

  @Public()
  @Post('unit')
  async unitWebhook(
    @Req()
    request: {
      rawBody?: Buffer;
      body: unknown;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    const signatureHeader = request.headers['x-unit-signature'];
    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;
    const raw =
      request.rawBody ??
      Buffer.from(
        typeof request.body === 'string'
          ? request.body
          : JSON.stringify(request.body ?? {}),
      );
    this.orchestration.verifyUnitSignature(raw, signature);
    const payload =
      request.body ??
      (raw.length ? (JSON.parse(raw.toString('utf8')) as unknown) : {});
    return this.orchestration.handleUnitWebhook(payload);
  }
}
