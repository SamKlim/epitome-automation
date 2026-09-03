import { classifySmtpError, describeSmtpFailure } from './smtp-error';

describe('classifySmtpError', () => {
  it('recognises a Gmail credential rejection by code', () => {
    const failure = classifySmtpError(Object.assign(new Error('Invalid login'), { code: 'EAUTH' }));
    expect(failure.kind).toBe('auth');
  });

  it('recognises a Gmail credential rejection by 535 response code', () => {
    const failure = classifySmtpError(
      Object.assign(new Error('x'), { responseCode: 535, response: '535-5.7.8 Username and Password not accepted' }),
    );
    expect(failure.kind).toBe('auth');
    expect(failure.response).toContain('Username and Password not accepted');
  });

  it('recognises connection problems', () => {
    expect(classifySmtpError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' })).kind).toBe('connection');
    expect(classifySmtpError(Object.assign(new Error('x'), { code: 'ECONNECTION' })).kind).toBe('connection');
  });

  it('falls back to "other" for anything else, including non-Error throws', () => {
    expect(classifySmtpError(new Error('boom')).kind).toBe('other');
    expect(classifySmtpError('a string').message).toBe('a string');
  });
});

describe('describeSmtpFailure', () => {
  it('tells the reader to check the app password on auth failure', () => {
    const text = describeSmtpFailure(
      classifySmtpError(Object.assign(new Error('x'), { code: 'EAUTH', responseCode: 535 })),
      'merle@example.com',
    );
    expect(text).toMatch(/merle@example\.com/);
    expect(text).toMatch(/GMAIL_APP_PASSWORD/);
    expect(text).toMatch(/no spaces/);
    expect(text).toMatch(/code=EAUTH responseCode=535/);
  });

  it('names the host on connection failure', () => {
    const text = describeSmtpFailure(
      classifySmtpError(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' })),
      'merle@example.com',
    );
    expect(text).toMatch(/smtp\.gmail\.com/);
  });
});
