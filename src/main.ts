import { useContainer } from 'class-validator';
import * as cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { I18nService } from 'nestjs-i18n';
import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // The API runs behind a reverse proxy on the same host (requests arrive
  // from 127.0.0.1 with the client in X-Forwarded-For). Trust only that
  // loopback hop so req.ip is the real client — per-client rate limiting —
  // while a client-supplied X-Forwarded-For value can't spoof it.
  app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
  // allowed origins
  const allowedOrigins = [
    'http://localhost:3000',
    'http://10.5.50.6:3000',
    'http://172.20.10.7:3000',
    process.env.CLIENT_URL,
  ];
  // security headers
  app.use(helmet());

  // allow specific origins to access uploads
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    const allowedOriginsFilter = allowedOrigins.filter((o): o is string => !!o);
    const origin = req.headers.origin || req.headers.referer;
    const isAllowed = allowedOriginsFilter.some((allowed) =>
      origin?.startsWith(allowed),
    );

    if (isAllowed) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    next();
  });

  // to use class-validator in DTOs
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
  // prefix for all routes
  app.setGlobalPrefix('api/v1');
  // cookie parser
  app.use(cookieParser());
  // TEMPORARY diagnostic (remove after configuring `trust proxy`): shows what
  // the API sees as the client IP, to find how many proxies sit in front of it.
  // Requires the x-internal-key header; answers 404 to everyone else.
  app.use(
    '/api/v1/debug/request-ip',
    (req: Request, res: Response, next: NextFunction) => {
      const key = process.env.INTERNAL_API_KEY;
      const provided = req.headers['x-internal-key'];
      const ok =
        !!key &&
        typeof provided === 'string' &&
        provided.length === key.length &&
        timingSafeEqual(Buffer.from(provided), Buffer.from(key));
      if (!ok) return next();

      res.json({
        ip: req.ip,
        ips: req.ips,
        socketRemoteAddress: req.socket.remoteAddress,
        trustProxy: req.app.get('trust proxy') as unknown,
        headers: {
          'x-forwarded-for': req.headers['x-forwarded-for'] ?? null,
          'x-real-ip': req.headers['x-real-ip'] ?? null,
          'cf-connecting-ip': req.headers['cf-connecting-ip'] ?? null,
          'x-forwarded-proto': req.headers['x-forwarded-proto'] ?? null,
          'x-forwarded-host': req.headers['x-forwarded-host'] ?? null,
          via: req.headers['via'] ?? null,
        },
      });
    },
  );

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

  // enable cors
  app.enableCors({
    origin: allowedOrigins.filter((o): o is string => !!o),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-lang'],
    maxAge: 86400, // cache preflight responses to avoid an OPTIONS per request
  });

  // await app.listen(process.env.PORT || 3000, '0.0.0.0');
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
});
