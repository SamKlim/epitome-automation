import { Module } from '@nestjs/common';
import { EpitomeAssessmentController } from './epitome-assessment.controller';
import { EpitomeAssessmentService } from './epitome-assessment.service';
import { TransformService } from './transform.service';
import { SupabaseService } from '../db/supabase.service';

@Module({
  controllers: [EpitomeAssessmentController],
  providers: [EpitomeAssessmentService, TransformService, SupabaseService],
  exports: [EpitomeAssessmentService],
})
export class EpitomeAssessmentModule {}
