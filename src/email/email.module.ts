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
          port: Number(config.get<string>('EMAIL_PORT')),
          secure: false,
          auth: {
            user: config.get<string>('MAIL_USERNAME'),
            pass: config.get<string>('MAIL_PASSWORD'),
          },
        },
        defaults: {
          from: config.get<string>('MAIL_FROM_ADDRESS') || 'No Reply',
        },
        template: {
          dir: path.join(process.cwd(), 'src', 'email', 'templates'),

          adapter: new HandlebarsAdapter(),

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
export class EmailModule { }
