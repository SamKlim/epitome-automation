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

    // Page 1: Add client name (replacing SALLY-ANN SAMPLE)
    const page1 = pdfDoc.getPage(0);
    this.addTextToPage(page1, `${firstName} ${lastName}`, 300, 150, 24, rgb(0, 0, 0));

    // Page 8: Add archetype label (replacing EMPRESS)
    const page8 = pdfDoc.getPage(7);
    const archetypes = archetypeLabel.split(' and ');
    if (archetypes.length === 1) {
      this.addTextToPage(
        page8,
        `You tend to lead with the ${archetypeLabel.toUpperCase()}.`,
        100,
        700,
        16,
        rgb(0, 0, 0),
      );
    } else {
      // Two lines for multiple archetypes with "the" before each
      const firstArchetype = archetypes[0].trim().toUpperCase();
      const restArchetypes = archetypes
        .slice(1)
        .map((a) => `the ${a.trim().toUpperCase()}`)
        .join(' AND ');
      this.addTextToPage(page8, `You tend to lead with the ${firstArchetype}`, 100, 710, 16, rgb(0, 0, 0));
      this.addTextToPage(page8, `AND ${restArchetypes}.`, 100, 690, 16, rgb(0, 0, 0));
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
