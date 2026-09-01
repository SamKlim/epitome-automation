import { Test, TestingModule } from '@nestjs/testing';
import { ArchetypeLabelService } from './archetype-label.service';

describe('ArchetypeLabelService', () => {
  let service: ArchetypeLabelService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ArchetypeLabelService],
    }).compile();

    service = module.get<ArchetypeLabelService>(ArchetypeLabelService);
  });

  describe('getLeadingLabel', () => {
    it('should return single archetype when there is a clear leader', () => {
      const scores = { Sovereign: 30, Empress: 23, Consort: 33, Seductress: 34 };
      const result = service.getLeadingLabel(scores);
      expect(result).toBe('Empress');
    });

    it('should return multiple archetypes when within 2 points', () => {
      const scores = { Sovereign: 20, Empress: 20, Consort: 35, Seductress: 45 };
      const result = service.getLeadingLabel(scores);
      expect(result).toBe('Sovereign and Empress');
    });

    it('should include second archetype within 2 points but exclude others', () => {
      const scores = { Sovereign: 24, Empress: 22, Consort: 40, Seductress: 33 };
      const result = service.getLeadingLabel(scores);
      expect(result).toBe('Empress and Sovereign');
    });

    it('should handle three archetypes within 2 points', () => {
      const scores = { Sovereign: 20, Empress: 21, Consort: 22, Seductress: 45 };
      const result = service.getLeadingLabel(scores);
      expect(result).toBe('Sovereign and Empress and Consort');
    });

    it('should handle all four equal scores', () => {
      const scores = { Sovereign: 25, Empress: 25, Consort: 25, Seductress: 25 };
      const result = service.getLeadingLabel(scores);
      expect(result).toBe('Sovereign and Empress and Consort and Seductress');
    });

    it('should return Empress and Consort for Sam test data', () => {
      const scores = { Sovereign: 35, Empress: 26, Consort: 27, Seductress: 32 };
      const result = service.getLeadingLabel(scores);
      expect(result).toBe('Empress and Consort');
    });
  });
});
