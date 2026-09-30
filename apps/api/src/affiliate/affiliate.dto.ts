import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  AFFILIATE_PAYOUT_TYPES,
  AFFILIATE_USDT_NETWORKS,
  type AffiliatePayoutType,
  type AffiliateUsdtNetwork,
} from './affiliate.schemas';

const normalizeCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class AffiliateCodeDto {
  @Transform(normalizeCode)
  @IsString()
  @Length(2, 40)
  @Matches(/^[A-Z0-9_-]+$/)
  code!: string;
}

export class RecordAffiliateClickDto extends AffiliateCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  branchClickId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  campaign?: string;
}

export class ClaimAffiliateDto extends AffiliateCodeDto {
  @IsOptional()
  @IsUUID()
  clickId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  branchClickId?: string;
}

export class EnrollAffiliateDto {
  @IsOptional()
  @Transform(normalizeCode)
  @IsString()
  @Length(3, 24)
  @Matches(/^[A-Z0-9_-]+$/)
  code?: string;
}

export class CouponLeadDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(160)
  email!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/)
  country!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(2, 8)
  locale!: string;

  @Transform(normalizeCode)
  @IsString()
  @Length(2, 40)
  @Matches(/^[A-Z0-9_-]+$/)
  code!: string;
}

export class UpdateAffiliatePayoutDto {
  @IsEnum(AFFILIATE_PAYOUT_TYPES)
  type!: AffiliatePayoutType;

  @IsEnum(AFFILIATE_USDT_NETWORKS)
  network!: AffiliateUsdtNetwork;

  @IsString()
  @Length(20, 128)
  address!: string;
}
