import { ConsoleLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { AppModule } from './app.module';

export async function bootstrap(): Promise<void> {
  const adapter = new FastifyAdapter({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    requestIdHeader: 'x-request-id',
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: new ConsoleLogger({ json: true }) },
  );
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: config
      .get<string>('CORS_ORIGINS', '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });
  // Nest and plugins can resolve separate Fastify type copies in workspaces.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await app.register(helmet as any, { contentSecurityPolicy: false });
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  await app.register(rateLimit as any, {
    max: config.get<number>('RATE_LIMIT_MAX', 100),
    timeWindow: '1 minute',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('TecnoWallet API')
    .setDescription('Workspace-scoped personal finance API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

if (require.main === module) {
  void bootstrap();
}
