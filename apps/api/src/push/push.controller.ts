import { Body, Controller, Delete, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthPrincipal } from '../auth/auth.module';
import { RegisterPushTokenDto, UnregisterPushTokenDto } from './push.dto';
import { PushService } from './push.service';

@ApiTags('devices')
@ApiBearerAuth()
@Controller('devices')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('push-token')
  register(
    @Body() body: RegisterPushTokenDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.push.registerToken(user.userId, body);
  }

  @Delete('push-token')
  unregister(
    @Body() body: UnregisterPushTokenDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.push.unregisterToken(user.userId, body.token);
  }
}
