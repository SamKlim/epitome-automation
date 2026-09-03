import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { SupabaseService } from '../db-supabase/supabase.service';
import { ArchetypeScores } from './epitome-assessment.service';

@Injectable()
export class EpitomeReportGeneratorService {
  private templatePath = path.resolve(
    __dirname,
    '../../../src/epitome-assessment-sample.pdf'
  );
  private reportsDir = '/tmp/reports';

  constructor(private supabaseService: SupabaseService) {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
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

    console.log(`✅ Fetched data from Supabase for ${responseId}:`, {
      firstName: data.first_name,
      lastName: data.last_name,
      archetypeLabel: data.archetype_label,
      responseId: data.response_id,
    });

    const firstName = data.first_name || 'Unknown';
    const lastName = data.last_name || 'Unknown';

    // Transform responses array into dimension scores for radar chart
    const dimensionScores = this.transformResponsesToDimensionScores(data.responses);

    // Calculate archetype label from scores if not provided
    let archetypeLabel = data.archetype_label;
    if (!archetypeLabel && data.archetype_scores) {
      archetypeLabel = this.getArchetypeLabel(data.archetype_scores);
    }
    archetypeLabel = archetypeLabel || 'Unknown';

    // Load template PDF
    const pdfBuffer = fs.readFileSync(this.templatePath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Page 1: Replace client name
    const page1 = pdfDoc.getPage(0);
    await this.replaceClientName(page1, firstName, lastName, pdfDoc);

    // Page 8: Replace archetype label
    const page8 = pdfDoc.getPage(7);
    await this.replaceArchetypeLabel(page8, archetypeLabel, pdfDoc);

    // CHART PLACEMENT LOGIC
    // The radar chart is embedded in the bottom-left quadrant of page 8
    // within a defined white box. The chart is dynamically sized (based on
    // actual content bounds) and then scaled to fit within the box while
    // maintaining its aspect ratio. The chart is centered both horizontally
    // and vertically within the box for balanced visual presentation.

    // Draw white rectangle boundary (bottom-left quadrant: 590×450)
    page8.drawRectangle({
      x: 0,
      y: 0,
      width: 590,
      height: 450,
      color: rgb(1, 1, 1),
    });

    // Generate radar chart PNG with actual user response data
    const radarChartBuffer = await this.generateRadarChartSvg(dimensionScores);
    const radarImage = await pdfDoc.embedPng(radarChartBuffer);

    // Define the target box dimensions where chart will be placed
    const boxWidth = 590;
    const boxHeight = 450;
    const boxX = 0;
    const boxY = 0;

    // Estimate chart aspect ratio based on typical dynamic generation
    // (chart width to height ratio, approximately 1.4:1 from bounding box)
    const estimatedAspectRatio = 1.4;

    // Calculate scaled dimensions: fit chart within box maintaining aspect ratio
    // Strategy: try width-first scaling, if height exceeds box, switch to height-first
    let scaledWidth = boxWidth;
    let scaledHeight = boxWidth / estimatedAspectRatio;

    if (scaledHeight > boxHeight) {
      // Height would exceed box, so constrain by height instead
      scaledHeight = boxHeight;
      scaledWidth = boxHeight * estimatedAspectRatio;
    }

    // Center the scaled chart both horizontally and vertically within the box
    const chartX = boxX + (boxWidth - scaledWidth) / 2;
    const chartY = boxY + (boxHeight - scaledHeight) / 2;

    // Embed the radar chart image at calculated position and size
    page8.drawImage(radarImage, {
      x: chartX,
      y: chartY,
      width: scaledWidth,
      height: scaledHeight,
    });

    console.log(`📊 Radar chart embedded: ${scaledWidth.toFixed(0)}×${scaledHeight.toFixed(0)} (centered in 590×450 box)`);

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

      return {
        dimension: response.dimension,
        Sovereign: (scores.Sovereign || 1) as 1 | 2 | 3 | 4,
        Empress: (scores.Empress || 1) as 1 | 2 | 3 | 4,
        Consort: (scores.Consort || 1) as 1 | 2 | 3 | 4,
        Seductress: (scores.Seductress || 1) as 1 | 2 | 3 | 4,
      };
    });
  }

  private getArchetypeLabel(archetypeScores: ArchetypeScores): string {
    const entries = [
      { name: 'Sovereign', score: archetypeScores.Sovereign },
      { name: 'Empress', score: archetypeScores.Empress },
      { name: 'Consort', score: archetypeScores.Consort },
      { name: 'Seductress', score: archetypeScores.Seductress },
    ];

    const sorted = entries.sort((a, b) => a.score - b.score);
    const lowestScore = sorted[0].score;
    const leadingArchetypes = sorted.filter((e) => e.score <= lowestScore + 2);

    return leadingArchetypes.map((e) => e.name).join(' and ');
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
    scoresByArchetype?: Array<{
      dimension: string;
      Sovereign: 1 | 2 | 3 | 4;
      Empress: 1 | 2 | 3 | 4;
      Consort: 1 | 2 | 3 | 4;
      Seductress: 1 | 2 | 3 | 4;
    }>,
  ): Promise<Buffer> {
    const defaultData: Array<{
      dimension: string;
      Sovereign: 1 | 2 | 3 | 4;
      Empress: 1 | 2 | 3 | 4;
      Consort: 1 | 2 | 3 | 4;
      Seductress: 1 | 2 | 3 | 4;
    }> = [
      { dimension: 'Leading', Sovereign: 4, Empress: 1, Consort: 2, Seductress: 3 },
      { dimension: 'Trust', Sovereign: 2, Empress: 4, Consort: 1, Seductress: 3 },
      { dimension: 'Constraints', Sovereign: 1, Empress: 3, Consort: 4, Seductress: 2 },
      { dimension: 'Inspiration', Sovereign: 3, Empress: 2, Consort: 1, Seductress: 4 },
      { dimension: 'Managing Challenges', Sovereign: 4, Empress: 2, Consort: 3, Seductress: 1 },
      { dimension: 'Others View Me', Sovereign: 2, Empress: 3, Consort: 4, Seductress: 1 },
      { dimension: 'Striving', Sovereign: 3, Empress: 4, Consort: 2, Seductress: 1 },
      { dimension: 'Working With Peers', Sovereign: 1, Empress: 2, Consort: 4, Seductress: 3 },
      { dimension: 'At Your Worst', Sovereign: 2, Empress: 1, Consort: 3, Seductress: 4 },
      { dimension: 'Confidence', Sovereign: 4, Empress: 3, Consort: 1, Seductress: 2 },
      { dimension: 'Power', Sovereign: 3, Empress: 4, Consort: 1, Seductress: 2 },
      { dimension: 'Ambition', Sovereign: 4, Empress: 2, Consort: 1, Seductress: 3 },
    ];

    const data = scoresByArchetype || defaultData;
    this.validateScoreData(data);
    const svgString = this.generateRadarChartSvgString(data);

    const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
    return pngBuffer;
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
  ): string {
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
    const fontSize = 26;

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

      let textAnchor = 'middle';
      if (Math.cos(angle) > 0.3) {
        textAnchor = 'start';
      } else if (Math.cos(angle) < -0.3) {
        textAnchor = 'end';
      }

      svgElements.push(
        `<text x="${labelX}" y="${labelY}" font-size="${fontSize}" font-family="Helvetica" text-anchor="${textAnchor}" dominant-baseline="middle" fill="black">${dim.dimension}</text>`,
      );

      ARCHETYPES.forEach((archetype) => {
        const score = dim[archetype as keyof typeof dim] as number;
        const radius = (maxRadius / 4) * score;
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

    return svgString;
  }
}
