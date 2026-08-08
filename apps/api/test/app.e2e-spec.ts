/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { App } from 'supertest/types';

jest.setTimeout(60_000);

describe('health and auth (e2e)', () => {
  let app: INestApplication<App>;
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET =
      'test-refresh-secret-at-least-32-characters';
    const { AppModule } = require('./../src/app.module');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('reports database health', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => expect(body.status).toBe('ok'));
  });

  it('registers and logs in a user', async () => {
    const credentials = {
      email: 'wallet@example.com',
      password: 'strong-password',
      name: 'Wallet User',
    };
    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(credentials)
      .expect(201);
    expect(registered.body.accessToken).toEqual(expect.any(String));

    const loggedIn = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: credentials.email, password: credentials.password })
      .expect(201);
    expect(loggedIn.body.refreshToken).toEqual(expect.any(String));
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
  });
});
