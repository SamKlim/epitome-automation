import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PDFDocument, PDFDict, PDFName, PDFStream } from 'pdf-lib';
import { EpitomeReportGeneratorService } from '../src/epitome-assessment/epitome-report-generator.service';
import { EpitomeAssessmentService } from '../src/epitome-assessment/epitome-assessment.service';
import { SupabaseService } from '../src/db-supabase/supabase.service';
import { SURVEY_FIXTURES } from './fixtures/e2e-survey-response';

/**
 * Raw survey DTO → transformed row → customised PDF, with real sharp and pdf-lib.
 * Only Supabase is stubbed (it returns the row the assessment service produced).
 * No email is sent.
 */

const TEMPLATE_PATH = path.resolve(__dirname, '../src/epitome-assessment-sample.pdf');
const REPORT_PAGE_INDEX = 7;

interface AssessmentPrivates {
  transformResponse(raw: unknown): Record<string, unknown>;
}

function stubSupabaseReturning(row: Record<string, unknown>): SupabaseService {
  const single = async () => ({ data: row, error: null });
  const client = { from: () => ({ select: () => ({ eq: () => ({ single }) }) }) };
  return { getClient: () => client } as unknown as SupabaseService;
}

function countImagesOnPage(doc: PDFDocument, pageIndex: number): number {
  const resources = doc.getPage(pageIndex).node.Resources();
  const xobjects = resources?.lookup(PDFName.of('XObject'));
  if (!(xobjects instanceof PDFDict)) return 0;

  // Image XObjects are streams; their metadata lives on the stream's dict.
  return xobjects.entries().filter(([, ref]) => {
    const obj = doc.context.lookup(ref);
    return obj instanceof PDFStream && obj.dict.get(PDFName.of('Subtype')) === PDFName.of('Image');
  }).length;
}

describe.each(SURVEY_FIXTURES)('Report generation for fixture "$name"', (fixture) => {
  let reportPath: string;
  let chartSpy: jest.SpyInstance;
  let labelSpy: jest.SpyInstance;

  beforeAll(async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'epitome-report-test-'));

    const placeholderSupabase = {} as SupabaseService;
    const transformer = new EpitomeAssessmentService(
      placeholderSupabase,
      new EpitomeReportGeneratorService(placeholderSupabase),
    ) as unknown as AssessmentPrivates;
    const row = transformer.transformResponse(fixture.buildResponse());

    const generator = new EpitomeReportGeneratorService(stubSupabaseReturning(row));
    (generator as unknown as { reportsDir: string }).reportsDir = outputDir;

    const prototype = Object.getPrototypeOf(generator);
    chartSpy = jest.spyOn(prototype, 'generateRadarChartSvgString');
    labelSpy = jest.spyOn(prototype, 'replaceArchetypeLabel');

    reportPath = await generator.createCustomisedReport(String(row.response_id));
  });

  afterAll(() => {
    chartSpy.mockRestore();
    labelSpy.mockRestore();
  });

  it('feeds the chart the rankings from the submitted answers, not defaults', () => {
    expect(chartSpy).toHaveBeenCalledTimes(1);
    expect(chartSpy).toHaveBeenCalledWith(fixture.expectedDimensionScores);
  });

  it('labels the report with the lowest-scoring archetypes', () => {
    expect(labelSpy).toHaveBeenCalledTimes(1);
    expect(labelSpy.mock.calls[0][1]).toBe(fixture.expectedLabel);
  });

  it('writes a PDF with one more image on page 8 than the template', async () => {
    const template = await PDFDocument.load(fs.readFileSync(TEMPLATE_PATH));
    const generated = await PDFDocument.load(fs.readFileSync(reportPath));

    expect(generated.getPageCount()).toBe(template.getPageCount());
    expect(countImagesOnPage(generated, REPORT_PAGE_INDEX)).toBe(
      countImagesOnPage(template, REPORT_PAGE_INDEX) + 1,
    );
  });
});
