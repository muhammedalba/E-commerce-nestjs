import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Put,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { DeviceTokensService } from './device-tokens.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/device-token.dto';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: JwtPayload;
}

/** The mobile app registers its FCM token here to receive pushes. */
@Controller('push/devices')
@UseGuards(AuthGuard)
export class PushDevicesController {
  constructor(
    private readonly deviceTokens: DeviceTokensService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * Registers this install's FCM token for the signed-in session. Call it
   * after login, on every app start, and whenever FCM rotates the token.
   */
  @Put()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async register(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterDeviceDto,
  ) {
    const { user_id, sid } = req.user;
    // Tokens issued before sessions existed carry no `sid`; a fresh login does.
    if (!sid) {
      throw new UnauthorizedException(
        this.i18n.translate('exception.TOKEN_INVALID'),
      );
    }
    await this.deviceTokens.register(user_id, sid, {
      token: dto.token,
      platform: dto.platform,
      lang: dto.lang ?? (this.i18n.getLang() === 'en' ? 'en' : 'ar'),
      appVersion: dto.appVersion,
    });
    return { message: this.i18n.translate('success.DEVICE_REGISTERED') };
  }

  /** Stops pushes to this install (e.g. the user turned notifications off). */
  @Delete()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async unregister(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UnregisterDeviceDto,
  ) {
    await this.deviceTokens.unregister(req.user.user_id, dto.token);
    return { message: this.i18n.translate('success.DEVICE_UNREGISTERED') };
  }
}
