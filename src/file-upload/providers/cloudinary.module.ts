import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Injection token for the initialized Cloudinary SDK instance.
 * Use this token with @Inject(CLOUDINARY_CONNECTION) to receive the configured instance.
 */
export const CLOUDINARY_CONNECTION = 'CLOUDINARY_CONNECTION';

/**
 * Global module responsible for initializing and exporting the Cloudinary SDK connection.
 *
 * Configured once during application bootstrap using NestJS factory provider.
 * Marked as @Global so all modules can inject the connection without explicitly importing this module.
 */
@Global()
@Module({
  providers: [
    {
      provide: CLOUDINARY_CONNECTION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): typeof cloudinary => {
        const logger = new Logger('CloudinaryModule');

        const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const apiKey = configService.get<string>('CLOUDINARY_API_KEY');
        const apiSecret = configService.get<string>('CLOUDINARY_API_SECRET');

        if (!cloudName || !apiKey || !apiSecret) {
          logger.warn(
            'Cloudinary credentials are missing — SDK not configured. Upload operations will fail.',
          );
          return cloudinary;
        }

        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true,
        });

        logger.log('Cloudinary SDK initialized successfully.');
        return cloudinary;
      },
    },
  ],
  exports: [CLOUDINARY_CONNECTION],
})
export class CloudinaryModule {}
