import { Test, TestingModule } from '@nestjs/testing';
import { TransformService, ArchetypeScores } from './transform.service';

describe('TransformService', () => {
  let service: TransformService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransformService],
    }).compile();

    service = module.get<TransformService>(TransformService);
  });

  describe('transform', () => {
    const validResponse = {
      id: 'test-123',
      surveyId: 'survey-456',
      dateCreated: '2026-07-20T00:00:00Z',
      dateModified: '2026-07-20T00:00:00Z',
      ipAddress: '1.2.3.4',
      totalTime: 100,
      collectorId: 'col-123',
      responseStatus: 'completed',
      q_288881567: {
        q_2018891726: ['John'],
        q_2018891727: ['Doe'],
      },
      q_288881568: {
        q_2018891735: ['john@example.com'],
      },
      q_288881569: 'Test Org',
      q_288881566: {
        q_2018891718: '1',
        q_2018891719: '2',
        q_2018891720: '3',
        q_2018891724: '4',
      },
    };

    it('should extract contact information correctly', () => {
      const result = service.transform(validResponse);

      expect(result.contact).toEqual({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        organization: 'Test Org',
      });
    });

    it('should return response_id and survey_id from input', () => {
      const result = service.transform(validResponse);

      expect(result.response_id).toBe('test-123');
      expect(result.survey_id).toBe('survey-456');
    });

    it('should create archetype_scores object with all four archetypes', () => {
      const result = service.transform(validResponse);

      expect(result.archetype_scores).toHaveProperty('Sovereign');
      expect(result.archetype_scores).toHaveProperty('Empress');
      expect(result.archetype_scores).toHaveProperty('Consort');
      expect(result.archetype_scores).toHaveProperty('Seductress');
    });

    it('should calculate archetype scores from question rankings', () => {
      const result = service.transform(validResponse);

      expect(result.archetype_scores.Seductress).toBe(1);
      expect(result.archetype_scores.Empress).toBe(2);
      expect(result.archetype_scores.Sovereign).toBe(3);
      expect(result.archetype_scores.Consort).toBe(4);
    });

    it('should include answered questions in responses array', () => {
      const result = service.transform(validResponse);

      expect(result.responses.length).toBeGreaterThan(0);
      expect(result.responses[0].dimension).toBe('Leading');
    });

    it('should include subquestion_id in each answer', () => {
      const result = service.transform(validResponse);
      const firstAnswer = result.responses[0].answers[0];

      expect(firstAnswer).toHaveProperty('subquestion_id');
      expect(firstAnswer.subquestion_id).toMatch(/^q_\d+$/);
    });

    it('should include statement text in each answer', () => {
      const result = service.transform(validResponse);
      const firstAnswer = result.responses[0].answers[0];

      expect(firstAnswer).toHaveProperty('statement');
      expect(typeof firstAnswer.statement).toBe('string');
      expect(firstAnswer.statement.length).toBeGreaterThan(0);
    });

    it('should include archetype classification in each answer', () => {
      const result = service.transform(validResponse);
      const firstAnswer = result.responses[0].answers[0];

      expect(firstAnswer).toHaveProperty('archetype');
      expect(['Sovereign', 'Empress', 'Consort', 'Seductress']).toContain(
        firstAnswer.archetype,
      );
    });

    it('should handle missing contact fields gracefully', () => {
      const incomplete = { ...validResponse };
      delete incomplete.q_288881567;
      delete incomplete.q_288881568;

      const result = service.transform(incomplete);

      expect(result.contact.first_name).toBe('');
      expect(result.contact.last_name).toBe('');
      expect(result.contact.email).toBe('');
    });

    it('should handle missing questions gracefully (scores remain 0)', () => {
      const minimal = {
        id: 'test-minimal',
        surveyId: 'survey-minimal',
        dateCreated: '2026-07-20T00:00:00Z',
        dateModified: '2026-07-20T00:00:00Z',
        ipAddress: '1.2.3.4',
        totalTime: 0,
        collectorId: 'col-minimal',
        responseStatus: 'completed',
        q_288881567: { q_2018891726: ['Test'] },
        q_288881568: { q_2018891735: ['test@test.com'] },
        q_288881569: 'Test',
      };

      const result = service.transform(minimal);

      expect(result.archetype_scores.Sovereign).toBe(0);
      expect(result.archetype_scores.Empress).toBe(0);
      expect(result.archetype_scores.Consort).toBe(0);
      expect(result.archetype_scores.Seductress).toBe(0);
    });

    it('should handle invalid ranking values (non-numeric)', () => {
      const invalidRanking = {
        ...validResponse,
        q_288881566: {
          q_2018891718: 'invalid',
          q_2018891719: '2',
          q_2018891720: '3',
          q_2018891724: '4',
        },
      };

      const result = service.transform(invalidRanking);

      expect(result.responses[0].answers[0].ranking).toBeNull();
    });

    it('should include question dimension in responses', () => {
      const result = service.transform(validResponse);

      expect(result.responses[0]).toHaveProperty('dimension');
      expect(result.responses[0].dimension).toBe('Leading');
    });

    it('should include question_id in responses', () => {
      const result = service.transform(validResponse);

      expect(result.responses[0]).toHaveProperty('question_id');
      expect(result.responses[0].question_id).toMatch(/^\d+$/);
    });
  });
});
