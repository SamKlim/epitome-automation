import { Injectable, Logger } from '@nestjs/common';
import { TransformService } from './transform.service';
import { SupabaseService } from '../db/supabase.service';
import { ArchetypeLabelService } from './archetype-label.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Injectable()
export class EpitomeAssessmentService {
  private readonly logger = new Logger(EpitomeAssessmentService.name);

  constructor(
    private transformService: TransformService,
    private supabaseService: SupabaseService,
    private archetypeLabelService: ArchetypeLabelService,
    private pdfGeneratorService: PdfGeneratorService,
  ) {}

  async processResponse(rawResponse: any) {
    const transformed = this.transformService.transform(rawResponse);

    try {
      await this.supabaseService.insertSurveyResponse(transformed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Failed to store response: ${message}`);
    }

    const archetypeLabel = this.archetypeLabelService.getLeadingLabel(
      transformed.archetype_scores,
    );

    try {
      const pdfPath = await this.pdfGeneratorService.generateReport(
        transformed.first_name || 'Unknown',
        transformed.last_name || 'Unknown',
        archetypeLabel,
        transformed.response_id,
      );
      this.logger.log(`Generated PDF: ${pdfPath}`);
    } catch (error) {
      this.logger.error(`Failed to generate PDF: ${error}`);
    }

    return {
      success: true,
      response_id: transformed.response_id,
      message: 'Assessment response processed successfully',
      archetype_scores: transformed.archetype_scores,
      archetype_label: archetypeLabel,
    };
  }
}
