import { describe, it, beforeAll, afterAll, expect, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus, Controller, Get, BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Verifies that the SentryExceptionFilter captures exceptions and sends them to Sentry.
 * Mocks Sentry so no real DSN is needed.
 */

// Mock Sentry module before app initialization
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(() => 'mock-event-id'),
  httpIntegration: jest.fn(),
  onUncaughtExceptionIntegration: jest.fn(),
  onUnhandledRejectionIntegration: jest.fn(),
}));

@Controller('test-errors')
class TestErrorController {
  @Get('throw-error')
  throwError() {
    throw new BadRequestException('Test error from Sentry E2E test');
  }

  @Get('throw-unhandled')
  throwUnhandledError() {
    throw new Error('Unhandled error for Sentry');
  }
}

describe('Sentry Exception Filter E2E', () => {
  let app: INestApplication;
  let Sentry: any;

  beforeAll(async () => {
    // Get the mocked Sentry module
    Sentry = require('@sentry/node');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [TestErrorController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('BadRequestException handling', () => {
    let response: request.Response;

    beforeAll(async () => {
      Sentry.captureException.mockClear();
      response = await request(app.getHttpServer())
        .get('/test-errors/throw-error')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return the error as JSON with statusCode, message, and timestamp', () => {
      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Test error from Sentry E2E test',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should capture the exception with Sentry', () => {
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should include HTTP context when capturing exception', () => {
      const callArgs = Sentry.captureException.mock.calls[0];
      const exceptionArg = callArgs[0];
      const contextArg = callArgs[1];

      expect(exceptionArg).toBeInstanceOf(BadRequestException);
      expect(contextArg).toEqual(
        expect.objectContaining({
          tags: {
            service: 'epitome-assessment',
          },
          contexts: {
            http: expect.objectContaining({
              method: 'GET',
              url: '/test-errors/throw-error',
              status_code: HttpStatus.BAD_REQUEST,
            }),
          },
          user: {
            ip_address: expect.any(String),
          },
        }),
      );
    });
  });

  describe('Unhandled error handling', () => {
    beforeAll(async () => {
      Sentry.captureException.mockClear();
    });

    it('should capture unhandled errors and return 500', async () => {
      const response = await request(app.getHttpServer())
        .get('/test-errors/throw-unhandled')
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);

      expect(response.body).toEqual(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Unhandled error for Sentry',
        }),
      );

      expect(Sentry.captureException).toHaveBeenCalled();
    });
  });
});
