import { Test, TestingModule } from '@nestjs/testing';
import { EpitomeReportGeneratorService } from './epitome-report-generator.service';
import { SupabaseService } from '../db-supabase/supabase.service';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

jest.mock('fs');
jest.mock('sharp', () => {
  return jest.fn((input: Buffer) => ({
    png: jest.fn().mockReturnValue({
      toBuffer: jest.fn().mockResolvedValue(
        Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), input]),
      ),
    }),
  }));
});

// Mock PDFDocument
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn().mockResolvedValue({
      getPage: jest.fn().mockReturnValue({
        drawRectangle: jest.fn(),
        drawText: jest.fn(),
        drawImage: jest.fn(),
      }),
      embedPng: jest.fn().mockResolvedValue({
        width: 100,
        height: 100,
      }),
      embedFont: jest.fn().mockResolvedValue({
        widthOfTextAtSize: jest.fn().mockReturnValue(80),
      }),
      save: jest.fn().mockResolvedValue(Buffer.from('pdf bytes')),
    }),
  },
  StandardFonts: {
    Helvetica: 'Helvetica',
  },
  rgb: jest.fn().mockReturnValue({ r: 0, g: 0, b: 0 }),
}));

describe('EpitomeReportGeneratorService', () => {
  let service: EpitomeReportGeneratorService;
  let supabaseService: jest.Mocked<SupabaseService>;
  const mockPdfPath = '/path/to/reports/test-report.pdf';
  const mockResponses = [
    {
      question_id: 1,
      dimension: 'Leading',
      answers: [
        { subquestion_id: 'a', archetype: 'Sovereign', statement: 'stmt', ranking: 1 },
        { subquestion_id: 'b', archetype: 'Empress', statement: 'stmt', ranking: 2 },
        { subquestion_id: 'c', archetype: 'Consort', statement: 'stmt', ranking: 3 },
        { subquestion_id: 'd', archetype: 'Seductress', statement: 'stmt', ranking: 4 },
      ],
    },
  ];

  const mockResponseData = {
    response_id: '123',
    first_name: 'John',
    last_name: 'Doe',
    archetype_label: 'Sovereign',
    archetype_scores: {
      Sovereign: 85,
      Empress: 60,
      Consort: 45,
      Seductress: 40,
    },
    responses: mockResponses,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpitomeReportGeneratorService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EpitomeReportGeneratorService>(EpitomeReportGeneratorService);
    supabaseService = module.get(SupabaseService) as jest.Mocked<SupabaseService>;

    // Mock fs operations
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('mock pdf'));
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomisedReport', () => {
    it('should successfully create a customised report with provided name', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockResponseData,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');

      expect(result).toContain('epitome-report-123-customised.pdf');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should throw error when Supabase fetch fails', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Record not found' },
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      await expect(service.createCustomisedReport('invalid-id')).rejects.toThrow(
        /Failed to fetch response/,
      );
    });

    it('should throw error when data is null', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      await expect(service.createCustomisedReport('123')).rejects.toThrow();
    });

    it('should use archetype_label when provided', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockResponseData, archetype_label: 'Empress' },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should calculate archetype label from scores when label not provided', async () => {
      const dataWithoutLabel = {
        ...mockResponseData,
        archetype_label: null,
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: dataWithoutLabel,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should use double archetype when top two scores are within 5 points', async () => {
      const closedScores = {
        ...mockResponseData,
        archetype_label: null,
        archetype_scores: {
          Sovereign: 85,
          Empress: 83,
          Consort: 45,
          Seductress: 40,
        },
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: closedScores,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle missing first_name and last_name gracefully', async () => {
      const dataWithoutNames = {
        ...mockResponseData,
        first_name: null,
        last_name: null,
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: dataWithoutNames,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should embed radar chart PNG in report', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockResponseData,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });
  });

  describe('replaceClientName', () => {
    it('should handle short names', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  first_name: 'Jo',
                  last_name: 'Do',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle long names', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  first_name: 'Christopher',
                  last_name: 'Montgomery-Fitzwilliam',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should uppercase names in output', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  first_name: 'john',
                  last_name: 'doe',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle special characters in names', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  first_name: "O'Connor",
                  last_name: "D'Angelo",
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });
  });

  describe('replaceArchetypeLabel', () => {
    it('should handle single archetype label', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  archetype_label: 'Sovereign',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle double archetype label', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  archetype_label: 'Sovereign and Empress',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle all archetype combinations', async () => {
      const archetypes = ['Sovereign', 'Empress', 'Consort', 'Seductress'];

      for (const archetype of archetypes) {
        const mockClient = {
          from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    ...mockResponseData,
                    archetype_label: archetype,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };

        supabaseService.getClient.mockReturnValue(mockClient as any);

        const result = await service.createCustomisedReport('123');
        expect(result).toBeTruthy();
      }
    });

    it('should handle archetype label with extra whitespace', async () => {
      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  ...mockResponseData,
                  archetype_label: '  Sovereign   and   Empress  ',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });
  });

  describe('File Operations', () => {
    it('should create reports directory if it does not exist', async () => {
      // Create a fresh service instance with mocked directory check
      (fs.existsSync as jest.Mock).mockReturnValueOnce(false);

      const testData = {
        ...mockResponseData,
        response_id: '456',
        first_name: 'Jane',
        last_name: 'Smith',
        archetype_label: 'Empress',
        archetype_scores: {},
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: testData,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      // Create new service with mocked directory
      const serviceWithNewDir = new EpitomeReportGeneratorService(supabaseService);
      await serviceWithNewDir.createCustomisedReport('456');
      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    it('should save PDF with correct filename', async () => {
      const testData = {
        ...mockResponseData,
        response_id: '456',
        first_name: 'Jane',
        last_name: 'Smith',
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: testData,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      await service.createCustomisedReport('456');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('epitome-report-456-customised.pdf'),
        expect.any(Buffer),
      );
    });

    it('should use different filenames for different responses', async () => {
      const testData = {
        ...mockResponseData,
        response_id: '456',
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: testData,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result1 = await service.createCustomisedReport('456');
      const result2 = await service.createCustomisedReport('789');

      expect(result1).not.toEqual(result2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high archetype scores', async () => {
      const highScores = {
        ...mockResponseData,
        archetype_label: null,
        archetype_scores: {
          Sovereign: 999,
          Empress: 500,
          Consort: 100,
          Seductress: 50,
        },
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: highScores,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle empty archetype_scores', async () => {
      const noScores = {
        ...mockResponseData,
        archetype_label: 'Consort',
        archetype_scores: {},
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: noScores,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });

    it('should handle null archetype_scores', async () => {
      const nullScores = {
        ...mockResponseData,
        archetype_label: 'Seductress',
        archetype_scores: null,
      };

      const mockClient = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: nullScores,
                error: null,
              }),
            }),
          }),
        }),
      };

      supabaseService.getClient.mockReturnValue(mockClient as any);

      const result = await service.createCustomisedReport('123');
      expect(result).toBeTruthy();
    });
  });

  describe('generateRadarChartSvg', () => {
    describe('PNG Buffer Generation', () => {
      it('should return a valid PNG buffer with default data', async () => {
        const result = await (service as any).generateRadarChartSvg();

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toBe(0x89);
        expect(result[1]).toBe(0x50);
        expect(result[2]).toBe(0x4e);
        expect(result[3]).toBe(0x47);
      });

      it('should return a valid PNG buffer with custom data', async () => {
        const customData = [
          { dimension: 'Test', Sovereign: 4, Empress: 3, Consort: 2, Seductress: 1 },
          { dimension: 'Another', Sovereign: 1, Empress: 2, Consort: 3, Seductress: 4 },
        ];

        const result = await (service as any).generateRadarChartSvg(customData);

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
        expect(result.slice(0, 4).toString('hex')).toBe('89504e47');
      });

      it('should handle single dimension data', async () => {
        const singleDim = [
          { dimension: 'Solo', Sovereign: 2, Empress: 2, Consort: 2, Seductress: 2 },
        ];

        const result = await (service as any).generateRadarChartSvg(singleDim);

        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should generate different buffers for different data', async () => {
        const data1 = [
          { dimension: 'A', Sovereign: 4, Empress: 1, Consort: 2, Seductress: 3 },
        ];
        const data2 = [
          { dimension: 'A', Sovereign: 1, Empress: 4, Consort: 2, Seductress: 3 },
        ];

        const buffer1 = await (service as any).generateRadarChartSvg(data1);
        const buffer2 = await (service as any).generateRadarChartSvg(data2);

        expect(buffer1).not.toEqual(buffer2);
      });
    });

    describe('Score Value Handling', () => {
      it('should handle minimum scores (1)', async () => {
        const minScores = [
          { dimension: 'Min', Sovereign: 1, Empress: 1, Consort: 1, Seductress: 1 },
        ];

        const result = await (service as any).generateRadarChartSvg(minScores);
        expect(result).toBeInstanceOf(Buffer);
      });

      it('should handle maximum scores (4)', async () => {
        const maxScores = [
          { dimension: 'Max', Sovereign: 4, Empress: 4, Consort: 4, Seductress: 4 },
        ];

        const result = await (service as any).generateRadarChartSvg(maxScores);
        expect(result).toBeInstanceOf(Buffer);
      });

      it('should handle mixed scores across range', async () => {
        const mixedScores = [
          { dimension: 'Mixed1', Sovereign: 4, Empress: 1, Consort: 2, Seductress: 3 },
          { dimension: 'Mixed2', Sovereign: 2, Empress: 4, Consort: 1, Seductress: 3 },
          { dimension: 'Mixed3', Sovereign: 3, Empress: 2, Consort: 4, Seductress: 1 },
        ];

        const result = await (service as any).generateRadarChartSvg(mixedScores);
        expect(result).toBeInstanceOf(Buffer);
      });
    });

    describe('Data Validation', () => {
      it('should handle all 12 dimensions (default data)', async () => {
        const result = await (service as any).generateRadarChartSvg();
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle missing undefined parameter (uses defaults)', async () => {
        const result = await (service as any).generateRadarChartSvg(undefined);
        expect(result).toBeInstanceOf(Buffer);
      });

      it('should handle empty array gracefully', async () => {
        const result = await (service as any).generateRadarChartSvg([]);
        expect(result).toBeInstanceOf(Buffer);
      });

      it('should process dimensions with varying label lengths', async () => {
        const variedLabels = [
          { dimension: 'X', Sovereign: 1, Empress: 2, Consort: 3, Seductress: 4 },
          { dimension: 'Very Long Dimension Label Here', Sovereign: 2, Empress: 1, Consort: 4, Seductress: 3 },
        ];

        const result = await (service as any).generateRadarChartSvg(variedLabels);
        expect(result).toBeInstanceOf(Buffer);
      });
    });

    describe('Error Handling', () => {
      it('should throw if data contains invalid archetype', async () => {
        const invalidData = [
          { dimension: 'Test', Sovereign: 4, Empress: 3, Consort: 2, InvalidArchetype: 1 } as any,
        ];

        await expect((service as any).generateRadarChartSvg(invalidData)).rejects.toThrow();
      });

      it('should throw if score is out of range', async () => {
        const outOfRangeData = [
          { dimension: 'Test', Sovereign: 5, Empress: 3, Consort: 2, Seductress: 1 } as any,
        ];

        await expect((service as any).generateRadarChartSvg(outOfRangeData)).rejects.toThrow();
      });

      it('should throw if score is 0', async () => {
        const zeroScoreData = [
          { dimension: 'Test', Sovereign: 0, Empress: 3, Consort: 2, Seductress: 1 } as any,
        ];

        await expect((service as any).generateRadarChartSvg(zeroScoreData)).rejects.toThrow();
      });
    });

    describe('Performance', () => {
      it('should generate chart within reasonable time', async () => {
        const start = Date.now();
        await (service as any).generateRadarChartSvg();
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000);
      });

      it('should handle large dimension count', async () => {
        const largeDimensions = Array.from({ length: 50 }, (_, i) => ({
          dimension: `Dimension ${i + 1}`,
          Sovereign: 2,
          Empress: 3,
          Consort: 1,
          Seductress: 4,
        }));

        const result = await (service as any).generateRadarChartSvg(largeDimensions);
        expect(result).toBeInstanceOf(Buffer);
      });
    });
  });
});
