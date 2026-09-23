import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

// PEM keys are stored in env with literal "\n" — restore real newlines
const pem = (value: string) => value.replace(/\\n/g, '\n');

// ES256 (asymmetric): the API signs with the private key; the Next.js server
// only holds the public key, so it can verify tokens but never mint them.
export const JwtConfig = JwtModule.registerAsync({
  imports: [],
  useFactory: (configService: ConfigService) => ({
    privateKey: pem(configService.get<string>('JWT_PRIVATE_KEY')!),
    publicKey: pem(configService.get<string>('JWT_PUBLIC_KEY')!),
    signOptions: { algorithm: 'ES256' },
    verifyOptions: { algorithms: ['ES256'] },
  }),
  inject: [ConfigService],
  global: true,
});
