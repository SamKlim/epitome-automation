import { NestFactory } from '@nestjs/core';
import { INestApplication } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

let app: INestApplication | null = null;

export default async (req: Request, res: Response) => {
  try {
    if (!app) {
      app = await NestFactory.create(AppModule, { logger: false });
      await app.init();
    }

    app.getHttpAdapter().getInstance()(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: `Server initialization failed: ${message}` });
  }
};
