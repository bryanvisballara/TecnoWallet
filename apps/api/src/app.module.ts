import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PaymentsModule } from './payments/payments.module';
import { PlatformModule } from './platform/platform.module';
import { RecaudosModule } from './recaudos/recaudos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
        autoIndex: config.get('NODE_ENV') !== 'production',
        serverSelectionTimeoutMS: 10_000,
      }),
    }),
    AuthModule,
    PlatformModule,
    RecaudosModule,
    PaymentsModule,
    HealthModule,
  ],
})
export class AppModule {}
