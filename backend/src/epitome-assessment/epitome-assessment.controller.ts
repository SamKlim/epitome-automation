import { Controller, Post, Body, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { EpitomeAssessmentService } from './epitome-assessment.service';

@Controller('api/assessments')
export class EpitomeAssessmentController {
  constructor(private assessmentService: EpitomeAssessmentService) {}

  private validateBearerToken(authHeader: string | undefined): void {
    if (!authHeader) {
      throw new HttpException(
        'Missing Authorization header',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new HttpException(
        'Invalid Authorization format. Use: Bearer <token>',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const token = parts[1];
    const validToken = process.env.EPITOME_AUTOMATION_SECRET;

    if (!validToken) {
      throw new HttpException(
        'API_KEY not configured',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (token !== validToken) {
      throw new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('responses')
  async submitResponse(
    @Body() rawResponse: any,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      this.validateBearerToken(authHeader);

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
