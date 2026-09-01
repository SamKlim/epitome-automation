import { Injectable } from '@nestjs/common';
import { PDFDocument, PDFPage, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class PdfGeneratorService {
  private templatePath = path.join(__dirname, '../templates/epitome-template.pdf');
  private reportsDir = path.join(__dirname, '../../reports');

  constructor() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async generateReport(
    firstName: string,
    lastName: string,
    archetypeLabel: string,
    responseId: string,
  ): Promise<string> {
    const pdfBuffer = fs.readFileSync(this.templatePath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    // Page 1: Replace SALLY-ANN SAMPLE with client name
    const page1 = pdfDoc.getPage(0);
    const clientName = `${firstName} ${lastName}`.toUpperCase();
    const bgColor = rgb(0.98, 0.97, 0.95); // Matches template background squiggle

    // BOX 1: Large rectangle covering original SALLY-ANN SAMPLE
    page1.drawRectangle({
      x: 200,
      y: 70,
      width: 220,
      height: 30,
      color: bgColor,
    });

    // Calculate text dimensions accurately
    const charWidth = 14 * 0.45; // More accurate char width
    const textWidth = clientName.length * charWidth;
    const padding = 4;
    const fontSize = 14;
    const boxHeight = 30;

    // Wrap text tightly FIRST, then add padding
    const centerPageX = (200 + 420) / 2;
    const textCenterX = centerPageX;

    // Text box (tight around text)
    const textBoxX = textCenterX - (textWidth / 2);
    const textBoxY = 70 + (boxHeight / 2) - (fontSize / 2);

    // Padded box (wraps text box)
    const boxX = textBoxX - padding;
    const boxY = 70;
    const boxWidth = textWidth + (padding * 2);

    page1.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      color: bgColor,
    });

    // Draw text inside padded box
    this.addTextToPage(page1, clientName, textBoxX, textBoxY, fontSize, rgb(0, 0, 0));

    // Page 8: Replace archetype label (cover old text, write new)
    const page8 = pdfDoc.getPage(7);

    // Cover old text with matching background color
    page8.drawRectangle({
      x: 50,
      y: 680,
      width: 500,
      height: 40,
      color: bgColor,
    });

    const archetypes = archetypeLabel.split(' and ');
    if (archetypes.length === 1) {
      this.addTextToPage(
        page8,
        `You tend to lead with the ${archetypeLabel.toUpperCase()}.`,
        60,
        695,
        16,
        rgb(0, 0, 0),
      );
    } else {
      // Two lines for multiple archetypes
      const firstArchetype = archetypes[0].trim().toUpperCase();
      const restArchetypes = archetypes
        .slice(1)
        .map((a) => `the ${a.trim().toUpperCase()}`)
        .join(' AND ');
      this.addTextToPage(page8, `You tend to lead with the ${firstArchetype}`, 60, 705, 16, rgb(0, 0, 0));
      this.addTextToPage(page8, `AND ${restArchetypes}.`, 60, 690, 16, rgb(0, 0, 0));
    }

    const fileName = `epitome-report-${responseId}.pdf`;
    const filePath = path.join(this.reportsDir, fileName);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(filePath, pdfBytes);

    return filePath;
  }

  private getCenteredX(
    text: string,
    fontSize: number,
    rangeStart: number,
    rangeEnd: number,
  ): number {
    const charWidth = fontSize * 0.5;
    const textWidth = text.length * charWidth;
    const rangeCenter = (rangeStart + rangeEnd) / 2;
    return rangeCenter - textWidth / 2;
  }

  private addTextToPage(
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: any,
  ): void {
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      color,
    });
  }
}
