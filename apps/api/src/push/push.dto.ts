import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { pushPlatforms } from './push.schemas';

export class RegisterPushTokenDto {
  @IsString()
  @Length(8, 512)
  token!: string;

  @IsIn(pushPlatforms)
  platform!: (typeof pushPlatforms)[number];
}

export class UnregisterPushTokenDto {
  @IsOptional()
  @IsString()
  @Length(8, 512)
  token?: string;
}
