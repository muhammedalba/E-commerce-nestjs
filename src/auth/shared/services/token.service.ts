import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { RefreshToken } from 'src/auth/shared/schema/refresh-token.schema';
import { JwtPayload } from '../types/jwt-payload.interface';

/**
 * Manages the lifecycle of JWT access tokens and opaque refresh tokens.
 *
 * @description This service is the **single source of truth** for token generation and storage.
 * It is used by {@link AuthCredentialService} (login/register/OAuth) and
 * {@link UserProfileService} (token rotation) to issue new token pairs.
 *
 * @security
 * - Refresh tokens are stored as plaintext UUIDs (v4) in the database with an expiry date.
 *   Each token is unique per-user per-session.
 * - A MongoDB TTL index on the `expiryDate` field automatically purges expired tokens,
 *   keeping the `refresh_tokens` collection clean without manual cleanup jobs.
 * - This service does NOT delete the old refresh token before saving the new one.
 *   Deletion of the consumed token is handled atomically by the caller
 *   ({@link UserProfileService.refreshToken}) using `findOneAndDelete`, enabling
 *   theft detection: if a token that was already consumed is presented again,
 *   the caller detects its absence and terminates the session.
 */
@Injectable()
export class TokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * Generates a new JWT access token and an opaque UUID refresh token, then persists
   * the refresh token to the database.
   *
   * @description Token generation contract:
   * - The **access token** is a signed JWT embedding `user_id`, `email`, `role`, `level`,
   *   and `permissions`. Its TTL is controlled by `JWT_EXPIRE_TIME` env variable (default: `1d`).
   * - The **refresh token** is a UUID v4 — a cryptographically random, opaque string
   *   with no embedded claims. It is persisted via {@link store_Refresh_Token}.
   *
   * @security
   * - The access token embeds user permissions. A permission change will not take effect
   *   until the token expires or the user triggers a token refresh.
   * - Callers are responsible for deleting the *old* refresh token before calling this method
   *   (or immediately after) to prevent token accumulation.
   *
   * @param userData - The JWT payload to embed in the access token (user_id, email, role, etc.).
   * @param expiresIn - Optional override for the access token TTL (e.g. `'15m'`).
   *                    Falls back to `JWT_EXPIRE_TIME` env variable, then `'1d'`.
   * @returns An object containing the signed `access_token` (JWT) and the raw `refresh_Token` (UUID).
   * @throws {InternalServerErrorException} If persisting the refresh token to the DB fails.
   */
  async generate_Tokens(userData: JwtPayload, expiresIn?: string) {
    // 1) generate new access token
    const access_token = await this.jwtService.signAsync(userData, {
      expiresIn: (expiresIn ||
        process.env.JWT_EXPIRE_TIME ||
        '1d') as `${number}d`,
    });
    //2) generate new refresh token
    const refresh_Token = uuidv4();
    // save refresh token in database
    await this.store_Refresh_Token(userData.user_id, refresh_Token);

    return { access_token, refresh_Token };
  }

  /**
   * Persists a new refresh token to the database for a given user.
   *
   * @description Saves the refresh token with an expiry date calculated from
   * `JWT_REFRESH_TOKEN_EXPIRE_TIME` env variable (in days, default: 5).
   *
   * @security
   * - This method does NOT delete any existing tokens for the user — it creates a new document.
   *   This is intentional: the old token must remain in the DB temporarily so that
   *   {@link UserProfileService.refreshToken} can detect theft by attempting `findOneAndDelete`
   *   on the consumed token. If the token is already gone (i.e. was already consumed), the
   *   caller knows the token was reused and can terminate the session.
   * - The MongoDB TTL index on `expiryDate` (set to `expires: '0s'`) ensures that expired
   *   tokens are automatically deleted by MongoDB's background TTL monitor, preventing
   *   unbounded growth of the collection.
   *
   * @param userId - The MongoDB ObjectId (as string) of the user who owns the token.
   * @param refresh_Token - The UUID v4 refresh token string to persist.
   * @throws {InternalServerErrorException} If the database insert fails (e.g. unique constraint violation or connection error).
   */
  async store_Refresh_Token(userId: string, refresh_Token: string) {
    //1) add expiry date to refresh token
    const expiryDate = new Date();
    expiryDate.setDate(
      expiryDate.getDate() +
        parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRE_TIME ?? '5'),
    ); // default: 5 days

    //2) save refresh token in database
    try {
      await this.RefreshTokenModel.create({
        refresh_Token: refresh_Token,
        userId: userId,
        expiryDate: expiryDate,
      });
    } catch {
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE', {
          args: { variable: 'refresh token' },
        }),
      );
    }
  }
}
