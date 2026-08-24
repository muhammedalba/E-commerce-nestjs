import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  refreshTokenSchema,
} from './shared/schema/refresh-token.schema';
import { EmailModule } from 'src/email/email.module';
import { CookieService } from './shared/services/cookie.service';
import { PasswordResetService } from './shared/services/password-reset.service';
import { UserProfileService } from './shared/services/user-profile.service';
import { TokenService } from 'src/auth/shared/services/token.service';
import { AuthCredentialService } from './shared/services/auth-credential.service';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './oauth2/strategy/google.strategy';
import { GoogleService } from './oauth2/services/google.service';
import { FacebookStrategy } from './oauth2/strategy/facebook.strategy';
import { FacebookAuthGuard } from './oauth2/guards/facebook-auth.guard';
import { FacebookService } from './oauth2/services/facebook.service';
import { User, UserSchema } from './shared/schema/user.schema';
import { Role, RoleSchema } from 'src/roles/shared/schemas/role.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      { name: RefreshToken.name, schema: refreshTokenSchema },
    ]),
    EmailModule,
    PassportModule,
  ],

  exports: [AuthService, MongooseModule],
  controllers: [AuthController],
  providers: [
    AuthCredentialService,
    AuthService,
    PasswordResetService,
    CookieService,
    TokenService,
    UserProfileService,
    GoogleStrategy,
    GoogleService,
    FacebookStrategy,
    FacebookAuthGuard,
    FacebookService,
  ],
})
export class AuthModule {}
