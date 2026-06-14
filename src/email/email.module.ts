import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import * as path from 'path';
import { BullModule } from '@nestjs/bullmq';
import { MailProcessor } from './mail.processor';

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
          family: 4, // Force IPv4 to avoid IPv6 ENETUNREACH errors
          auth: {
            user: config.get<string>('MAIL_USERNAME'),
            pass: config.get<string>('MAIL_PASSWORD'),
          },
        } as import('nodemailer/lib/smtp-transport').Options,
        defaults: {
          from: config.get<string>('MAIL_FROM_ADDRESS') || 'No Reply',
        },
        template: {
          dir: path.join(process.cwd(), 'src', 'email', 'templates'),

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
