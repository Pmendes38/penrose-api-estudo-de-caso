import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  app.use(helmet({
    crossOriginResourcePolicy: false,
  }));
  app.use(compression());
  app.use(cookieParser());
  app.set('trust proxy', 1);

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.length === 0) return cb(null, true);
      if (corsOrigins.includes(origin)) return cb(null, true);
      const allowed = corsOrigins.some(o => {
        if (o === '*') return true;
        if (o.startsWith('*.')) {
          const domain = o.slice(2);
          return origin.endsWith(domain);
        }
        return false;
      });
      return allowed ? cb(null, true) : cb(new Error('CORS blocked'));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useBodyParser('json', { limit: config.get('JSON_LIMIT') ?? '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: config.get('FORM_LIMIT') ?? '1mb' });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => {
      const issues = errors.map(e => ({
        field: e.property,
        constraints: e.constraints,
      }));
      const bad = new (require('@nestjs/common').BadRequestException)({ message: 'Validation failed', issues });
      return bad;
    },
  }));

  const enableSwagger = config.get<string>('ENABLE_SWAGGER') === 'true' || !isProd;
  if (enableSwagger) {
    const swaggerCfg = new DocumentBuilder()
      .setTitle(config.get('SWAGGER_TITLE') ?? 'Penrose API')
      .setDescription(config.get('SWAGGER_DESC') ?? 'Backend API documentation')
      .setVersion(config.get('SWAGGER_VERSION') ?? '1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerCfg, {
      // deepScanRoutes: true,
    });
    SwaggerModule.setup(config.get('SWAGGER_PATH') ?? 'api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: config.get('SWAGGER_TITLE') ?? 'Penrose API',
    });
  }

  app.enableShutdownHooks();

  const uploadsRoot = process.env.VERCEL ? join('/tmp', 'uploads') : join(process.cwd(), 'uploads');
  const up = join(uploadsRoot, 'avatars');
  fs.mkdirSync(up, { recursive: true });

  app.useStaticAssets(uploadsRoot, { prefix: '/uploads' });

  const host = config.get<string>('HOST') ?? '0.0.0.0';
  const port = Number(config.get<string>('PORT') ?? 4001);
  await app.listen(port, host);
  logger.log(`HTTP server listening at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);

  const close = async (signal: string) => {
    try {
      logger.warn(`Received ${signal}. Closing HTTP server...`);
      await app.close();
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', err as any);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => close('SIGTERM'));
  process.on('SIGINT', () => close('SIGINT'));
}

bootstrap();
