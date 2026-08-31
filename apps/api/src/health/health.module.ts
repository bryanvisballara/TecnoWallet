import {
  Controller,
  Get,
  Module,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { Public } from '../auth/auth.module';

@ApiTags('health')
@Controller('health')
class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  check() {
    if (Number(this.connection.readyState) !== 1) {
      throw new ServiceUnavailableException({
        status: 'unhealthy',
        databaseReadyState: this.connection.readyState,
      });
    }
    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
      affiliateFlatBountyUsd: 5,
    };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
