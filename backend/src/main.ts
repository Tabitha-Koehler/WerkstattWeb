import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const logger = new Logger('Bootstrap');

  // Uploads-Ordner anlegen
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // PDF-Uploads statisch ausliefern
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // CORS: lokale Entwicklung + Produktions-URLs aus Env
  const allowedOrigins: string[] = [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
  ];
  if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL);
  if (process.env.CARGO_DISPO_URL) allowedOrigins.push(process.env.CARGO_DISPO_URL);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  // Einfacher Health-Endpunkt für Railway/Monitoring (ohne DB-Zugriff)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/health', (_req: any, res: any) => res.send({ status: 'ok' }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`WerkstattWeb Backend läuft auf http://localhost:${port}/api`);
}
bootstrap();
