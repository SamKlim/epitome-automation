import * as fs from 'fs';
import {
  EpitomeReportGeneratorService,
  resolveTemplatePath,
} from './epitome-report-generator.service';
import { EpitomeAssessmentService } from './epitome-assessment.service';
import { SupabaseService } from '../db-supabase/supabase.service';
import {
  DimensionScores,
  FIXTURE_ONE,
  SURVEY_FIXTURES,
} from '../../tests/fixtures/e2e-survey-response';

/**
 * These tests exercise the real chart code with no mocking of sharp or pdf-lib.
 * They prove the SVG geometry reflects the scores it was given, which is the
 * property the previous mocked tests could never check.
 */

interface ChartLabel {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

interface ReportGeneratorPrivates {
  transformResponsesToDimensionScores(responses: unknown[]): DimensionScores[];
  generateRadarChartSvg(scores: DimensionScores[]): Promise<{
    png: Buffer;
    canvasWidth: number;
    canvasHeight: number;
    labels: ChartLabel[];
  }>;
  generateRadarChartSvgString(scores: DimensionScores[]): {
    svg: string;
    canvasWidth: number;
    canvasHeight: number;
    labels: ChartLabel[];
  };
}

interface AssessmentPrivates {
  transformResponse(raw: unknown): { responses: unknown[]; archetype_scores: Record<string, number> };
}

const ARCHETYPE_ORDER = ['Sovereign', 'Empress', 'Consort', 'Seductress'] as const;
const MAX_RANKING = 4;
const POSITION_TOLERANCE = 0.01;

interface ParsedRadar {
  centerX: number;
  centerY: number;
  maxRadius: number;
  polygons: Array<Array<{ x: number; y: number }>>;
}

function parseRadarSvg(svg: string): ParsedRadar {
  const rings = [...svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="none"/g)];
  if (rings.length === 0) throw new Error('No grid rings found in SVG');

  const polygons = [...svg.matchAll(/<polygon points="([^"]+)"/g)].map((match) =>
    match[1]
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(',').map(Number);
        return { x, y };
      }),
  );

  return {
    centerX: Number(rings[0][1]),
    centerY: Number(rings[0][2]),
    maxRadius: Math.max(...rings.map((ring) => Number(ring[3]))),
    polygons,
  };
}

function distanceFromCenter(radar: ParsedRadar, point: { x: number; y: number }): number {
  return Math.hypot(point.x - radar.centerX, point.y - radar.centerY);
}

/** Ranking 1 sits on the outer ring, ranking 4 on the innermost. */
function expectedRadius(radar: ParsedRadar, ranking: number): number {
  return (radar.maxRadius / MAX_RANKING) * (MAX_RANKING + 1 - ranking);
}

describe('Radar chart generation', () => {
  let generator: ReportGeneratorPrivates;
  let assessment: AssessmentPrivates;

  beforeAll(() => {
    const supabaseStub = {} as SupabaseService;
    const reportService = new EpitomeReportGeneratorService(supabaseStub);
    generator = reportService as unknown as ReportGeneratorPrivates;
    assessment = new EpitomeAssessmentService(
      supabaseStub,
      reportService,
    ) as unknown as AssessmentPrivates;
  });

  describe.each(SURVEY_FIXTURES)('fixture "$name"', (fixture) => {
    it('produces the expected per-dimension rankings and totals', () => {
      const transformed = assessment.transformResponse(fixture.buildResponse());
      const dimensionScores = generator.transformResponsesToDimensionScores(transformed.responses);

      expect(dimensionScores).toEqual(fixture.expectedDimensionScores);
      expect(transformed.archetype_scores).toEqual(fixture.expectedTotals);
    });

    it('places every chart point at the radius its ranking demands', () => {
      const { svg } = generator.generateRadarChartSvgString(fixture.expectedDimensionScores);
      const radar = parseRadarSvg(svg);

      expect(radar.polygons).toHaveLength(ARCHETYPE_ORDER.length);

      ARCHETYPE_ORDER.forEach((archetype, archetypeIndex) => {
        const polygon = radar.polygons[archetypeIndex];
        expect(polygon).toHaveLength(fixture.expectedDimensionScores.length);

        fixture.expectedDimensionScores.forEach((dimension, dimensionIndex) => {
          const actual = distanceFromCenter(radar, polygon[dimensionIndex]);
          const expected = expectedRadius(radar, dimension[archetype]);
          expect(Math.abs(actual - expected)).toBeLessThan(POSITION_TOLERANCE);
        });
      });
    });

    it('renders a real PNG', async () => {
      const { png } = await generator.generateRadarChartSvg(fixture.expectedDimensionScores);
      expect(png.subarray(0, 4).toString('hex')).toBe('89504e47');
    });
  });

  describe('transformResponsesToDimensionScores', () => {
    it('throws when a dimension is missing an archetype score', () => {
      const missingConsort = [
        {
          dimension: 'Leading',
          answers: [
            { archetype: 'Sovereign', ranking: 1 },
            { archetype: 'Empress', ranking: 2 },
            { archetype: 'Seductress', ranking: 3 },
          ],
        },
      ];

      expect(() => generator.transformResponsesToDimensionScores(missingConsort)).toThrow(
        /Missing score for Consort in dimension "Leading"/,
      );
    });
  });

  describe('generateRadarChartSvgString', () => {
    it('draws ranking 1 on the outer ring and ranking 4 on the inner ring', () => {
      const single: DimensionScores[] = [
        { dimension: 'Only', Sovereign: 1, Empress: 4, Consort: 2, Seductress: 3 },
      ];
      const radar = parseRadarSvg(generator.generateRadarChartSvgString(single).svg);

      const sovereign = distanceFromCenter(radar, radar.polygons[0][0]);
      const empress = distanceFromCenter(radar, radar.polygons[1][0]);

      expect(Math.abs(sovereign - radar.maxRadius)).toBeLessThan(POSITION_TOLERANCE);
      expect(Math.abs(empress - radar.maxRadius / MAX_RANKING)).toBeLessThan(POSITION_TOLERANCE);
    });

    it('returns a positioned label for every dimension', () => {
      const { labels } = generator.generateRadarChartSvgString(
        FIXTURE_ONE.expectedDimensionScores,
      );

      expect(labels.map((label) => label.text)).toEqual(
        FIXTURE_ONE.expectedDimensionScores.map(({ dimension }) => dimension),
      );
      labels.forEach((label) => {
        expect(Number.isFinite(label.x)).toBe(true);
        expect(Number.isFinite(label.y)).toBe(true);
        expect(['start', 'middle', 'end']).toContain(label.anchor);
      });
    });

    /**
     * Regression guard. Sharp rasterises SVG text through librsvg/fontconfig, which
     * has no fonts on Vercel Lambda ("Cannot load default config file") and silently
     * renders every glyph as an empty box. Labels must stay out of the SVG and be
     * drawn by pdf-lib instead, so the image pipeline never needs a font.
     */
    it('puts no text in the SVG, so rendering never depends on a system font', () => {
      const { svg } = generator.generateRadarChartSvgString(
        FIXTURE_ONE.expectedDimensionScores,
      );

      expect(svg).not.toContain('<text');
      expect(svg).not.toContain('font-family');
      FIXTURE_ONE.expectedDimensionScores.forEach(({ dimension }) => {
        expect(svg).not.toContain(dimension);
      });
    });

    it('produces different geometry for different rankings', () => {
      const a = generator.generateRadarChartSvgString([
        { dimension: 'X', Sovereign: 1, Empress: 2, Consort: 3, Seductress: 4 },
      ]);
      const b = generator.generateRadarChartSvgString([
        { dimension: 'X', Sovereign: 4, Empress: 3, Consort: 2, Seductress: 1 },
      ]);
      expect(a.svg).not.toEqual(b.svg);
    });
  });

  describe('resolveTemplatePath', () => {
    it('finds the template next to the source tree', () => {
      expect(resolveTemplatePath()).toMatch(/epitome-assessment-sample\.pdf$/);
      expect(fs.existsSync(resolveTemplatePath())).toBe(true);
    });

    it('throws listing every location tried when the template is missing', () => {
      const nothingExists = () => false;
      expect(() => resolveTemplatePath(nothingExists)).toThrow(
        /Report template epitome-assessment-sample\.pdf not found\. Tried:/,
      );
      expect(() => resolveTemplatePath(nothingExists)).toThrow(/src\/epitome-assessment-sample\.pdf/);
    });
  });

  describe('generateRadarChartSvg', () => {
    it('refuses to render with no scores instead of falling back to defaults', async () => {
      await expect(generator.generateRadarChartSvg([])).rejects.toThrow(
        /no dimension scores provided/,
      );
    });

    it('refuses to render an out-of-range ranking', async () => {
      const bad = [{ dimension: 'X', Sovereign: 5, Empress: 3, Consort: 2, Seductress: 1 }] as never;
      await expect(generator.generateRadarChartSvg(bad)).rejects.toThrow(/must be 1-4/);
    });
  });
});
