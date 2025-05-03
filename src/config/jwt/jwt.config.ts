import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const JwtConfig = JwtModule.registerAsync({
  imports: [],
  useFactory: (configService: ConfigService) => ({
    secret: configService.get('jwt_Access_hToken_secret'),
  }),
  inject: [ConfigService],
  global: true,
});
