import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

export const MongooseConfig = MongooseModule.forRootAsync({
  useFactory: (configService: ConfigService) => {
    const uri = configService.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error(
        'MONGODB_URI is not defined in the environment variables',
      );
    }
    return {
      uri,
      dbName: 'driv',
    };
  },
  inject: [ConfigService],
});
