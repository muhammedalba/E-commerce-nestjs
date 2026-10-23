import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { I18nValidationPipe } from 'nestjs-i18n';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { getTrustedProxies } from './shared/utils/trusted-proxies';
import { getAllowedOrigins, toOrigin } from './config/allowed-origins';
import { I18nService } from 'nestjs-i18n';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Graceful shutdown. The host stops the process with a signal (SIGTERM /
  // SIGINT) on every deploy, restart or scale-down. Without this, Nest
  // ignores the signal and the process is killed mid-flight: no module
  // cleanup runs. With it, Nest first stops accepting new connections and
  // runs every lifecycle hook (onModuleDestroy / onApplicationShutdown):
  // - RedisModule quits its client and subscriber connections, so the
  //   server doesn't keep dead connections open until they time out.
  //   That matters on providers with a connection cap.
  // - BullMQ workers close, so a mail job in progress is released instead
  //   of being left stalled until the lock expires.
  // - Scheduled (@Cron) jobs stop and the MongoDB connection closes cleanly.
  // Required for zero-downtime restarts (e.g. `pm2 reload`) when running
  // more than one instance.
  app.enableShutdownHooks();
  // Requests reach the API through trusted proxies (the local reverse proxy,
  // plus any CDN listed in TRUSTED_PROXIES). Express walks X-Forwarded-For
  // from the right, skipping trusted hops, so req.ip is the real client —
  // per-client rate limiting — and client-supplied values can't spoof it.
  const trustedProxies = getTrustedProxies();
  app.set('trust proxy', (address: string) =>
    trustedProxies.isTrusted(address),
  );
  // allowed origins
  const allowedOrigins = getAllowedOrigins();
  // security headers
  app.use(helmet());

  // allow specific origins to access uploads
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    // Referer is a full URL: compare only its origin, never a prefix
    const origin = toOrigin(req.headers.origin || req.headers.referer);
    const isAllowed =
      !!origin &&
      allowedOrigins.some((allowed) => toOrigin(allowed) === origin);

    if (isAllowed) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    // The storefront shows uploaded PDFs (the order's invoice) in an iframe
    // from its own origin. helmet only allows framing by this API's origin
    // (X-Frame-Options: SAMEORIGIN, frame-ancestors 'self'), which the
    // browser reports as "refused to connect". Let the allowed origins frame
    // uploads: the browser enforces the list, whatever the Referer says.
    res.removeHeader('X-Frame-Options');
    const csp = res.getHeader('Content-Security-Policy');
    if (typeof csp === 'string') {
      res.setHeader(
        'Content-Security-Policy',
        csp.replace(
          /frame-ancestors [^;]*/,
          `frame-ancestors 'self' ${allowedOrigins.join(' ')}`,
        ),
      );
    }
    next();
  });

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

  // enable cors
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-lang',
      'x-recaptcha-token',
    ],
    maxAge: 86400, // cache preflight responses to avoid an OPTIONS per request
  });

  // await app.listen(process.env.PORT || 3000, '0.0.0.0');
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  console.log(`Application running on port ${port}`);
}
bootstrap().catch((err) => {
  console.error('Error during application bootstrap:', err);
  // Exit so the host restarts the app instead of leaving a process that
  // never listens.
  process.exit(1);
});
