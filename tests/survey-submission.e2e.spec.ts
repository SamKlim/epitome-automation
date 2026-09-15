import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SurveyResponseDTO } from '../src/epitome-assessment/response.dto';
import { FIXTURE_ONE, SURVEY_FIXTURES } from './fixtures/e2e-survey-response';

/**
 * Hits the real endpoint with real Supabase and Gmail. Each fixture stores a
 * row, generates a PDF and emails it, so expect one email per fixture.
 */

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

  describe.each(SURVEY_FIXTURES)('POST /api/assessments/responses — fixture "$name"', (fixture) => {
    let apiResponse: request.Response;
    let submitted: SurveyResponseDTO;

    beforeAll(async () => {
      submitted = fixture.buildResponse();
      apiResponse = await request(app.getHttpServer())
        .post('/api/assessments/responses')
        .set('Authorization', `Bearer ${validToken}`)
        .send(submitted)
        .expect(HttpStatus.CREATED);
    });

    it('should successfully process the submission', () => {
      expect(apiResponse.body).toHaveProperty('success', true);
      expect(apiResponse.body).toHaveProperty('response_id', submitted.id);
    });

    it('should calculate the archetype totals from the submitted rankings', () => {
      expect(apiResponse.body.archetype_scores).toEqual(fixture.expectedTotals);
    });

    it('should label the lowest-scoring archetypes as leading', () => {
      expect(apiResponse.body.archetype_label).toBe(fixture.expectedLabel);
    });

    it('should have handed the report to Gmail', () => {
      expect(apiResponse.body.email_sent).toBe(true);
    });
  });

  describe('POST /api/assessments/responses — rejections', () => {
    const validTestData = FIXTURE_ONE.buildResponse();

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
      const incompleteData: Partial<SurveyResponseDTO> = { ...validTestData };
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
