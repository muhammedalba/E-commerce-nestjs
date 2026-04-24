import { useContainer } from 'class-validator';
import * as cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { I18nService } from 'nestjs-i18n';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // security headers
  app.use(helmet());
  // to use class-validator in DTOs
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  // prefix for all routes
  app.setGlobalPrefix('api/v1');
  // cookie parser
  app.use(cookieParser());
  // redirect to api/v1
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/') {
      return res.redirect('/api/v1');
    }
    next();
  });

  // To use nestjs-i18n in your DTO validation
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // handle all exceptions
  app.useGlobalFilters(new AllExceptionsFilter(app.get(I18nService)));

  // standardize the response
  app.useGlobalInterceptors(new TransformInterceptor(app.get(I18nService)));
  // enable cors
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://10.5.50.6:3000',
      'http://172.20.10.7:3000',
      process.env.CLIENT_URL,
    ],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-lang'],
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
});
