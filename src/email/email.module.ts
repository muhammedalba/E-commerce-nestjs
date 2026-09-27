import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import * as path from 'path';
import * as net from 'net';
import { BullModule } from '@nestjs/bullmq';
import { MailProcessor } from './mail.processor';

const MAIL_CONNECT_TIMEOUT_MS = 30_000;

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('MAIL_HOST'),
          port: Number(config.get<string>('MAIL_PORT')),
          secure: false,
          ignoreTLS: false,
          // Connect over IPv4 only. The host has no IPv6 route, and
          // nodemailer 8 ignores `family` and picks a random A/AAAA record,
          // so some sends failed with ENETUNREACH. The hostname is kept for
          // TLS, so the certificate is still checked against MAIL_HOST.
          getSocket: (options, callback) => {
            const socket = net.connect({
              host: options.host,
              port: options.port ?? 587,
              family: 4,
              timeout: MAIL_CONNECT_TIMEOUT_MS,
            });
            const fail = (err: Error) => {
              socket.destroy();
              callback(err, null);
            };
            socket.once('error', fail);
            socket.once('timeout', () =>
              fail(new Error(`SMTP connection to ${options.host} timed out`)),
            );
            socket.once('connect', () => {
              socket.removeAllListeners('error');
              socket.removeAllListeners('timeout');
              socket.setTimeout(0);
              callback(null, { connection: socket });
            });
          },
          auth: {
            user: config.get<string>('MAIL_USERNAME'),
            pass: config.get<string>('MAIL_PASSWORD'),
          },
        } as import('nodemailer/lib/smtp-transport').Options,
        defaults: {
          from: config.get<string>('MAIL_FROM_ADDRESS') || 'No Reply',
        },
        template: {
          dir: path.join(__dirname, 'templates'),

          adapter: new HandlebarsAdapter({
            eq: (a: unknown, b: unknown) => a === b,
            neq: (a: unknown, b: unknown) => a !== b,
          }),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: 'mail-queue',
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        defaultJobOptions: {
          attempts: config.get<number>('MAIL_RETRY_ATTEMPTS'),
          backoff: {
            type: 'exponential',
            delay: config.get<number>('MAIL_RETRY_DELAY'),
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EmailService, MailProcessor],
  exports: [EmailService, BullModule],
})
export class EmailModule {}
