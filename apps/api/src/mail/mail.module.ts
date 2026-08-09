import { Body, Controller, Module, Post } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { AuthModule, CurrentUser } from '../auth/auth.module';
import type { AuthPrincipal } from '../auth/auth.module';
import { BrevoMailer } from './brevo';
import {
  inviteEmailHtml,
  inviteEmailSubject,
  type InviteKind,
} from './invite-email';

class SendInviteEmailDto {
  @IsEnum(['recaudo', 'workspace', 'calendar'])
  kind!: InviteKind;

  @IsEmail()
  to!: string;

  @IsString()
  @Length(1, 120)
  resourceName!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  acceptLink?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  inviterName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  roleLabel?: string;
}

@ApiTags('mail')
@ApiBearerAuth()
@Controller('mail')
class MailController {
  constructor(
    private readonly mailer: BrevoMailer,
    private readonly config: ConfigService,
  ) {}

  @Post('invites')
  async sendInvite(
    @Body() dto: SendInviteEmailDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const appBase = (
      this.config.get<string>('APP_PUBLIC_URL') ||
      this.config.get<string>('RECAUDO_INVITE_BASE_URL') ||
      'https://tecnowallet.app'
    )
      .replace(/\/invite\/?$/, '')
      .replace(/\/+$/, '');
    const acceptLink =
      dto.acceptLink?.trim() ||
      (dto.kind === 'calendar'
        ? `${appBase}/calendars`
        : dto.kind === 'workspace'
          ? `${appBase}/`
          : `${appBase}/recaudos`);

    const payload = {
      kind: dto.kind,
      resourceName: dto.resourceName,
      acceptLink,
      inviterName: dto.inviterName?.trim() || user.email.split('@')[0],
      roleLabel: dto.roleLabel,
    };
    const delivery = await this.mailer.sendHtml({
      to: dto.to.trim().toLowerCase(),
      subject: inviteEmailSubject(payload),
      htmlContent: inviteEmailHtml(payload),
    });
    return { delivered: delivery.delivered, kind: dto.kind };
  }
}

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MailController],
  providers: [BrevoMailer],
  exports: [BrevoMailer],
})
export class MailModule {}
