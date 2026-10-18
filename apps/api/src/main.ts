import * as dotenv from 'dotenv';
import * as path from 'path';

// Pre-load environment variables before NestJS module resolution
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser = require('cookie-parser');
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());

  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      if (
        corsOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        origin.endsWith('.diagramz.io')
      ) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-workspace-id'],
  });

  // OpenAPI Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Diagramz API')
    .setDescription('Full-Stack Collaborative AI Diagramming Workspace API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Raw OpenAPI spec endpoint
  app.getHttpAdapter().get('/docs-json', (_req, res) => {
    res.json(document);
  });

  // Scalar API Reference (modern interactive documentation)
  app.use(
    '/docs',
    apiReference({
      spec: {
        content: document,
      },
      pageTitle: 'Diagramz API Reference',
      theme: 'purple',
    }),
  );
  app.use(
    '/reference',
    apiReference({
      spec: {
        content: document,
      },
      pageTitle: 'Diagramz API Reference',
      theme: 'purple',
    }),
  );

  const port = process.env.PORT || 4000;
  if (typeof port === 'string' && isNaN(Number(port))) {
    // Windows iisnode named pipe
    await app.listen(port);
    logger.log(`Diagramz API server running via named pipe: ${port}`);
  } else {
    // Numeric port for Linux, Docker, and local development
    await app.listen(Number(port), '0.0.0.0');
    logger.log(`Diagramz API server running at http://0.0.0.0:${port}/api/v1`);
    logger.log(`Interactive API Documentation at http://0.0.0.0:${port}/docs`);
  }
}

bootstrap();
