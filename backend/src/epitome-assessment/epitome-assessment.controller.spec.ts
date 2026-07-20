import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { EpitomeAssessmentController } from './epitome-assessment.controller';
import { EpitomeAssessmentService } from './epitome-assessment.service';
import { TransformService } from './transform.service';
import { SupabaseService } from '../db/supabase.service';

describe('EpitomeAssessmentController', () => {
  let controller: EpitomeAssessmentController;
  let service: EpitomeAssessmentService;
  let mockSupabaseService: Partial<SupabaseService>;

  const validResponse = {
    id: 'test-response-123',
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
    q_288881570: {
      q_2018891746: '1',
      q_2018891747: '2',
      q_2018891748: '3',
      q_2018891822: '4',
    },
    q_288881571: {
      q_2018891753: '1',
      q_2018891823: '2',
      q_2018891754: '3',
      q_2018891755: '4',
    },
    q_288881572: {
      q_2018891760: '1',
      q_2018891824: '2',
      q_2018891761: '3',
      q_2018891762: '4',
    },
    q_288881573: {
      q_2018891767: '1',
      q_2018891768: '2',
      q_2018891769: '3',
      q_2018891825: '4',
    },
    q_288881574: {
      q_2018891826: '1',
      q_2018891774: '2',
      q_2018891827: '3',
      q_2018891775: '4',
    },
    q_288881575: {
      q_2018891780: '1',
      q_2018891782: '2',
      q_2018891781: '3',
      q_2018891828: '4',
    },
    q_288881576: {
      q_2018891789: '1',
      q_2018891829: '2',
      q_2018891830: '3',
      q_2018891790: '4',
    },
    q_288881577: {
      q_2018891797: '1',
      q_2018891799: '2',
      q_2018891798: '3',
      q_2018891831: '4',
    },
    q_288881578: {
      q_2018891833: '1',
      q_2018891806: '2',
      q_2018891832: '3',
      q_2018891807: '4',
    },
    q_288881654: {
      q_2018892275: '1',
      q_2018892273: '2',
      q_2018892276: '3',
      q_2018892274: '4',
    },
    q_288881876: {
      q_2018893544: '1',
      q_2018893542: '2',
      q_2018893545: '3',
      q_2018893543: '4',
    },
  };

  beforeEach(async () => {
    mockSupabaseService = {
      insertSurveyResponse: jest
        .fn()
        .mockResolvedValue([{ response_id: 'test-response-123' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EpitomeAssessmentController],
      providers: [
        EpitomeAssessmentService,
        TransformService,
        {
          provide: SupabaseService,
          useValue: mockSupabaseService,
        },
      ],
    }).compile();

    controller = module.get<EpitomeAssessmentController>(
      EpitomeAssessmentController,
    );
    service = module.get<EpitomeAssessmentService>(EpitomeAssessmentService);
  });

  describe('POST /api/assessments/responses', () => {
    it('should return 200 with success message for valid response', async () => {
      const result = await controller.submitResponse(validResponse);

      expect(result.success).toBe(true);
      expect(result.response_id).toBe('test-response-123');
      expect(result.message).toContain('successfully');
    });

    it('should return archetype_scores in response', async () => {
      const result = await controller.submitResponse(validResponse);

      expect(result.archetype_scores).toBeDefined();
      expect(result.archetype_scores).toHaveProperty('Sovereign');
      expect(result.archetype_scores).toHaveProperty('Empress');
      expect(result.archetype_scores).toHaveProperty('Consort');
      expect(result.archetype_scores).toHaveProperty('Seductress');
    });

    it('should call supabaseService.insertSurveyResponse', async () => {
      await controller.submitResponse(validResponse);

      expect(mockSupabaseService.insertSurveyResponse).toHaveBeenCalled();
    });

    it('should throw 400 error when request body is null', async () => {
      try {
        await controller.submitResponse(null);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      }
    });

    it('should throw 400 error when request body is not an object', async () => {
      try {
        await controller.submitResponse('invalid');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.message).toContain('Expected JSON object');
      }
    });

    it('should throw 400 error when id is missing', async () => {
      const missing = { ...validResponse };
      delete missing.id;

      try {
        await controller.submitResponse(missing);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.message).toContain('id');
      }
    });

    it('should throw 400 error when surveyId is missing', async () => {
      const missing = { ...validResponse };
      delete missing.surveyId;

      try {
        await controller.submitResponse(missing);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(error.message).toContain('surveyId');
      }
    });

    it('should handle database errors with 500 response', async () => {
      mockSupabaseService.insertSurveyResponse = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      try {
        await controller.submitResponse(validResponse);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(error.message).toContain('Database connection failed');
      }
    });

    it('should accept minimal valid response (only id and surveyId)', async () => {
      const minimal = {
        id: 'minimal-123',
        surveyId: 'minimal-survey',
        dateCreated: '2026-07-20T00:00:00Z',
        dateModified: '2026-07-20T00:00:00Z',
        ipAddress: '1.2.3.4',
        totalTime: 0,
        collectorId: 'col',
        responseStatus: 'completed',
        q_288881567: { q_2018891726: ['Test'] },
        q_288881568: { q_2018891735: ['test@test.com'] },
        q_288881569: 'Test',
      };

      const result = await controller.submitResponse(minimal);

      expect(result.success).toBe(true);
      expect(result.response_id).toBe('minimal-123');
    });
  });

  describe('POST /api/assessments/health', () => {
    it('should return health status', () => {
      const result = controller.health();

      expect(result.status).toBe('ok');
      expect(result.message).toContain('running');
    });
  });
});
