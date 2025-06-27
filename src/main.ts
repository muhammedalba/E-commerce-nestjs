import * as cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { CustomI18nValidationExceptionFilter } from './filters/i18n-validation-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  // To use nestjs-i18n in your DTO validation
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // to translate the class-validator errors
  // app.useGlobalFilters(new I18nValidationExceptionFilter());
  // هندلة الايرور
  app.useGlobalFilters(app.get(CustomI18nValidationExceptionFilter));
  app.enableCors({
    origin: ['http://localhost:3000'], // عنوان واجهتك، غيّره إذا بورت مختلف
    credentials: true, // لو تستخدم كوكيز، وإلا اجعله false أو احذفه
  });

  await app.listen(process.env.PORT ?? 4000);
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
});
