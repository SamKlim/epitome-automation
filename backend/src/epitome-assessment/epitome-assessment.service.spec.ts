import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { EpitomeAssessmentService } from './epitome-assessment.service';
import { EpitomeReportGeneratorService } from './epitome-report-generator.service';
import { SupabaseService } from '../db-supabase/supabase.service';
import { FIXTURE_ONE } from '../../tests/fixtures/e2e-survey-response';

/**
 * Email delivery behaviour with a stubbed SMTP transporter. Nothing leaves the machine.
 */

interface ServicePrivates {
  transporter: { sendMail: jest.Mock };
  delay: (ms: number) => Promise<void>;
}

function smtpError(overrides: Record<string, unknown>): Error {
  return Object.assign(new Error('smtp failure'), overrides);
}

const AUTH_REJECTED = smtpError({
  code: 'EAUTH',
  responseCode: 535,
  response: '535-5.7.8 Username and Password not accepted',
});
const CONNECTION_TIMED_OUT = smtpError({ code: 'ETIMEDOUT', command: 'CONN' });

describe('EpitomeAssessmentService email delivery', () => {
  let service: EpitomeAssessmentService;
  let sendMail: jest.Mock;
  let reportPath: string;
  let loggedErrors: string[];

  beforeAll(() => {
    process.env.GMAIL_USER = 'sender@example.com';
    process.env.GMAIL_APP_PASSWORD = 'abcdabcdabcdabcd';
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'epitome-email-test-'));
    reportPath = path.join(dir, 'report.pdf');
    fs.writeFileSync(reportPath, 'not really a pdf');
  });

  beforeEach(() => {
    const supabase = { insertSurveyResponse: jest.fn().mockResolvedValue(undefined) };
    const reportGenerator = { createCustomisedReport: jest.fn().mockResolvedValue(reportPath) };
    service = new EpitomeAssessmentService(
      supabase as unknown as SupabaseService,
      reportGenerator as unknown as EpitomeReportGeneratorService,
    );

    sendMail = jest.fn();
    const privates = service as unknown as ServicePrivates;
    privates.transporter = { sendMail };
    jest.spyOn(privates, 'delay').mockResolvedValue(undefined);

    loggedErrors = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      loggedErrors.push(String(message));
    });
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports email_sent=true and attaches the PDF when Gmail accepts', async () => {
    sendMail.mockResolvedValue({ messageId: '<abc@gmail>', accepted: [FIXTURE_ONE.buildResponse().q_288881568?.q_2018891735] });

    const result = await service.processResponse(FIXTURE_ONE.buildResponse());

    expect(result.email_sent).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      to: 'samanthaklimovski@gmail.com',
      attachments: [{ path: reportPath }],
    });
  });

  it('does not retry when Gmail rejects the credentials, and says what to check', async () => {
    sendMail.mockRejectedValue(AUTH_REJECTED);

    const result = await service.processResponse(FIXTURE_ONE.buildResponse());

    expect(result.success).toBe(true);
    expect(result.email_sent).toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(loggedErrors.join('\n')).toMatch(/535 Username and Password not accepted/);
    expect(loggedErrors.join('\n')).toMatch(/GMAIL_APP_PASSWORD/);
    expect(loggedErrors.join('\n')).toMatch(/sender@example\.com/);
  });

  it('retries once after a connection failure and succeeds', async () => {
    sendMail.mockRejectedValueOnce(CONNECTION_TIMED_OUT).mockResolvedValueOnce({ messageId: '<x>' });

    const result = await service.processResponse(FIXTURE_ONE.buildResponse());

    expect(result.email_sent).toBe(true);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(loggedErrors.join('\n')).toMatch(/Could not reach smtp\.gmail\.com/);
  });

  it('gives up after two connection failures without failing the request', async () => {
    sendMail.mockRejectedValue(CONNECTION_TIMED_OUT);

    const result = await service.processResponse(FIXTURE_ONE.buildResponse());

    expect(result.success).toBe(true);
    expect(result.email_sent).toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(loggedErrors.join('\n')).toMatch(/Giving up after 2 attempts/);
  });

  it('skips email entirely when the response has no address', async () => {
    const noEmail = { ...FIXTURE_ONE.buildResponse(), q_288881568: {} };

    const result = await service.processResponse(noEmail);

    expect(result.email_sent).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
