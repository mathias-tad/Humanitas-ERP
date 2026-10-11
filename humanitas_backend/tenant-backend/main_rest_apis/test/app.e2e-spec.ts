import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { HealthModule } from '../src/modules/health/health.module';

describe('HealthController (E2E Test)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('verifies /health returns 200 OK with service identifier', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(res.body).toBeDefined();
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('tenant-api');
    expect(res.body.timestamp).toBeDefined();
  });
});
