import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString, Length, MaxLength } from 'class-validator';
import { CurrentUser, type AuthPrincipal } from '../auth/auth.module';
import { EntitlementService } from '../billing/entitlement.service';
import { AssistantService } from './assistant.service';

class AskDto {
  @IsString()
  @Length(1, 64)
  workspaceId!: string;

  @IsString()
  @MaxLength(500)
  message!: string;
}

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly entitlements: EntitlementService,
  ) {}

  @Post('ask')
  async ask(@Body() body: AskDto, @CurrentUser() user: AuthPrincipal) {
    await this.entitlements.assertPlus(user.userId, {
      feature: 'AI_REQUIRED',
    });
    return this.assistant.ask({
      workspaceId: body.workspaceId,
      userId: user.userId,
      message: body.message,
    });
  }
}
