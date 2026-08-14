import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { commissionEventStatuses } from '../affiliate/affiliate.schemas';

export class AdminPayoutsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(commissionEventStatuses)
  status?: (typeof commissionEventStatuses)[number];
}

export class PayAffiliateDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  proofName?: string;

  /** Raw base64 (no data: prefix). */
  @IsOptional()
  @IsString()
  @MaxLength(2_500_000)
  proofBase64?: string;
}

export class MarkCommissionsPaidDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  affiliateId?: string;

  @IsOptional()
  @IsMongoId({ each: true })
  ids?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(280)
  note?: string;
}

export class ManualUpgradeDto {
  @IsIn(['free', 'plus', 'business'])
  plan!: 'free' | 'plus' | 'business';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;
}

export class AdminUserSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @IsOptional()
  @IsIn(['all', 'free', 'plus', 'business'])
  plan?: 'all' | 'free' | 'plus' | 'business';
}
