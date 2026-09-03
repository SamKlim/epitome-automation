import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import questionsMap from '../config/questions_map.json';
import { SupabaseService } from '../db-supabase/supabase.service';
import { EpitomeReportGeneratorService } from './epitome-report-generator.service';
import { SurveyResponseDTO } from './response.dto';
import { ARCHETYPES, Archetype, ArchetypeScores, getArchetypeLabel } from './archetype-label';

export interface TransformedSurveyResponse {
  response_id: string;
  survey_id: string;
  date_created: string;
  ip_address: string;
  duration_seconds: number;
  collector_id: string;
  response_status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  organization: string | null;
  responses: any[];
  archetype_scores: ArchetypeScores;
}

@Injectable()
export class EpitomeAssessmentService {
  private readonly logger = new Logger(EpitomeAssessmentService.name);
  private questionsMap: any[] = questionsMap;
  private transporter: nodemailer.Transporter;

  constructor(
    private supabaseService: SupabaseService,
    private reportGeneratorService: EpitomeReportGeneratorService,
  ) {
    this.initializeEmailTransporter();
  }

  private initializeEmailTransporter(): void {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  async processResponse(rawResponse: any) {
    this.logger.log(`Received assessment response (ID: ${rawResponse.id})`);

    const transformed = this.transformResponse(rawResponse);

    // Step 1: Store in Supabase
    try {
      await this.supabaseService.insertSurveyResponse(transformed);
      this.logger.log(`✅ Stored in Supabase: ${transformed.response_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown database error';
      throw new Error(`Failed to store response: ${message}`);
    }

    // Step 2: Generate Report (fetches name and archetype from Supabase)
    let reportPath: string;
    try {
      reportPath = await this.reportGeneratorService.createCustomisedReport(
        transformed.response_id,
      );
      this.logger.log(`✅ Report generated and saved temporarily`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      this.logger.error(`Failed to generate report for ${transformed.response_id}:`, {
        message: errorMsg,
        stack: errorStack,
        type: error instanceof Error ? error.constructor.name : typeof error,
      });
      throw error;
    }

    // Step 3: Send email (wait for completion)
    if (transformed.email) {
      this.logger.log(`📧 Sending email to ${transformed.email}...`);
      try {
        await this.sendEmailReportInBackground(
          transformed.email,
          transformed.first_name || 'Unknown',
          transformed.last_name || 'Unknown',
          reportPath,
          transformed.response_id,
        );
      } catch (emailError) {
        this.logger.error(`Email send failed (non-fatal):`, emailError);
      }
    }

    this.logger.log(`✅ Assessment ${transformed.response_id} processed`);

    const archetypeLabel = getArchetypeLabel(transformed.archetype_scores);

    return {
      success: true,
      response_id: transformed.response_id,
      message: 'Assessment response processed successfully',
      archetype_scores: transformed.archetype_scores,
      archetype_label: archetypeLabel,
    };
  }

  private transformResponse(rawResponse: unknown): TransformedSurveyResponse {
    const response = rawResponse as SurveyResponseDTO;

    const archetypeScores: ArchetypeScores = {
      Sovereign: 0,
      Empress: 0,
      Consort: 0,
      Seductress: 0,
    };

    const responses = this.buildResponses(response, archetypeScores);

    return {
      response_id: response.id as string,
      survey_id: response.surveyId as string,
      date_created: response.dateCreated as string,
      ip_address: response.ipAddress as string,
      duration_seconds: response.totalTime as number,
      collector_id: response.collectorId as string,
      response_status: response.responseStatus as string,
      first_name: response.q_288881567?.q_2018891726 || null,
      last_name: response.q_288881567?.q_2018891727 || null,
      email: response.q_288881568?.q_2018891735 || null,
      organization: response.q_288881569 || null,
      responses,
      archetype_scores: archetypeScores,
    };
  }

  private buildResponses(
    rawResponse: Record<string, unknown>,
    archetypeScores: ArchetypeScores,
  ): any[] {
    const responses: any[] = [];

    this.questionsMap.forEach((question) => {
      const questionId = `q_${question.question_id}`;
      const questionAnswers = rawResponse[questionId] as Record<string, string> | undefined;

      if (!questionAnswers) return;

      const answers = question.answers.map((answerOption: any) => {
        const subquestionId = answerOption.subquestion_id;
        const rankingStr = questionAnswers[subquestionId];
        const ranking = rankingStr ? parseInt(rankingStr, 10) : NaN;
        const validRanking = !isNaN(ranking) ? ranking : null;

        if (validRanking !== null) {
          const archetype = answerOption.archetype as Archetype;
          if (ARCHETYPES.includes(archetype)) {
            archetypeScores[archetype] += validRanking;
          }
        }

        return {
          subquestion_id: subquestionId,
          archetype: answerOption.archetype,
          statement: answerOption.statement,
          ranking: validRanking,
        };
      });

      responses.push({
        question_id: question.question_id,
        dimension: question.dimension,
        answers,
      });
    });

    return responses;
  }

  private async sendEmailReportInBackground(
    email: string,
    firstName: string,
    lastName: string,
    reportPath: string,
    responseId: string,
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        await this.sendEmailReport(email, firstName, lastName, reportPath);
        this.logger.log(`[${responseId}] Email sent to ${email} on attempt ${attempt}`);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `[${responseId}] Attempt ${attempt}/${maxRetries} failed: ${errorMessage}`,
        );

        if (attempt < maxRetries) {
          const delays = [40000, 60000];
          const delayMs = delays[attempt - 1];
          this.logger.log(`[${responseId}] Retrying in ${delayMs / 1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          attempt++;
        } else {
          this.logger.error(
            `[${responseId}] Failed to send email to ${email} after ${maxRetries} attempts: ${errorMessage}`,
          );
        }
      }
    }
  }

  private async sendEmailReport(
    email: string,
    firstName: string,
    lastName: string,
    reportPath: string,
  ): Promise<void> {

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      throw new Error('Gmail credentials not configured');
    }

    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report file not found at: ${reportPath}`);
    }

    const emailBody = `<p>Dear ${firstName}</p>

<p>Thank you for completing your Epitome Archetype Assessment. Your personalised report on the four archetypes is attached.</p>

<p>Before you read it, one suggestion. Look first at where the four archetypes sit relative to each other rather than at which one came out highest, and notice whether anything surprises you.</p>

<p>Remember that all four live in you. The report is showing you which ones you are currently drawing on, not which ones you have.</p>

<p>If you would like to take it further, there are two ways to do that.</p>

<p>A single session. Sixty minutes on your report in the context of your actual role - the archetype you lead from, the one you have set down, and what it would take to bring her forward. You leave with something specific to work on.</p>

<p>Three sessions over three months. For women working on something particular: a new role, a step up, a leadership identity that no longer fits. We shape it around what you are facing, and the archetypes become a working language rather than an insight.</p>

<p>For pricing and availability, just reply to this email.</p>

<p>Kind regards<br/>
Merle</p>

<hr/>

<p>
HM Singer<br/>
<a href="mailto:merle@cotw.com.au">merle@cotw.com.au</a><br/>
<a href="mailto:merle@epitome-leadership.com">merle@epitome-leadership.com</a><br/>
<a href="https://instagram.com/epitomeleadership" target="_blank">@epitomeleadership</a><br/>
<a href="https://linkedin.com/in/mesinger" target="_blank">linkedin.com/in/mesinger</a>
</p>`;

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your Epitome Archetype Assessment Report',
      html: emailBody,
      attachments: [
        {
          filename: `epitome-report-${firstName}-${lastName}.pdf`,
          path: reportPath,
        },
      ],
    };

    await this.transporter.sendMail(mailOptions);
    this.logger.log(`Email sent to ${email}`);
  }
}
