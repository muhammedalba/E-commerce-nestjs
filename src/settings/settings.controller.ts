import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './shared/dto/update-setting.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ParseBodyJsonInterceptor } from 'src/shared/interceptors/parse-body-json.interceptor';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { MulterFilesType } from 'src/shared/utils/interfaces/fileInterface';

@Controller('settings')
@UseInterceptors(ClearCacheInterceptor)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}
  private static readonly imageSize = [
    { name: 'favicon', maxCount: 1 },
    { name: 'logo', maxCount: 1 },
  ];
  /* ================================================ */
  /*  GET SETTINGS - Public (للجميع)                  */
  /* ================================================ */
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(3600000) // 1 hour
  async getSettings() {
    return await this.settingsService.getSettings();
  }

  /* ================================================ */
  /*  UPDATE SETTINGS - Admin Only (للإدمن فقط)       */
  /* ================================================ */
  @Patch()
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('settings')
  @UseInterceptors(
    FileFieldsInterceptor(SettingsController.imageSize),

    new ParseBodyJsonInterceptor([
      'metaTitle',
      'metaDescription',
      'siteName',
      'siteDescription',
      'footerText',
      'maintenanceMessage',
      'googleAnalyticsId',
      'maintenanceMode',
      'socialLinks',
      'contactInfo',
      'gateways',
      'features',
      'freeShippingThreshold',
      'vatRate',
      'minOrderAmount',
      'allowRegistration',
      'autoBackup',
      'taxesIncluded',
      'debugMode',
    ]),
  )
  async updateSettings(
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp', 'pdf'],
        [
          { name: 'favicon', required: false },
          { name: 'logo', required: false },
        ],
      ),
    )
    files: { favicon?: MulterFilesType; logo?: MulterFilesType },
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return await this.settingsService.updateSettings(updateSettingDto, files);
  }

  /* ================================================ */
  /*  CLEAR CACHE - Admin Only                        */
  /* ================================================ */
  @Patch('clear-cache')
  @RequirePermission(Permissions.UPDATE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async clearCache() {
    return await this.settingsService.clearCache();
  }
}
