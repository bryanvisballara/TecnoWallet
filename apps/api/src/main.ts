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
  // Disable Nest's default JSON parser so we can register a single parser that
  // keeps rawBody for Unit webhook HMAC (X-Unit-Signature) + JsonAPI payloads.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: new ConsoleLogger({ json: true }), bodyParser: false },
  );
  const fastify = app.getHttpAdapter().getInstance();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (fastify as any).addContentTypeParser(
    ['application/json', 'application/vnd.api+json'],
    { parseAs: 'buffer' },
    (
      request: { rawBody?: Buffer },
      body: Buffer,
      done: (err: Error | null, body?: unknown) => void,
    ) => {
      const raw = Buffer.isBuffer(body) ? body : Buffer.from(String(body ?? ''));
      request.rawBody = raw;
      if (!raw.length) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(raw.toString('utf8')) as unknown);
      } catch (error) {
        done(error as Error, undefined);
      }
    },
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
    // Fastify CORS defaults to GET,HEAD,POST only — browsers then block PATCH/DELETE.
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'Accept',
      'X-Request-Id',
      'Idempotency-Key',
    ],
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

void bootstrap().catch((error: unknown) => {
  // Ensure production entrypoints (and require()-based starters) surface boot errors.
  console.error(error);
  process.exit(1);
});
