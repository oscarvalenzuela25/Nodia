import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import qs from 'qs';
import { AppModule } from './app.module.js';
import { envs } from './config/envs.config.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Parse nested query strings (Ransack queries like q[name_in][0]=Oscar, q[is_active_eq]=true)
  app.set('query parser', (str: string) =>
    qs.parse(str, {
      allowDots: true,
      comma: true,
    }),
  );

  // Set global prefix for all routes
  app.setGlobalPrefix('/api/v1');

  // Enable CORS for all origins
  app.enableCors();

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global request logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Documentation API')
    .setDescription('API documentation')
    .setVersion('1.0')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('/api/documentation', app, documentFactory);

  await app.listen(envs.PORT);

  logger.log(`🚀 Application running on: http://localhost:${envs.PORT}/api/v1`);
  logger.log(`📚 Swagger documentation: http://localhost:${envs.PORT}/api/documentation`);
}
await bootstrap();
