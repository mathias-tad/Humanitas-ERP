import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { LoggerService } from './modules/logger/logger.service';

async function bootstrap() {
  // Ensure uploads directory exists
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }), // Fastify's own logger disabled — Winston handles everything
  );

  // Enable graceful shutdown on SIGTERM / SIGINT for Docker containers
  app.enableShutdownHooks();

  // Wire ALL NestJS Logger calls (in every module) through our Winston LoggerService
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // WebSocket adapter for Socket.io - must be set before plugins
  app.useWebSocketAdapter(new IoAdapter(app));

  const configService = app.get(ConfigService);

  // Register cookie plugin for HttpOnly cookies
  await app.register(fastifyCookie as any, {
    secret: configService.get<string>(
      'COOKIE_SECRET',
      'your-cookie-secret-change-in-production',
    ),
  });

  // Register multipart for file uploads
  await app.register(multipart as any, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
      files: 1,
    },
  });

  // Serve static files (uploads)
  await app.register(fastifyStatic as any, {
    root: uploadsDir,
    prefix: '/uploads/',
  });

  // Register Fastify content type parsers for ADMS biometric terminals (text/plain, octet-stream)
  const fastifyInstance = app.getHttpAdapter().getInstance();
  if (fastifyInstance && typeof fastifyInstance.addContentTypeParser === 'function') {
    fastifyInstance.addContentTypeParser('text/plain', { parseAs: 'string' }, (_req: any, body: any, done: any) => {
      done(null, body);
    });
    fastifyInstance.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req: any, body: any, done: any) => {
      done(null, body ? body.toString('utf-8') : '');
    });
  }

  // Global prefix (excluding /iclock routes so firmware root requests connect directly)
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix, {
    exclude: ['iclock/(.*)', 'iclock'],
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS — restrict to whitelisted origins only
  // Set CORS_ORIGINS in .env as a comma-separated list of allowed origins.
  // Example: CORS_ORIGINS=https://app.humanitas.io,https://admin.humanitas.io
  const corsOriginsEnv = configService.get<string>('CORS_ORIGINS', 'http://localhost:1300');
  const allowedOrigins = corsOriginsEnv
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman in dev)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      if (origin.endsWith('.ziontech.tech') || origin === 'https://ziontech.tech') {
        return callback(null, true);
      }
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      return callback(new Error(`Origin '${origin}' not allowed by CORS policy`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Tenant-ID',
      'x-tenant-slug',
      'Pragma',
      'Cache-Control',
      'If-Modified-Since',
      'X-Requested-With',
    ],
    credentials: true,
  });

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tenant API')
      .setDescription('Multi-tenant SaaS API for tenant users')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey(
        { type: 'apiKey', name: 'X-Tenant-ID', in: 'header' },
        'tenant-id',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      useGlobalPrefix: false,
    });
  }

  const port = configService.get<number>('PORT', 3001);

  await app.listen(port, '0.0.0.0');

  logger.log(`Tenant API is running on: http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  logger.log(`Swagger docs: http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap();

