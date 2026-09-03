import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { describe } from 'node:test';

describe('Survey Submission E2E', () => {
  let app: INestApplication;
  const validToken = process.env.EPITOME_AUTOMATION_SECRET || 'test-token';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/assessments/responses', () => {
    const validTestData = {
      id: String(Date.now()),
      surveyId: 'e2e-survey-123',
      dateCreated: new Date().toISOString(),
      ipAddress: '127.0.0.1',
      totalTime: 300,
      collectorId: 'e2e-test',
      responseStatus: 'Complete',
      q_288881567: {
        q_2018891726: 'E2E',
        q_2018891727: 'Test',
      },
      q_288881568: {
        q_2018891735: 'e2e@test.com',
      },
      q_288881569: 'Test Org',
      // Q1: Leading - S=4, E=1, So=2, C=3 (Empress wins)
      q_288881566: {
        q_2018891718: '1', // Seductress
        q_2018891719: '4', // Empress (winner)
        q_2018891720: '2', // Sovereign
        q_2018891724: '3', // Consort
      },
      // Q2: Trust - So=2, E=1, S=4, C=3 (Empress wins)
      q_288881570: {
        q_2018891746: '2', // Sovereign
        q_2018891747: '4', // Empress (winner)
        q_2018891748: '1', // Seductress
        q_2018891822: '3', // Consort
      },
      // Q3: Constraints - So=1, C=4, E=2, S=3 (Sovereign wins)
      q_288881571: {
        q_2018891753: '4', // Sovereign (winner)
        q_2018891823: '2', // Consort
        q_2018891754: '1', // Empress
        q_2018891755: '3', // Seductress
      },
      // Q4: Inspiration - So=2, E=1, S=4, C=3 (Empress wins)
      q_288881572: {
        q_2018891762: '1', // Seductress
        q_2018891761: '4', // Empress (winner)
        q_2018891824: '2', // Sovereign
        q_2018891760: '3', // Consort
      },
      // Q5: Managing Challenges - S=4, C=3, So=1, E=2 (Sovereign wins)
      q_288881573: {
        q_2018891825: '1', // Seductress
        q_2018891767: '2', // Empress
        q_2018891768: '4', // Sovereign (winner)
        q_2018891769: '3', // Consort
      },
      // Q6: Others View Me - E=2, So=1, S=4, C=3 (Sovereign wins)
      q_288881574: {
        q_2018891774: '1', // Seductress
        q_2018891775: '2', // Empress
        q_2018891827: '4', // Sovereign (winner)
        q_2018891826: '3', // Consort
      },
      // Q7: Striving - S=4, E=1, So=2, C=3 (Empress wins)
      q_288881575: {
        q_2018891828: '1', // Seductress
        q_2018891780: '4', // Empress (winner)
        q_2018891781: '2', // Sovereign
        q_2018891782: '3', // Consort
      },
      // Q8: Working With Peers - So=2, C=3, S=1, E=4 (Seductress wins)
      q_288881576: {
        q_2018891829: '1', // Seductress
        q_2018891789: '4', // Empress
        q_2018891830: '2', // Sovereign
        q_2018891790: '3', // Consort
      },
      // Q9: At Your Worst - E=1, C=4, S=2, So=3 (Empress wins)
      q_288881577: {
        q_2018891797: '2', // Seductress
        q_2018891799: '4', // Empress (winner)
        q_2018891798: '3', // Sovereign
        q_2018891831: '1', // Consort
      },
      // Q10: Confidence - S=4, E=1, So=2, C=3 (Empress wins)
      q_288881578: {
        q_2018891833: '1', // Seductress
        q_2018891806: '4', // Empress (winner)
        q_2018891832: '2', // Sovereign
        q_2018891807: '3', // Consort
      },
      // Q11: Power - C=1, So=3, E=2, S=4 (Consort wins)
      q_288881654: {
        q_2018892275: '4', // Seductress
        q_2018892273: '2', // Empress
        q_2018892276: '1', // Sovereign
        q_2018892274: '3', // Consort (winner)
      },
      // Q12: Ambition - S=4, So=1, E=2, C=3 (Sovereign wins)
      q_288881876: {
        q_2018893545: '1', // Seductress
        q_2018893542: '4', // Empress
        q_2018893544: '2', // Sovereign
        q_2018893543: '3', // Consort
      },
    };

    it('should successfully process a complete survey submission', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validTestData)
        .expect(HttpStatus.CREATED);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('response_id', validTestData.id);
      expect(response.body).toHaveProperty('archetype_scores');
      expect(response.body).toHaveProperty('archetype_label');
      expect(response.body).toHaveProperty('timing');
    });

    it('should return archetype scores', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validTestData)
        .expect(HttpStatus.CREATED);

      const { archetype_scores } = response.body;
      expect(archetype_scores).toHaveProperty('Sovereign');
      expect(archetype_scores).toHaveProperty('Empress');
      expect(archetype_scores).toHaveProperty('Consort');
      expect(archetype_scores).toHaveProperty('Seductress');

      // All scores should be numbers greater than 0
      Object.values(archetype_scores).forEach((score) => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(0);
      });
    });

    it('should return archetype label', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validTestData)
        .expect(HttpStatus.CREATED);

      expect(response.body.archetype_label).toBeTruthy();
      expect(typeof response.body.archetype_label).toBe('string');
    });

    it('should include timing information', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validTestData)
        .expect(HttpStatus.CREATED);

      const { timing } = response.body;
      expect(timing).toHaveProperty('database');
      expect(timing).toHaveProperty('pdf');
      expect(timing).toHaveProperty('total');

      // All timings should be non-negative numbers
      Object.values(timing).forEach((time) => {
        expect(typeof time).toBe('number');
        expect(time).toBeGreaterThanOrEqual(0);
      });
    });

    it('should reject request without authorization', async () => {
      await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .send(validTestData)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject request with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', 'Bearer invalid-token')
        .send(validTestData)
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should reject malformed request body', async () => {
      await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ invalid: 'data' })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should reject request without required id field', async () => {
      const incompleteData = { ...validTestData };
      delete incompleteData.id;

      await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(incompleteData)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should handle missing optional fields gracefully', async () => {
      const minimalData = {
        id: String(Date.now() + 1),
        surveyId: 'minimal-survey',
        q_288881566: { q_2018891718: '1', q_2018891719: '4', q_2018891720: '2', q_2018891724: '3' },
        q_288881570: { q_2018891746: '2', q_2018891747: '4', q_2018891748: '1', q_2018891822: '3' },
        q_288881571: { q_2018891753: '4', q_2018891823: '2', q_2018891754: '1', q_2018891755: '3' },
        q_288881572: { q_2018891762: '1', q_2018891761: '4', q_2018891824: '2', q_2018891760: '3' },
        q_288881573: { q_2018891825: '1', q_2018891767: '2', q_2018891768: '4', q_2018891769: '3' },
        q_288881574: { q_2018891774: '1', q_2018891775: '2', q_2018891827: '4', q_2018891826: '3' },
        q_288881575: { q_2018891828: '1', q_2018891780: '4', q_2018891781: '2', q_2018891782: '3' },
        q_288881576: { q_2018891829: '1', q_2018891789: '4', q_2018891830: '2', q_2018891790: '3' },
        q_288881577: { q_2018891797: '2', q_2018891799: '4', q_2018891798: '3', q_2018891831: '1' },
        q_288881578: { q_2018891833: '1', q_2018891806: '4', q_2018891832: '2', q_2018891807: '3' },
        q_288881654: { q_2018892275: '4', q_2018892273: '2', q_2018892276: '1', q_2018892274: '3' },
        q_288881876: { q_2018893545: '1', q_2018893542: '4', q_2018893544: '2', q_2018893543: '3' },
      };

      const response = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(minimalData)
        .expect(HttpStatus.CREATED);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/assessments/health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/assessments/health')
        .expect(HttpStatus.OK);

      expect(response.body).toHaveProperty('status');
    });
  });
});
function beforeAll(arg0: () => Promise<void>) {
  throw new Error('Function not implemented.');
}

function afterAll(arg0: () => Promise<void>) {
  throw new Error('Function not implemented.');
}

