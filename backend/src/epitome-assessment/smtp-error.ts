/**
 * Turns whatever nodemailer throws into something a log line can explain.
 *
 * nodemailer attaches `code` (e.g. "EAUTH", "ETIMEDOUT"), and for SMTP-level
 * rejections `responseCode` (e.g. 535) and the raw `response` text.
 */

const SMTP_AUTH_ERROR_CODE = 'EAUTH';
const SMTP_AUTH_REJECTED_RESPONSE_CODE = 535;
const SMTP_CONNECTION_ERROR_CODES = ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS'] as const;

export type SmtpFailureKind = 'auth' | 'connection' | 'other';

export interface SmtpFailure {
  kind: SmtpFailureKind;
  code: string | undefined;
  responseCode: number | undefined;
  response: string | undefined;
  message: string;
}

interface NodemailerErrorShape {
  code?: unknown;
  responseCode?: unknown;
  response?: unknown;
  message?: unknown;
}

export function classifySmtpError(error: unknown): SmtpFailure {
  const shape: NodemailerErrorShape = typeof error === 'object' && error !== null ? error : {};
  const code = typeof shape.code === 'string' ? shape.code : undefined;
  const responseCode = typeof shape.responseCode === 'number' ? shape.responseCode : undefined;
  const response = typeof shape.response === 'string' ? shape.response : undefined;
  const message = error instanceof Error ? error.message : String(error);

  return { kind: kindOf(code, responseCode), code, responseCode, response, message };
}

function kindOf(code: string | undefined, responseCode: number | undefined): SmtpFailureKind {
  if (code === SMTP_AUTH_ERROR_CODE || responseCode === SMTP_AUTH_REJECTED_RESPONSE_CODE) {
    return 'auth';
  }
  if (code && (SMTP_CONNECTION_ERROR_CODES as readonly string[]).includes(code)) {
    return 'connection';
  }
  return 'other';
}

/** One plain-English line saying what went wrong and what to check. */
export function describeSmtpFailure(failure: SmtpFailure, gmailUser: string | undefined): string {
  const detail = [
    failure.code && `code=${failure.code}`,
    failure.responseCode && `responseCode=${failure.responseCode}`,
    failure.response && `response="${failure.response}"`,
  ]
    .filter(Boolean)
    .join(' ');

  switch (failure.kind) {
    case 'auth':
      return (
        `Gmail rejected the credentials for ${gmailUser ?? '<GMAIL_USER missing>'} ` +
        `(535 Username and Password not accepted). Check GMAIL_APP_PASSWORD in the deployment ` +
        `environment: it must be the 16-character app password with no spaces. ${detail}`
      );
    case 'connection':
      return `Could not reach smtp.gmail.com (${failure.message}). ${detail}`;
    default:
      return `Email send failed: ${failure.message}. ${detail}`;
  }
}
