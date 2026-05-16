import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { CacheTTL } from '@nestjs/cache-manager';
import { PromoBannerService } from './promo-banner.service';
import { PromoBanner } from './shared/schema/promo-banner.schema';
import { PromoBannerDto } from './shared/dto/promo-banner.dto';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { UpdatePromoBannerDto } from './shared/dto/updatepromo_banner.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('promo-banner')
@UseInterceptors(ClearCacheInterceptor)
export class PromoBannerController {
  constructor(private readonly promoBannerService: PromoBannerService) {}

  // ------------------------------------------------------
  // ---------------- get active banners ------------------
  // ------------------------------------------------------
  @Get('active')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async getActiveBanner(): Promise<any> {
    return await this.promoBannerService.getActiveBanner();
  }

  // ------------------------------------------------------
  // ---------------- get all banners ----------------------
  // ------------------------------------------------------
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async getBanners(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
  ): Promise<{
    data: PromoBanner[];
    results: number;
    pagination: any;
  }> {
    const returnAllLangs = allLangs == 'true';
    return await this.promoBannerService.findAllDoc(
      queryString,
      returnAllLangs,
    );
  }

  // ------------------------------------------------------
  // ---------------- get banner by id ----------------------
  // ------------------------------------------------------

  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async getBanner(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ): Promise<any> {
    const returnAllLangs = allLangs == 'true';
    return await this.promoBannerService.getBanner(
      idParamDto.id,
      returnAllLangs,
    );
  }

  // ------------------------------------------------------
  // ---------------- create banner -----------------------
  // ------------------------------------------------------

  @Post()
  @RequirePermission(Permissions.MANAGE_PROMO_BANNERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('promo-banner')
  async createBanner(
    @Body() promoBannerDto: PromoBannerDto,
  ): Promise<{ data: PromoBanner }> {
    return await this.promoBannerService.createBanner(promoBannerDto);
  }

  // -------------------------------------------------------
  // ---------------- update banner -----------------------
  // ------------------------------------------------------

  @Patch(':id')
  @RequirePermission(Permissions.MANAGE_PROMO_BANNERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('promo-banner')
  async update(
    @Param() idParamDto: IdParamDto,
    @Body() updatePromoBannerDto: UpdatePromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    return await this.promoBannerService.update(
      idParamDto.id,
      updatePromoBannerDto,
    );
  }
  // ------------------------------------------------------
  // ---------------- delete banner ------------------
  // ------------------------------------------------------

  @Delete(':id')
  @RequirePermission(Permissions.MANAGE_PROMO_BANNERS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('promo-banner')
  async deleteBanner(@Param() idParamDto: IdParamDto) {
    return await this.promoBannerService.deleteBanner(idParamDto.id);
  }
}
