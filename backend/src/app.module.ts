import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EpitomeAssessmentModule } from './epitome-assessment/epitome-assessment.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EpitomeAssessmentModule,
  ],
})
export class AppModule {}
