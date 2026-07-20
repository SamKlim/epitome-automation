import { Injectable } from '@nestjs/common';
import { TransformService } from './transform.service';
import { SupabaseService } from '../db/supabase.service';

@Injectable()
export class EpitomeAssessmentService {
  constructor(
    private transformService: TransformService,
    private supabaseService: SupabaseService,
  ) {}

  async processResponse(rawResponse: any) {
    const transformed = this.transformService.transform(rawResponse);

    try {
      await this.supabaseService.insertSurveyResponse(transformed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Failed to store response: ${message}`);
    }

    return {
      success: true,
      response_id: transformed.response_id,
      message: 'Assessment response processed successfully',
      archetype_scores: transformed.archetype_scores,
    };
  }
}
