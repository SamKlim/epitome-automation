import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SurveyResponseDTO } from '../src/epitome-assessment/response.dto';

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
    let apiResponse: any;

    const validTestData: SurveyResponseDTO = {
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
        q_2018891735: 'samanthaklimovski@gmail.com',
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

    beforeAll(async () => {
      apiResponse = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validTestData)
        .expect(HttpStatus.CREATED);
    });

    it('should successfully process survey submission with all required fields', () => {
      expect(apiResponse.body).toHaveProperty('success', true);
      expect(apiResponse.body).toHaveProperty('response_id', validTestData.id);
      expect(apiResponse.body).toHaveProperty('archetype_scores');
      expect(apiResponse.body).toHaveProperty('archetype_label');
    });

    it('should calculate valid archetype scores', () => {
      const { archetype_scores } = apiResponse.body;
      expect(archetype_scores).toHaveProperty('Sovereign');
      expect(archetype_scores).toHaveProperty('Empress');
      expect(archetype_scores).toHaveProperty('Consort');
      expect(archetype_scores).toHaveProperty('Seductress');

      Object.values(archetype_scores).forEach((score) => {
        expect(typeof score).toBe('number');
        expect(score).toBeGreaterThan(0);
      });
    });

    it('should return archetype label', () => {
      expect(apiResponse.body.archetype_label).toBeTruthy();
      expect(typeof apiResponse.body.archetype_label).toBe('string');
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

