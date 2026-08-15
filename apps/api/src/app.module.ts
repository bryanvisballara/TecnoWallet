import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from './admin/admin.module';
import { AssistantModule } from './assistant/assistant.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { AuthModule } from './auth/auth.module';
import { BankModule } from './bank/bank.module';
import { BillingModule } from './billing/billing.module';
import { BridgeModule } from './bridge/bridge.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { validateEnvironment } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MercadoPagoModule } from './payments/mercadopago.module';
import { PaymentsModule } from './payments/payments.module';
import { PlatformModule } from './platform/platform.module';
import { PushModule } from './push/push.module';
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
    AdminModule,
    BillingModule,
    AffiliateModule,
    CollaborationModule,
    PlatformModule,
    AssistantModule,
    BankModule,
    BridgeModule,
    RecaudosModule,
    MercadoPagoModule,
    PaymentsModule,
    MailModule,
    PushModule,
    HealthModule,
  ],
})
export class AppModule {}
