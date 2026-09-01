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

    // Page 1: Replace SALLY-ANN SAMPLE with client name (exact position: x=231, y=746)
    const page1 = pdfDoc.getPage(0);
    const clientName = `${firstName} ${lastName}`;

    // Cover "SALLY-ANN SAMPLE" with white rectangle
    page1.drawRectangle({
      x: 221,
      y: 746,
      width: 168,
      height: 36,
      color: rgb(0.96, 0.95, 0.92),
    });

    // Draw client name at exact position of original text
    this.addTextToPage(page1, clientName, 231, 760, 14, rgb(0, 0, 0));

    // Page 8: Replace archetype label (cover old text, write new)
    const page8 = pdfDoc.getPage(7);

    // Cover old text with white rectangle
    page8.drawRectangle({
      x: 50,
      y: 680,
      width: 500,
      height: 40,
      color: rgb(1, 1, 1),
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
