import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

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
