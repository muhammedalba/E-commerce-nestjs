import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PromoBannerService } from './promo-banner.service';
import { PromoBanner } from './shared/schema/promo-banner.schema';
import { PromoBannerDto } from './shared/dto/promo-banner.dto';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { UpdatePromoBannerDto } from './shared/dto/updatepromo_banner.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Controller('promo-banner')
export class PromoBannerController {
  constructor(private readonly promoBannerService: PromoBannerService) {}

  @Get('active')
  async getActiveBanner(): Promise<any> {
    return await this.promoBannerService.getActiveBanner();
  }
  @Get()
  async getBanners(@Query() queryString: QueryString): Promise<{
    data: PromoBanner[];
    status: string;
    results: number;
    pagination: any;
  }> {
    return await this.promoBannerService.findAllDoc(queryString);
  }
  @Get(':id')
  async getBanner(@Param() idParamDto: IdParamDto): Promise<any> {
    return await this.promoBannerService.getBanner(idParamDto.id);
  }
  @Post()
  async createBanner(
    @Body() promoBannerDto: PromoBannerDto,
  ): Promise<{ data: PromoBanner; status: string }> {
    console.log(promoBannerDto);

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
