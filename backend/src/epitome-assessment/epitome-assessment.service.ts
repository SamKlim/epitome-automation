import { Injectable, Logger } from '@nestjs/common';
import { TransformService } from './transform.service';
import { SupabaseService } from '../db/supabase.service';
import { ArchetypeLabelService } from './archetype-label.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class EpitomeAssessmentService {
  private readonly logger = new Logger(EpitomeAssessmentService.name);

  constructor(
    private transformService: TransformService,
    private supabaseService: SupabaseService,
    private archetypeLabelService: ArchetypeLabelService,
    private pdfGeneratorService: PdfGeneratorService,
    private emailService: EmailService,
  ) {}

  async processResponse(rawResponse: any) {
    const startTime = Date.now();
    const timings: Record<string, number> = {};

    const transformed = this.transformService.transform(rawResponse);

    // Step 1: Store in Supabase
    const dbStart = Date.now();
    try {
      await this.supabaseService.insertSurveyResponse(transformed);
      timings.database = Date.now() - dbStart;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Failed to store response: ${message}`);
    }

    const archetypeLabel = this.archetypeLabelService.getLeadingLabel(
      transformed.archetype_scores,
    );

    // Step 2: Generate PDF (fetches name and archetype from Supabase)
    const pdfStart = Date.now();
    let pdfPath: string;
    try {
      pdfPath = await this.pdfGeneratorService.createCustomisedReport(
        transformed.response_id,
      );
      timings.pdf = Date.now() - pdfStart;
      this.logger.log(`Generated PDF: ${pdfPath} (${timings.pdf}ms)`);
    } catch (error) {
      this.logger.error(`Failed to generate PDF: ${error}`);
      throw error;
    }

    // Step 3: Send email in background (fire and forget)
    // Don't await - return success to client immediately
    if (transformed.email) {
      this.sendEmailInBackground(
        transformed.email,
        transformed.first_name || 'Unknown',
        transformed.last_name || 'Unknown',
        pdfPath,
        transformed.response_id,
      );
    }

    const totalTime = Date.now() - startTime;

    return {
      success: true,
      response_id: transformed.response_id,
      message: 'Assessment response processed successfully',
      archetype_scores: transformed.archetype_scores,
      archetype_label: archetypeLabel,
      timing: {
        database: timings.database || 0,
        pdf: timings.pdf || 0,
        total: totalTime,
      },
    };
  }

  private async sendEmailInBackground(
    email: string,
    firstName: string,
    lastName: string,
    pdfPath: string,
    responseId: string,
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        const result = await this.emailService.sendReport(email, firstName, lastName, pdfPath);
        this.logger.log(
          `[${responseId}] Email sent to ${email} on attempt ${attempt} in ${result.time}ms`,
        );
        return; // Success, exit
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[${responseId}] Attempt ${attempt}/${maxRetries} failed: ${errorMessage}`,
        );

        if (attempt < maxRetries) {
          // Wait before retry (40s, 60s)
          const delays = [40000, 60000];
          const delayMs = delays[attempt - 1];
          this.logger.log(`[${responseId}] Retrying in ${delayMs / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
        } else {
          // All retries exhausted
          this.logger.error(
            `[${responseId}] Failed to send email to ${email} after ${maxRetries} attempts: ${errorMessage}`,
          );
          // Error logged to Sentry, user can check dashboard
        }
      }
    }
  }
}
