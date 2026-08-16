import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetCodeDto } from '../dto/reset-code.dto';
import { LoginUserDto } from '../dto/login-user.dto';
import { TokenService } from 'src/auth/shared/services/token.service';
import { User } from '../schema/user.schema';
import { Role } from 'src/roles/shared/schemas/role.schema';

/**
 * Coordinates the email-based password reset workflow.
 *
 * @description The current implementation is a three-step flow:
 * request a reset code, verify the code, then submit a new password. The reset
 * code is stored as a SHA-256 hash and delivered asynchronously through BullMQ.
 *
 * @security Password hashing is handled by the `UserSchema` `pre('save')` hook
 * when the new password is assigned. Reset state is stored on the user document
 * via `passwordResetCode`, `passwordResetExpires`, and `verificationCode`.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectQueue('mail-queue') private readonly mailQueue: Queue,
    private readonly tokenService: TokenService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * Starts a password reset request for a known active user.
   *
   * @description Finds the account by email, enforces a 10-minute per-user email
   * cooldown, generates a six-digit reset code, stores a SHA-256 hash of that code
   * with a 10-minute expiry, and queues the email delivery job.
   *
   * @security The raw reset code is only sent to the mail queue and is not stored
   * in the database. If queueing fails, reset fields are cleared to avoid leaving
   * a valid code that the user never received.
   *
   * @param forgotPasswordDto - Validated payload containing the account email.
   * @returns A success status and localized message after the email job is queued.
   * @throws {BadRequestException} If the account is missing, blocked, or still in cooldown.
   * @throws {BadGatewayException} If the reset email job cannot be queued.
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    // 1 ) get user by email
    const user = await this.userModel
      .findOne({
        email: forgotPasswordDto.email,
      })
      .select(
        'email name passwordResetCode passwordResetExpires verificationCode   lastEmailAttemptAt isActive',
      )
      .exec();
    if (!user) {
      throw new BadRequestException(
        this.i18n.translate('exception.USER_NOT_FOUND', {
          args: { variable: 'email' },
        }),
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        this.i18n.translate('exception.ACCOUNT_BLOCKED'),
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
      await this.mailQueue.add('send-random-code', {
        email: user.email,
        name: user.name,
        code: resetCode.toString(),
        subject: this.i18n.translate('email.VERIFY_CODE_SUBJECT'),
        lang: this.i18n.getLang(),
      });
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

  /**
   * Verifies a submitted password-reset code.
   *
   * @description Hashes the submitted six-digit code, finds a user with a matching
   * non-expired reset-code hash, and marks the reset state as verified.
   *
   * @security This method does not return the matched user and does not expose the
   * stored reset hash. The verification flag is consumed later by `resetPassword`.
   *
   * @param resetCode - Validated reset-code payload.
   * @returns A success status and localized message when the code is valid.
   * @throws {BadRequestException} If the code is invalid or expired.
   */
  async verify_Pass_Reset_Code(resetCode: ResetCodeDto) {
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

  /**
   * Completes a verified password reset and issues a temporary access token.
   *
   * @description Finds the user by email, checks that the reset flow was verified
   * and not expired, stores the new password through the Mongoose hashing hook,
   * clears reset fields, issues a short-lived access token, and queues a success
   * notification email.
   *
   * @security Do not bypass the schema hook when changing this method; assigning
   * `user.password` followed by `save()` is what guarantees hashing here.
   *
   * @param LoginUserDto - Validated email and replacement password payload.
   * @returns A success status, localized message, and access token.
   * @throws {BadRequestException} If the user is missing or reset verification expired.
   * @throws {BadGatewayException} If the success email job cannot be queued.
   */
  async resetPassword(LoginUserDto: LoginUserDto) {
    // 1) get user by email
    const user = await this.userModel
      .findOne({ email: LoginUserDto.email })
      .select('email avatar role verificationCode passwordResetExpires')
      .populate('role')
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
    const roleObj = user.role as Role;
    const userId = {
      user_id: user._id.toString(),
      role: roleObj?.name || 'User',
      level: roleObj?.level || 0,
      email: user.email,
      permissions: roleObj?.permissions || [],
    };
    const Tokens = await this.tokenService.generate_Tokens(userId, '5h');
    // 5) send email to user
    try {
      await this.mailQueue.add('send-reset-success', {
        email: user.email,
        name: user.name,
        supportLink: `${process.env.CLIENT_URL}/login`,
        loginLink: `${process.env.CLIENT_URL}/login`,
        message: this.i18n.translate('success.SUCCESS_RESET_PASSWORD'),
        lang: this.i18n.getLang(),
      });
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
