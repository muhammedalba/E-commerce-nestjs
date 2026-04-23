import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { PromoBannerService } from './promo-banner.service';
import { PromoBanner } from './shared/schema/promo-banner.schema';
import { PromoBannerDto } from './shared/dto/promo-banner.dto';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { UpdatePromoBannerDto } from './shared/dto/updatepromo_banner.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';

@Controller('promo-banner')
@UseInterceptors(ClearCacheInterceptor)
export class PromoBannerController {
  constructor(private readonly promoBannerService: PromoBannerService) {}

  @Get('active')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async getActiveBanner(): Promise<any> {
    return await this.promoBannerService.getActiveBanner();
  }
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async getBanners(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
  ): Promise<{
    data: PromoBanner[];
    status: string;
    results: number;
    pagination: any;
  }> {
    const returnAllLangs = allLangs == 'true';
    return await this.promoBannerService.findAllDoc(
      queryString,
      returnAllLangs,
    );
  }
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
  @Post()
  async createBanner(
    @Body() promoBannerDto: PromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    return await this.promoBannerService.createBanner(promoBannerDto);
  }
  @Patch(':id')
  async update(
    @Param() idParamDto: IdParamDto,
    @Body() updatePromoBannerDto: UpdatePromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    return await this.promoBannerService.update(
      idParamDto.id,
      updatePromoBannerDto,
    );
  }

  @Delete(':id')
  async deleteBanner(@Param() idParamDto: IdParamDto) {
    return await this.promoBannerService.deleteBanner(idParamDto.id);
  }
}
