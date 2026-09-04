import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { SupabaseService } from '../db-supabase/supabase.service';
import { getArchetypeLabel } from './archetype-label';

/** Rankings run 1 ("fully describes me") to 4 ("does not describe me at all"). */
const MAX_RANKING = 4;

const TEMPLATE_FILENAME = 'epitome-assessment-sample.pdf';

/** Bottom-left quadrant of page 8 that the radar chart is drawn into. */
const CHART_BOX_WIDTH = 590;
const CHART_BOX_HEIGHT = 450;

/** Dimension label size in radar-chart canvas units; scaled down when drawn into the PDF. */
const RADAR_LABEL_FONT_SIZE = 26;

/**
 * Half of Helvetica's cap height (0.717em), used to convert a vertical *centre*
 * into a pdf-lib text baseline. SVG's dominant-baseline="middle" centres the
 * glyph box; pdf-lib positions from the baseline, so labels sit too high without this.
 */
const LABEL_BASELINE_OFFSET_RATIO = 0.36;

/**
 * A dimension label in radar-chart canvas coordinates (origin top-left, y down).
 * Labels are deliberately NOT drawn into the SVG: Sharp rasterises SVG text via
 * librsvg/fontconfig, which has no fonts on Vercel Lambda and silently renders
 * every glyph as .notdef (an empty box). Drawing them with pdf-lib's built-in
 * Helvetica instead keeps the image pipeline entirely font-free.
 */
interface RadarChartLabel {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

interface RadarChart {
  png: Buffer;
  canvasWidth: number;
  canvasHeight: number;
  labels: RadarChartLabel[];
}

/**
 * Where the template PDF can live, depending on how the code is being run:
 * - `src/` when running under ts-jest, or `dist/src/` after `nest build` copies assets
 * - the source tree sitting next to `dist/` on a deployment that keeps sources (Vercel)
 */
function templateCandidates(): string[] {
  return [
    path.resolve(__dirname, '..', TEMPLATE_FILENAME),
    path.resolve(__dirname, '../../../src', TEMPLATE_FILENAME),
  ];
}

export function resolveTemplatePath(exists: (file: string) => boolean = fs.existsSync): string {
  const candidates = templateCandidates();
  const found = candidates.find((candidate) => exists(candidate));
  if (!found) {
    throw new Error(
      `Report template ${TEMPLATE_FILENAME} not found. Tried:\n  ${candidates.join('\n  ')}`,
    );
  }
  return found;
}

@Injectable()
export class EpitomeReportGeneratorService {
  private templatePath: string | undefined;
  private reportsDir = '/tmp/reports';

  constructor(private supabaseService: SupabaseService) {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /** Resolved on first use, not at construction, so a missing template fails the request with a clear message. */
  private getTemplatePath(): string {
    if (!this.templatePath) {
      this.templatePath = resolveTemplatePath();
    }
    return this.templatePath;
  }

  async createCustomisedReport(responseId: string): Promise<string> {
    // Fetch survey response data from Supabase
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .eq('response_id', responseId)
      .single();

    if (error || !data) {
      throw new Error(`Failed to fetch response ${responseId} from Supabase: ${error?.message}`);
    }

    const firstName = data.first_name || 'Unknown';
    const lastName = data.last_name || 'Unknown';

    // Transform responses array into dimension scores for radar chart
    const dimensionScores = this.transformResponsesToDimensionScores(data.responses);
    console.log(`📊 Transformed ${dimensionScores.length} dimension scores for radar chart`);

    // archetype_label is not stored in Supabase; it is always derived from the scores
    const archetypeLabel = getArchetypeLabel(data.archetype_scores);

    console.log(`✅ Fetched data from Supabase for ${responseId}:`, {
      firstName: data.first_name,
      lastName: data.last_name,
      archetypeLabel,
      responseId: data.response_id,
    });

    // Load template PDF
    const pdfBuffer = fs.readFileSync(this.getTemplatePath());
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Page 1: Replace client name
    const page1 = pdfDoc.getPage(0);
    await this.replaceClientName(page1, firstName, lastName, pdfDoc);

    // Page 8: Replace archetype label
    const page8 = pdfDoc.getPage(7);
    await this.replaceArchetypeLabel(page8, archetypeLabel, pdfDoc);

    // Page 8: Embed radar chart
    await this.embedRadarChartOnPage(page8, pdfDoc, dimensionScores);

    // Save the customized PDF
    const fileName = `epitome-report-${responseId}-customised.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);

    console.log(`✅ Customised report saved: ${filePath}`);
    return filePath;
  }


  private transformResponsesToDimensionScores(
    responses: any[],
  ): Array<{ dimension: string; Sovereign: 1 | 2 | 3 | 4; Empress: 1 | 2 | 3 | 4; Consort: 1 | 2 | 3 | 4; Seductress: 1 | 2 | 3 | 4 }> {
    return responses.map((response) => {
      const scores: Record<string, number> = {
        Sovereign: 0,
        Empress: 0,
        Consort: 0,
        Seductress: 0,
      };

      response.answers.forEach((answer: any) => {
        if (answer.archetype && answer.ranking !== null) {
          scores[answer.archetype] = answer.ranking;
        }
      });

      const archetypes = ['Sovereign', 'Empress', 'Consort', 'Seductress'] as const;
      for (const archetype of archetypes) {
        if (!scores[archetype]) {
          throw new Error(
            `Missing score for ${archetype} in dimension "${response.dimension}". Response data is incomplete.`,
          );
        }
      }

      return {
        dimension: response.dimension,
        Sovereign: scores.Sovereign as 1 | 2 | 3 | 4,
        Empress: scores.Empress as 1 | 2 | 3 | 4,
        Consort: scores.Consort as 1 | 2 | 3 | 4,
        Seductress: scores.Seductress as 1 | 2 | 3 | 4,
      };
    });
  }

  private async replaceArchetypeLabel(
    page: PDFPage,
    archetypeLabel: string,
    pdfDoc: PDFDocument,
  ): Promise<void> {
    // LOGIC: Replace archetype text on page 8 with proper covering box and overlay text
    // The original text "You tend to lead with the EMPRESS." must be completely covered

    // Step 1: Parse archetype label to determine single or double archetype
    // Format: "Empress" or "Empress and Consort"
    const archetypes = archetypeLabel.split(' and ');
    const isSingleArchetype = archetypes.length === 1;

    // Step 2: Embed font (Helvetica for overlay text)
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const textColor = rgb(0, 0, 0);

    // Step 3: Define text positioning (coordinates from template analysis)
    // "You tend to lead with the EMPRESS." is located at:
    const textX = 42.5; // Left aligned
    const line1Y = 616.3; // Original text Y position (shifted down 8px from 608.3)
    const line2Y = 600.3; // Second line (shifted down 8px from 592.3, with 16px line height)
    const textLineHeight = 16;

    // Step 4: Draw COVERING BOX to hide original text
    // Box must cover all possible text variations
    let coverBoxTop: number;
    let coverBoxBottom: number;
    let coverBoxHeight: number;

    if (isSingleArchetype) {
      // Single archetype: cover just one line
      coverBoxTop = line1Y;
      coverBoxBottom = line1Y + textLineHeight;
      coverBoxHeight = textLineHeight;
    } else {
      // Double archetype: cover both lines
      coverBoxTop = line2Y;
      coverBoxBottom = line1Y + textLineHeight;
      coverBoxHeight = coverBoxBottom - coverBoxTop;
    }

    // Make covering box from x=0 to x=260 only
    const coverBoxLeft = textX - 2;
    const coverBoxRight = 260; // Only cover up to 260px from left edge

    const whiteColor = rgb(1, 1, 1); // White background to match page
    page.drawRectangle({
      x: coverBoxLeft,
      y: coverBoxTop,
      width: coverBoxRight - coverBoxLeft,
      height: coverBoxHeight,
      color: whiteColor,
    });

    // Step 5: Draw replacement text (left-aligned)
    if (isSingleArchetype) {
      // SINGLE ARCHETYPE: One line
      // Format: "You tend to lead with the EMPRESS."
      const text = `You tend to lead with the ${archetypeLabel.toUpperCase()}.`;
      page.drawText(text, {
        x: textX,
        y: line1Y,
        size: fontSize,
        font,
        color: textColor,
      });
    } else {
      // DOUBLE ARCHETYPE: Two lines
      // Format:
      // Line 1: "You tend to lead with the EMPRESS"
      // Line 2: "AND the CONSORT."
      const firstArchetype = archetypes[0].trim().toUpperCase();
      const secondArchetype = archetypes[1].trim().toUpperCase();

      const line1Text = `You tend to lead with the ${firstArchetype}`;
      const line2Text = `AND the ${secondArchetype}.`;

      page.drawText(line1Text, {
        x: textX,
        y: line1Y,
        size: fontSize,
        font,
        color: textColor,
      });

      page.drawText(line2Text, {
        x: textX,
        y: line2Y,
        size: fontSize,
        font,
        color: textColor,
      });
    }
  }

  private async embedRadarChartOnPage(
    page: PDFPage,
    pdfDoc: PDFDocument,
    dimensionScores: Array<{
      dimension: string;
      Sovereign: 1 | 2 | 3 | 4;
      Empress: 1 | 2 | 3 | 4;
      Consort: 1 | 2 | 3 | 4;
      Seductress: 1 | 2 | 3 | 4;
    }>,
  ): Promise<void> {
    // Draw white rectangle background (bottom-left quadrant)
    page.drawRectangle({
      x: 0,
      y: 0,
      width: CHART_BOX_WIDTH,
      height: CHART_BOX_HEIGHT,
      color: rgb(1, 1, 1),
    });

    const chart = await this.generateRadarChartSvg(dimensionScores);
    const radarImage = await pdfDoc.embedPng(chart.png);

    // Scale using the chart's true aspect ratio. Assuming a ratio would both distort
    // the image and, because labels are positioned against it, misplace every label.
    const aspectRatio = chart.canvasWidth / chart.canvasHeight;
    let scaledWidth = CHART_BOX_WIDTH;
    let scaledHeight = CHART_BOX_WIDTH / aspectRatio;

    if (scaledHeight > CHART_BOX_HEIGHT) {
      scaledHeight = CHART_BOX_HEIGHT;
      scaledWidth = CHART_BOX_HEIGHT * aspectRatio;
    }

    // Center chart both horizontally and vertically
    const chartX = (CHART_BOX_WIDTH - scaledWidth) / 2;
    const chartY = (CHART_BOX_HEIGHT - scaledHeight) / 2;

    page.drawImage(radarImage, {
      x: chartX,
      y: chartY,
      width: scaledWidth,
      height: scaledHeight,
    });

    await this.drawRadarChartLabels(page, pdfDoc, chart, {
      chartX,
      chartY,
      scaledWidth,
      scaledHeight,
    });

    console.log(
      `📊 Radar chart embedded: ${scaledWidth.toFixed(0)}×${scaledHeight.toFixed(0)} with ${chart.labels.length} labels`,
    );
  }

  /**
   * Draws the dimension labels as real PDF text on top of the chart image.
   *
   * Chart canvas coordinates have their origin top-left with y increasing downward;
   * PDF user space has its origin bottom-left with y increasing upward, so y is flipped.
   */
  private async drawRadarChartLabels(
    page: PDFPage,
    pdfDoc: PDFDocument,
    chart: RadarChart,
    placement: { chartX: number; chartY: number; scaledWidth: number; scaledHeight: number },
  ): Promise<void> {
    const { chartX, chartY, scaledWidth, scaledHeight } = placement;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const scaleX = scaledWidth / chart.canvasWidth;
    const scaleY = scaledHeight / chart.canvasHeight;
    const fontSize = RADAR_LABEL_FONT_SIZE * scaleY;

    chart.labels.forEach((label) => {
      const anchorX = chartX + label.x * scaleX;
      const centreY = chartY + scaledHeight - label.y * scaleY;

      // pdf-lib always draws rightward from x, so emulate SVG's text-anchor here.
      const textWidth = font.widthOfTextAtSize(label.text, fontSize);
      let x = anchorX;
      if (label.anchor === 'middle') {
        x = anchorX - textWidth / 2;
      } else if (label.anchor === 'end') {
        x = anchorX - textWidth;
      }

      page.drawText(label.text, {
        x,
        y: centreY - fontSize * LABEL_BASELINE_OFFSET_RATIO,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });
  }

  private async replaceClientName(
    page: PDFPage,
    firstName: string,
    lastName: string,
    pdfDoc: PDFDocument,
  ): Promise<void> {
    // LOGIC: Replace client name on page 1 with background box and centered text
    // This is a generic function that works with any name length

    // Step 1: Embed Helvetica font for the name
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 15.74; // Matches original template font size
    const nameText = `${firstName.toUpperCase()} ${lastName.toUpperCase()}`;

    // Step 2: Define cream box color (#F8F5EC) - matches page background
    const boxColor = rgb(248 / 255, 245 / 255, 236 / 255);

    // Step 3: Draw ORIGINAL BOX (fixed position, always covers SALLY-ANN SAMPLE)
    // This box remains constant regardless of the name entered
    const originalBoxLeft = 214.2; // 231.2 - 1 - 2 (with 2px padding)
    const originalBoxRight = 396.1; // 379.0 + 1 + 2 (with 2px padding)
    const originalBoxTop = 66;
    const originalBoxBottom = 88;
    page.drawRectangle({
      x: originalBoxLeft,
      y: originalBoxTop,
      width: originalBoxRight - originalBoxLeft,
      height: originalBoxBottom - originalBoxTop,
      color: boxColor,
    });

    // Step 4: Calculate NAME BOX dimensions (generic for any name)
    // Center point is fixed at (305.1, 77.5) per design spec
    const centerX = 305.1;
    const centerY = 77.5;
    const textY = 72; // Baseline Y position (Helvetica-specific)

    // Calculate actual text width using font metrics (more accurate than char count)
    const textWidth = font.widthOfTextAtSize(nameText, fontSize);

    // Position text so it's horizontally centered at centerX
    const textStartX = centerX - textWidth / 2;

    // Step 5: Create NAME BOX with 2px padding on all sides
    // Box expands/shrinks based on name length while staying centered
    const padding = 2;
    const nameBoxLeft = textStartX - 1 - padding; // -3 from text start
    const nameBoxRight = textStartX + textWidth + 1 + padding; // +3
    const nameBoxTop = 66; // Same as original (top of page box area)
    const nameBoxBottom = 88; // Same as original (bottom of page box area)

    page.drawRectangle({
      x: nameBoxLeft,
      y: nameBoxTop,
      width: nameBoxRight - nameBoxLeft,
      height: nameBoxBottom - nameBoxTop,
      color: boxColor,
    });

    // Step 6: Draw the centered name text on top of the box
    page.drawText(nameText, {
      x: textStartX,
      y: textY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0), // Black text
    });
  }

  private async generateRadarChartSvg(
    scoresByArchetype: Array<{
      dimension: string;
      Sovereign: 1 | 2 | 3 | 4;
      Empress: 1 | 2 | 3 | 4;
      Consort: 1 | 2 | 3 | 4;
      Seductress: 1 | 2 | 3 | 4;
    }>,
  ): Promise<RadarChart> {
    if (!scoresByArchetype || scoresByArchetype.length === 0) {
      throw new Error('Cannot generate radar chart: no dimension scores provided. Response data may be malformed.');
    }

    this.validateScoreData(scoresByArchetype);
    console.log(`📊 Radar chart generated with real data (${scoresByArchetype.length} dimensions)`);
    const { svg, canvasWidth, canvasHeight, labels } =
      this.generateRadarChartSvgString(scoresByArchetype);

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return { png, canvasWidth, canvasHeight, labels };
  }

  private validateScoreData(
    data: Array<{
      dimension: string;
      Sovereign: 1 | 2 | 3 | 4;
      Empress: 1 | 2 | 3 | 4;
      Consort: 1 | 2 | 3 | 4;
      Seductress: 1 | 2 | 3 | 4;
    }>,
  ): void {
    if (!Array.isArray(data)) {
      throw new Error('Data must be an array of DimensionScores');
    }

    data.forEach((item, index) => {
      if (!item.dimension || typeof item.dimension !== 'string') {
        throw new Error(`Item ${index}: dimension must be a non-empty string`);
      }

      const validArchetypes = ['Sovereign', 'Empress', 'Consort', 'Seductress'] as const;
      validArchetypes.forEach((archetype) => {
        const score = item[archetype as keyof typeof item] as number;
        if (score === undefined || score === null) {
          throw new Error(`Item ${index} (${item.dimension}): missing score for ${archetype}`);
        }
        if (![1, 2, 3, 4].includes(score as 1 | 2 | 3 | 4)) {
          throw new Error(
            `Item ${index} (${item.dimension}): ${archetype} score must be 1-4, got ${score}`,
          );
        }
      });
    });
  }

  private generateRadarChartSvgString(
    data: Array<{
      dimension: string;
      Sovereign: 1 | 2 | 3 | 4;
      Empress: 1 | 2 | 3 | 4;
      Consort: 1 | 2 | 3 | 4;
      Seductress: 1 | 2 | 3 | 4;
    }>,
  ): { svg: string; canvasWidth: number; canvasHeight: number; labels: RadarChartLabel[] } {
    const ARCHETYPES = ['Sovereign', 'Empress', 'Consort', 'Seductress'];
    const COLORS = {
      Sovereign: '#0B6889',
      Empress: '#603393',
      Consort: '#E7BF20',
      Seductress: '#C12026',
    };

    const numDimensions = data.length;
    const maxRadius = 380;
    const labelDistance = maxRadius + 55;
    const angleSlice = (Math.PI * 2) / numDimensions;
    const fontSize = RADAR_LABEL_FONT_SIZE;

    let tempCenterX = 1000;
    let tempCenterY = 1000;

    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius / 4) * i;
      minX = Math.min(minX, tempCenterX - radius);
      maxX = Math.max(maxX, tempCenterX + radius);
      minY = Math.min(minY, tempCenterY - radius);
      maxY = Math.max(maxY, tempCenterY + radius);
    }

    data.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const labelX = tempCenterX + labelDistance * Math.cos(angle);
      const labelY = tempCenterY + labelDistance * Math.sin(angle);

      const textWidth = dim.dimension.length * (fontSize * 0.5);
      const textHeight = fontSize;

      let textMinX = labelX - textWidth / 2;
      let textMaxX = labelX + textWidth / 2;

      if (Math.cos(angle) > 0.3) {
        textMinX = labelX;
        textMaxX = labelX + textWidth;
      } else if (Math.cos(angle) < -0.3) {
        textMinX = labelX - textWidth;
        textMaxX = labelX;
      }

      minX = Math.min(minX, textMinX);
      maxX = Math.max(maxX, textMaxX);
      minY = Math.min(minY, labelY - textHeight / 2);
      maxY = Math.max(maxY, labelY + textHeight / 2);
    });

    const padding = 20;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const canvasWidth = Math.ceil(maxX - minX);
    const canvasHeight = Math.ceil(maxY - minY);
    const offsetX = -minX;
    const offsetY = -minY;
    const centerX = tempCenterX + offsetX;
    const centerY = tempCenterY + offsetY;

    const svgElements: string[] = [];
    const labels: RadarChartLabel[] = [];
    svgElements.push(`<rect width="${canvasWidth}" height="${canvasHeight}" fill="white" />`);

    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius / 4) * i;
      svgElements.push(
        `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="#999999" stroke-width="1" />`,
      );
    }

    const points: { [archetype: string]: { x: number; y: number }[] } = {
      Sovereign: [],
      Empress: [],
      Consort: [],
      Seductress: [],
    };

    data.forEach((dim, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = centerX + maxRadius * Math.cos(angle);
      const y = centerY + maxRadius * Math.sin(angle);

      svgElements.push(
        `<line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="#cccccc" stroke-width="3" />`,
      );

      const labelX = centerX + labelDistance * Math.cos(angle);
      const labelY = centerY + labelDistance * Math.sin(angle);

      let textAnchor: RadarChartLabel['anchor'] = 'middle';
      if (Math.cos(angle) > 0.3) {
        textAnchor = 'start';
      } else if (Math.cos(angle) < -0.3) {
        textAnchor = 'end';
      }

      // Recorded, not rendered — pdf-lib draws these on top of the image later.
      labels.push({ text: dim.dimension, x: labelX, y: labelY, anchor: textAnchor });

      ARCHETYPES.forEach((archetype) => {
        const score = dim[archetype as keyof typeof dim] as number;
        // Ranking 1 ("fully describes me") belongs on the outer ring, so invert before plotting.
        const plottedScore = MAX_RANKING + 1 - score;
        const radius = (maxRadius / MAX_RANKING) * plottedScore;
        const pointX = centerX + radius * Math.cos(angle);
        const pointY = centerY + radius * Math.sin(angle);
        points[archetype].push({ x: pointX, y: pointY });
      });
    });

    ARCHETYPES.forEach((archetype) => {
      const archetypePoints = points[archetype];
      const pointsString = archetypePoints.map((p) => `${p.x},${p.y}`).join(' ');

      svgElements.push(
        `<polygon points="${pointsString}" fill="none" stroke="${COLORS[archetype as keyof typeof COLORS]}" stroke-width="5" />`,
      );

      archetypePoints.forEach((point) => {
        svgElements.push(
          `<circle cx="${point.x}" cy="${point.y}" r="11" fill="${COLORS[archetype as keyof typeof COLORS]}" />`,
        );
      });
    });

    const svgString = `
    <svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
      ${svgElements.join('\n      ')}
    </svg>
  `;

    return { svg: svgString, canvasWidth, canvasHeight, labels };
  }
}
