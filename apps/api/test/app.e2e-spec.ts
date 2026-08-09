/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createServer } from 'node:net';
import request from 'supertest';
import { App } from 'supertest/types';

jest.setTimeout(60_000);

async function availablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not reserve an ephemeral MongoDB test port'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

describe('health and auth (e2e)', () => {
  let app: INestApplication<App>;
  let mongo: MongoMemoryServer;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({
      instance: { port: await availablePort(), ip: '127.0.0.1' },
    });
    process.env.MONGODB_URI = mongo.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters';
    process.env.JWT_REFRESH_SECRET =
      'test-refresh-secret-at-least-32-characters';
    process.env.BREVO_API_KEY = '';
    process.env.RECAUDO_INVITE_BASE_URL = 'http://localhost:8081/invite';
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

  it('enforces Recaudo roles, invitations, plans, and idempotent contributions', async () => {
    const organizer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'organizer@example.com',
        password: 'strong-password',
        name: 'Organizer',
      })
      .expect(201);
    const member = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'member@example.com',
        password: 'strong-password',
        name: 'Member',
      })
      .expect(201);
    const organizerAuth = {
      Authorization: `Bearer ${organizer.body.accessToken}`,
    };
    const memberAuth = { Authorization: `Bearer ${member.body.accessToken}` };

    const workspace = await request(app.getHttpServer())
      .post('/api/v1/workspaces')
      .set(organizerAuth)
      .send({
        name: 'Recaudos E2E',
        type: 'personal',
        baseCurrency: 'COP',
      })
      .expect(201);
    const workspaceId = workspace.body._id;

    const created = await request(app.getHttpServer())
      .post('/api/v1/recaudos')
      .set(organizerAuth)
      .send({
        workspaceId,
        title: 'Viaje compartido',
        category: 'travel',
        targetMinor: 1_000_000,
        monthlyTargetMinor: 200_000,
        currency: 'COP',
      })
      .expect(201);
    const recaudoId = created.body.id;

    const firstContribution = await request(app.getHttpServer())
      .post(`/api/v1/recaudos/${recaudoId}/contributions`)
      .set(organizerAuth)
      .set('Idempotency-Key', 'organizer-first-contribution')
      .send({ amountMinor: 100_000, note: 'Primer aporte' })
      .expect(201);
    expect(firstContribution.body.idempotentReplay).toBe(false);

    const replay = await request(app.getHttpServer())
      .post(`/api/v1/recaudos/${recaudoId}/contributions`)
      .set(organizerAuth)
      .set('Idempotency-Key', 'organizer-first-contribution')
      .send({ amountMinor: 100_000, note: 'Primer aporte' })
      .expect(201);
    expect(replay.body.idempotentReplay).toBe(true);
    expect(replay.body.collectedMinor).toBe(100_000);

    const invited = await request(app.getHttpServer())
      .post(`/api/v1/recaudos/${recaudoId}/invites`)
      .set(organizerAuth)
      .send({ email: 'member@example.com' })
      .expect(201);
    const inviteToken = new URL(String(invited.body.previewLink)).pathname
      .split('/')
      .at(-1);
    expect(inviteToken).toEqual(expect.any(String));

    await request(app.getHttpServer())
      .post('/api/v1/recaudos/invites/accept')
      .set(memberAuth)
      .send({ token: inviteToken })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/recaudos/${recaudoId}`)
      .set(memberAuth)
      .send({ title: 'Cambio no permitido' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/recaudos/${recaudoId}/participants/me/plan`)
      .set(memberAuth)
      .send({
        amountMinor: 50_000,
        frequency: 'biweekly',
        paymentMode: 'card_simulated',
        remindersEnabled: true,
        reminderTime: '08:30',
        reminderDaysBefore: [0, 1],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.plan.simulatedCard.last4).toMatch(/^\d{4}$/);
      });

    await request(app.getHttpServer())
      .post(`/api/v1/recaudos/${recaudoId}/contributions`)
      .set(memberAuth)
      .set('Idempotency-Key', 'member-first-contribution')
      .send({ amountMinor: 50_000 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/recaudos/${recaudoId}`)
      .set(memberAuth)
      .expect(200)
      .expect(({ body }) => {
        expect(body.currentRole).toBe('member');
        expect(body.collectedMinor).toBe(150_000);
        expect(body.progressPercent).toBe(15);
        expect(body.participants).toHaveLength(2);
        expect(body.contributions).toHaveLength(2);
      });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongo) await mongo.stop();
  });
});
