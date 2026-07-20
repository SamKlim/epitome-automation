import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { EpitomeAssessmentService } from './epitome-assessment.service';

@Controller('api/assessments')
export class EpitomeAssessmentController {
  constructor(private assessmentService: EpitomeAssessmentService) {}

  @Post('responses')
  async submitResponse(@Body() rawResponse: any) {
    try {
      if (!rawResponse || typeof rawResponse !== 'object') {
        throw new HttpException(
          'Invalid response format. Expected JSON object.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!rawResponse.id || !rawResponse.surveyId) {
        throw new HttpException(
          'Invalid response format. Missing required fields: id, surveyId.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.assessmentService.processResponse(rawResponse);
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error processing assessment:', error);
      throw new HttpException(
        `Failed to process assessment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('health')
  health() {
    return { status: 'ok', message: 'Epitome Assessment API is running' };
  }
}
