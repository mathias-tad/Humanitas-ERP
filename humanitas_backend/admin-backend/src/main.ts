import * as dns from 'dns';
// Force IPv4 for DNS resolution (prevents ECONNREFUSED ::1:5432 in Docker containers)
dns.setDefaultResultOrder('ipv4first');

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyCookie from '@fastify/cookie';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  // Enable graceful shutdown on SIGTERM / SIGINT for Docker containers
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);

  // Register cookie plugin for HttpOnly cookies
  await app.register(fastifyCookie as any, {
    secret: configService.get<string>('COOKIE_SECRET', 'admin-cookie-secret-change-in-production'),
  });

  // Global prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

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

  // CORS
  const corsOrigins = configService.get<string>('CORS_ORIGINS', '');
  const parsedOrigins = corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (parsedOrigins.includes(origin)) return callback(null, true);
      if (origin.endsWith('.ziontech.tech') || origin === 'https://ziontech.tech') return callback(null, true);
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return callback(null, true);
      return callback(new Error(`Origin '${origin}' not allowed by CORS policy`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
    credentials: true,
  });

  // Swagger documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SaaS ERP API')
      .setDescription('Multi-tenant SaaS ERP Backend API')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Tenant-ID', in: 'header' }, 'tenant-id')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  // Force database synchronization to fix missing columns (e.g. last_login_at)
  try {
    const dataSource = app.get(DataSource);
    await dataSource.synchronize();
    console.log('✅ Database schema synchronized successfully');
  } catch (error) {
    console.error('❌ Database synchronization failed:', error);
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Application is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/docs`);
}

bootstrap();
