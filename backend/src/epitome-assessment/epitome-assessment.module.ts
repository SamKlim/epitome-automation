import { Module } from '@nestjs/common';
import { EpitomeAssessmentController } from './epitome-assessment.controller';
import { EpitomeAssessmentService } from './epitome-assessment.service';
import { TransformService } from './transform.service';
import { ArchetypeLabelService } from './archetype-label.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { SupabaseService } from '../db/supabase.service';
import { BearerTokenGuard } from '../auth/auth.guard';

@Module({
  controllers: [EpitomeAssessmentController],
  providers: [
    EpitomeAssessmentService,
    TransformService,
    ArchetypeLabelService,
    PdfGeneratorService,
    SupabaseService,
    BearerTokenGuard,
  ],
  exports: [EpitomeAssessmentService],
})
export class EpitomeAssessmentModule {}
