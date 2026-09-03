import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { generateRadarChartSvg } from '../radarChart-svg';
import { SupabaseService } from '../db/supabase.service';

@Injectable()
export class PdfGeneratorService {
  private templatePath = path.resolve(
    __dirname,
    '../../../src/templates/epitome-template.pdf'
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

    // Calculate archetype label from scores if not provided
    let archetypeLabel = data.archetype_label;
    if (!archetypeLabel && data.archetype_scores) {
      const scores = data.archetype_scores as Record<string, number>;

      // Find top two archetypes
      const sortedArchetypes = Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

      const topScore = scores[sortedArchetypes[0]];
      const secondScore = scores[sortedArchetypes[1]];

      // If top two are within 5 points, show both; otherwise show top only
      if (Math.abs(topScore - secondScore) <= 5) {
        archetypeLabel = `${sortedArchetypes[0]} and ${sortedArchetypes[1]}`;
      } else {
        archetypeLabel = sortedArchetypes[0];
      }
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

    // Generate radar chart PNG with dynamic bounding box (no padding)
    const radarChartBuffer = await generateRadarChartSvg();
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
}
