import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  Sentry.init({
    dsn,
    environment,
    enabled: !!dsn,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    integrations: [
      Sentry.httpIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      nodeProfilingIntegration(),
    ],
    beforeSend(event) {
      if (environment === 'development') {
        console.log('Sentry event:', event);
      }
      return event;
    },
  });
}

export { Sentry };
