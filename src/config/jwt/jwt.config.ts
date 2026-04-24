import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const JwtConfig = JwtModule.registerAsync({
  imports: [],
  useFactory: (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET_KEY')!,
  }),
  inject: [ConfigService],
  global: true,
});
