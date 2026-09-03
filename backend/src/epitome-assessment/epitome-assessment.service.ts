import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import questionsMap from '../config/questions_map.json';
import { SupabaseService } from '../db-supabase/supabase.service';
import { EpitomeReportGeneratorService } from './epitome-report-generator.service';
import { SurveyResponseDTO } from './response.dto';
import { ARCHETYPES, Archetype, ArchetypeScores, getArchetypeLabel } from './archetype-label';
import { classifySmtpError, describeSmtpFailure } from './smtp-error';

/**
 * SMTP timeouts. The first two happen before any data moves; the socket
 * timeout is an *inactivity* limit, so it only fires if the ~3.5MB attachment
 * upload actually stalls, not merely because it takes a while.
 */
const SMTP_CONNECTION_TIMEOUT_MS = 10_000;
const SMTP_GREETING_TIMEOUT_MS = 10_000;
const SMTP_SOCKET_TIMEOUT_MS = 30_000;

/**
 * Kept small on purpose: this runs inside a serverless request, and a retry
 * that sleeps longer than the function's max duration is just a killed function.
 */
const EMAIL_MAX_ATTEMPTS = 2;
const EMAIL_RETRY_DELAY_MS = 3_000;

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
      connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
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

    // Step 3: Send email and wait for it — on serverless the function ends with the response.
    // A failed send is logged and reported in the body, but the stored response still returns 201.
    let emailSent = false;
    if (transformed.email) {
      emailSent = await this.sendEmailReportWithRetry(
        transformed.email,
        transformed.first_name || 'Unknown',
        transformed.last_name || 'Unknown',
        reportPath,
        transformed.response_id,
      );
    } else {
      this.logger.warn(`[${transformed.response_id}] No email address in response; report not sent`);
    }

    this.logger.log(`✅ Assessment ${transformed.response_id} processed (email_sent=${emailSent})`);

    return {
      success: true,
      response_id: transformed.response_id,
      message: 'Assessment response processed successfully',
      archetype_scores: transformed.archetype_scores,
      archetype_label: getArchetypeLabel(transformed.archetype_scores),
      email_sent: emailSent,
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

  /** Returns true if Gmail accepted the message. Never throws; failures are logged. */
  private async sendEmailReportWithRetry(
    email: string,
    firstName: string,
    lastName: string,
    reportPath: string,
    responseId: string,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= EMAIL_MAX_ATTEMPTS; attempt++) {
      this.logger.log(`[${responseId}] Sending report to ${email} (attempt ${attempt}/${EMAIL_MAX_ATTEMPTS})`);
      try {
        await this.sendEmailReport(email, firstName, lastName, reportPath);
        return true;
      } catch (error) {
        const failure = classifySmtpError(error);
        this.logger.error(`[${responseId}] ${describeSmtpFailure(failure, process.env.GMAIL_USER)}`);

        if (failure.kind === 'auth') {
          this.logger.error(`[${responseId}] Not retrying: credentials will not change between attempts`);
          return false;
        }
        if (attempt < EMAIL_MAX_ATTEMPTS) {
          this.logger.log(`[${responseId}] Retrying in ${EMAIL_RETRY_DELAY_MS / 1000}s`);
          await this.delay(EMAIL_RETRY_DELAY_MS);
        }
      }
    }

    this.logger.error(`[${responseId}] Giving up after ${EMAIL_MAX_ATTEMPTS} attempts; report not emailed to ${email}`);
    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async sendEmailReport(
    email: string,
    firstName: string,
    lastName: string,
    reportPath: string,
  ): Promise<void> {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;
    this.logger.log(
      `Gmail credentials: user ${gmailUser ? 'set' : 'MISSING'}, app password ${gmailPassword ? 'set' : 'MISSING'}`,
    );
    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');
    }

    if (!fs.existsSync(reportPath)) {
      throw new Error(`Report file not found at: ${reportPath}`);
    }

    const info = await this.transporter.sendMail({
      from: gmailUser,
      to: email,
      subject: 'Your Epitome Archetype Assessment Report',
      html: buildEmailBody(firstName),
      attachments: [
        {
          filename: `epitome-report-${firstName}-${lastName}.pdf`,
          path: reportPath,
        },
      ],
    });

    this.logger.log(
      `Gmail accepted message ${info.messageId} for ${info.accepted?.join(', ') ?? email}`,
    );
  }
}

function buildEmailBody(firstName: string): string {
  return `<p>Dear ${firstName}</p>

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
}
