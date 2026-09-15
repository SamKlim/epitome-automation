import { Module } from '@nestjs/common';
import { EpitomeAssessmentController } from './epitome-assessment.controller';
import { EpitomeAssessmentService } from './epitome-assessment.service';
import { EpitomeReportGeneratorService } from './epitome-report-generator.service';
import { SupabaseService } from '../db-supabase/supabase.service';
import { BearerTokenGuard } from '../auth/auth.guard';

@Module({
  controllers: [EpitomeAssessmentController],
  providers: [
    EpitomeAssessmentService,
    EpitomeReportGeneratorService,
    SupabaseService,
    BearerTokenGuard,
  ],
  exports: [EpitomeAssessmentService],
})
export class EpitomeAssessmentModule {}
