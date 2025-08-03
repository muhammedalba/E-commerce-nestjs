import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { RefreshToken } from 'src/auth/shared/schema/refresh-token.schema';
import { JwtPayload } from '../types/jwt-payload.interface';

@Injectable()
export class tokenService {
  constructor(
    @InjectModel(RefreshToken.name)
    private RefreshTokenModel: Model<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly i18n: CustomI18nService,
  ) {}

  // --- generate new access tokens and delete old refresh token --- //
  async generate_Tokens(userData: JwtPayload, expiresIn: string) {
    // 1) generate new access token
    const access_token = await this.jwtService.signAsync(userData, {
      expiresIn: expiresIn,
    });
    //2) generate new refresh token
    const refresh_Token = uuidv4();
    // save refresh token in database
    await this.store_Refresh_Token(userData.user_id, refresh_Token);

    return { access_token, refresh_Token };
  }

  // delete old refresh token and save new refresh token in date base
  async store_Refresh_Token(userId: string, refresh_Token: string) {
    //1) delete old refresh token from database
    await this.RefreshTokenModel.findOneAndDelete({
      userId: userId,
    })
      .select('userId')
      .lean()
      .exec();

    //2) add expiry date to refresh token
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 3);

    //3) save refresh token in database
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
