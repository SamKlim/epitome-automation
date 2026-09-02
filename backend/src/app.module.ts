import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EpitomeAssessmentModule } from './epitome-assessment/epitome-assessment.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    EpitomeAssessmentModule,
    EmailModule,
  ],
})
export class AppModule {}
