import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { JwtPayload } from 'src/auth/shared/types/jwt-payload.interface';
import { DevicePlatform } from 'src/notifications/push/schemas/device-token.schema';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { AppVersionsService } from './app-versions.service';
import { CheckVersionDto } from './shared/dto/check-version.dto';
import { UpdateAppVersionDto } from './shared/dto/update-app-version.dto';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: JwtPayload;
}

const platformPipe = new ParseEnumPipe(DevicePlatform);

/**
 * Mobile app update policy.
 *
 * | Method | Route | Access | Description |
 * |--------|-------|--------|-------------|
 * | GET | `/app-versions/check` | Public | May / must this install update? |
 * | GET | `/app-versions` | Admin | Both platform policies |
 * | GET | `/app-versions/stats` | Admin | Installs per version |
 * | PATCH | `/app-versions/:platform` | Admin | Publish a version / raise the minimum |
 * | POST | `/app-versions/:platform/announce` | Admin | Push "new version" to the platform |
 */
@Controller('app-versions')
export class AppVersionsController {
  constructor(
    private readonly appVersions: AppVersionsService,
    private readonly i18n: CustomI18nService,
  ) {}

  /**
   * Called by the app on start and on resume. Stays reachable during
   * maintenance and for unsupported versions (it is how they learn why).
   *
   * @example GET /app-versions/check?platform=ios&version=1.2.0
   */
  @Get('check')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async check(@Query() dto: CheckVersionDto) {
    const lang = this.i18n.getLang() === 'en' ? 'en' : 'ar';
    return this.appVersions.check(dto.platform, dto.version, lang);
  }

  @Get()
  @RequirePermission(Permissions.VIEW_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async findAll() {
    return this.appVersions.getAllPolicies();
  }

  @Get('stats')
  @RequirePermission(Permissions.VIEW_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async stats() {
    return this.appVersions.stats();
  }

  /**
   * Raise `latestVersion` only once the build is live in that store, and
   * `minSupportedVersion` only once the required build is live there —
   * otherwise users are told to install a version they cannot download.
   */
  @Patch(':platform')
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async update(
    @Param('platform', platformPipe) platform: DevicePlatform,
    @Body() dto: UpdateAppVersionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.appVersions.updatePolicy(platform, dto, {
      userId: req.user.user_id,
      email: req.user.email,
      ipAddress: req.ip,
    });
    return { status: 'success', message: 'success.APP_VERSION_UPDATED', data };
  }

  @Post(':platform/announce')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @RequirePermission(Permissions.SEND_NOTIFICATION)
  @UseGuards(AuthGuard, PermissionsGuard)
  async announce(@Param('platform', platformPipe) platform: DevicePlatform) {
    await this.appVersions.announce(platform);
    return {
      status: 'success',
      message: 'success.APP_UPDATE_ANNOUNCED',
      data: null,
    };
  }
}
