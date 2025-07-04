import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { EmailService } from 'src/email/email.service';
import { ForgotPasswordDto } from '../Dto/forgotPassword.dto.';
import { resetCodeDto } from '../Dto/resetCode.dto';
import { LoginUserDto } from '../Dto/login.dto';
import { tokenService } from 'src/auth/shared/services/token.service';
import { User } from '../schema/user.schema';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly emailService: EmailService,
    private readonly tokenService: tokenService,
    private readonly i18n: CustomI18nService,
  ) {}

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    // 1 ) get user by email
    const user = await this.userModel
      .findOne({
        email: forgotPasswordDto.email,
      })
      .select(
        'email name passwordResetCode passwordResetExpires verificationCode   lastEmailAttemptAt',
      )
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND', {
          args: { variable: 'email' },
        }),
      );
    }
    //1.1) Check if it has been 10 minutes since your last submission.
    const now = new Date();
    if (user.lastEmailAttemptAt) {
      const diffInMinutes =
        (now.getTime() - new Date(user.lastEmailAttemptAt).getTime()) / 60000;

      if (diffInMinutes < 10) {
        const minutesLeft = Math.ceil(10 - diffInMinutes);

        throw new BadRequestException(
          this.i18n.translate('exception.TOO_MANY_Attempts', {
            args: { minutesLeft },
          }),
        );
      }
    }

    // 2) generate hash reset random 6 digits and save it in db
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode)
      .digest('hex');
    // save hashed password reset code into db
    user.passwordResetCode = hashedResetCode;
    // add expiration time for password reset code (10 min)
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    user.verificationCode = false;
    user.lastEmailAttemptAt = now;
    await user.save();

    // 3 ) send email with code
    try {
      await this.emailService.sendRandomCode(
        user.email,
        user.name,
        resetCode.toString(),
        this.i18n.translate('email.VERIFY_CODE_SUBJECT'),
      );
    } catch {
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      user.verificationCode = undefined;
      user.lastEmailAttemptAt = undefined;
      await user.save();
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }

    // 4 ) save code in database
    await user.save();

    return {
      status: 'success',
      message: this.i18n.translate('success.RESET_CODE_SENDED'),
    };
  }

  async verify_Pass_Reset_Code(resetCode: resetCodeDto) {
    //1)  get user based on reset code
    const hashedResetCode = crypto
      .createHash('sha256')
      .update(resetCode.resetCode)
      .digest('hex');
    // 2) check if reset code is valid and not expired
    const user = await this.userModel
      .findOne({
        passwordResetCode: hashedResetCode,
        passwordResetExpires: { $gt: Date.now() },
      })
      .select('verificationCode')
      .exec();

    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.CODE_INCORRECT'),
      );
    }
    // 3) reset code is invalid
    user.verificationCode = true;

    await user.save();
    return {
      status: 'success',
      message: this.i18n.translate('success.RESET_CODE_VALID'),
    };
  }
  async resetPassword(LoginUserDto: LoginUserDto) {
    // 1) get user by email
    const user = await this.userModel
      .findOne({ email: LoginUserDto.email })
      .select('email avatar role verificationCode passwordResetExpires')
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND'),
      );
    }
    // 2) check if password reset code is valid and not expired
    if (
      !user.verificationCode ||
      (user.passwordResetExpires ?? 0) < Date.now()
    ) {
      throw new BadRequestException(
        this.i18n.translate('exception.CODE_EXPIRED'),
      );
    }
    // 3) save new password and  reset seatings
    user.password = LoginUserDto.password;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.verificationCode = undefined;
    await user.save();
    // 4) if everything is ok ,generate token
    const userId = {
      user_id: user._id.toString(),
      role: user.role || 'user',
      email: user.email,
    };
    const Tokens = await this.tokenService.generate_Tokens(userId, '1h');
    // 5) send email to user
    try {
      await this.emailService.send_reset_password_success(
        user.email,
        user.name,
        `${process.env.BASE_URL}/auth/login`,
        `${process.env.BASE_URL}/auth/login`,
        this.i18n.translate('success.SUCCESS_RESET_PASSWORD'),
      );
    } catch {
      throw new BadGatewayException(
        this.i18n.translate('exception.EMAIL_SEND_FAILED'),
      );
    }
    return {
      status: 'success',
      message: this.i18n.translate('success.SUCCESS_RESET_PASSWORD'),
      access_token: Tokens.access_token,
    };
  }
}
