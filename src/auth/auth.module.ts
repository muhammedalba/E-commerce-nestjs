import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { FileUploadDiskStorageModule } from 'src/file-upload-in-diskStorage/file-upload.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RefreshToken,
  refreshTokenSchema,
} from './shared/schema/refresh-token.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { EmailModule } from 'src/email/email.module';
import { CookieService } from './shared/services/cookie.service';
import { PasswordResetService } from './shared/services/password-reset.service';
import { userProfileService } from './shared/services/user-profile.service';
import { tokenService } from 'src/auth/shared/services/token.service';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategy } from './oauth2/strategy/google.strategy';
import { googleService } from './oauth2/services/google.service';
import { FacebookStrategy } from './oauth2/strategy/facebook.strategy';
import { FacebookAuthGuard } from './oauth2/guards/facebook-auth.guard';
import { facebookService } from './oauth2/services/facebook.service';
import { User, UserSchema } from './shared/schema/user.schema';

@Module({
  imports: [
    FileUploadDiskStorageModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: refreshTokenSchema },
    ]),
    EmailModule,
    PassportModule,
  ],

  exports: [
    // AuthService
    MongooseModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomI18nService,
    PasswordResetService,
    CookieService,
    tokenService,
    userProfileService,
    GoogleStrategy,
    googleService,
    FacebookStrategy,
    FacebookAuthGuard,
    facebookService,
  ],
})
export class AuthModule {}
