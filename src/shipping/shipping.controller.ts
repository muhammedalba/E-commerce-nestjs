import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import { ShippingService } from './shipping.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import {
  CreateShippingProviderDto,
  UpdateShippingProviderDto,
} from './shared/dto/shipping-provider.dto';
import {
  CreateShippingRateDto,
  UpdateShippingRateDto,
} from './shared/dto/shipping-rate.dto';

import { ShippingRatesService } from './shipping-rates.service';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';

@Controller('shipping')
@UseInterceptors(ClearCacheInterceptor, CustomCacheInterceptor)
export class ShippingController {
  constructor(
    private readonly shippingService: ShippingService,
    private readonly shippingRatesService: ShippingRatesService,
  ) {}

  /* ================================================ */
  /*  CALCULATE SHIPPING - Public                      */
  /* ================================================ */
  @Get('calculate')
  @CacheTTL(3600000)
  calculateShipping(
    @Query('cityId') cityId: string,
    @Query('weight') weight: string,
  ) {
    return this.shippingRatesService.calculateShipping(
      cityId,
      parseFloat(weight) || 1,
    );
  }

  /* ================================================ */
  /*  GET PROVIDERS - Public                           */
  /* ================================================ */
  @Get('providers')
  @CacheTTL(3600000)
  getProviders(@Query() query: QueryString) {
    return this.shippingService.getProviders(query);
  }

  /* ================================================ */
  /*  GET ALL RATES - Admin                          */
  /* ================================================ */
  @Get('rates')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @CacheTTL(3600000)
  getRates(@Query() query: QueryString) {
    return this.shippingRatesService.getRates(query);
  }

  /* ================================================ */
  /*  GET RATES BY CITY - Public                       */
  /* ================================================ */
  @Get('rates/:cityId')
  @CacheTTL(3600000)
  getRatesByCity(@Param('cityId') cityId: string) {
    return this.shippingRatesService.getRatesByCity(cityId);
  }

  /* ================================================ */
  /*  ADMIN ENDPOINTS                                  */
  /* ================================================ */
  @Post('providers')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('shipping')
  @UseInterceptors(FileInterceptor('logo'))
  createProvider(
    @Body() body: CreateShippingProviderDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.shippingService.createProvider(body, file);
  }

  @Patch('providers/:id')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('shipping')
  @UseInterceptors(FileInterceptor('logo'))
  updateProvider(
    @Param() { id }: IdParamDto,
    @Body() body: UpdateShippingProviderDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ) {
    return this.shippingService.updateProvider(id, body, file);
  }

  @Post('rates')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('shipping')
  createRate(@Body() body: CreateShippingRateDto) {
    return this.shippingRatesService.createRate(body);
  }

  @Patch('rates/:id')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('shipping')
  updateRate(@Param() { id }: IdParamDto, @Body() body: UpdateShippingRateDto) {
    return this.shippingRatesService.updateRate(id, body);
  }

  @Delete('providers/:id')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('shipping')
  deleteProvider(@Param() { id }: IdParamDto) {
    return this.shippingService.deleteProvider(id);
  }

  @Delete('rates/:id')
  @RequirePermission(Permissions.MANAGE_SHIPPING)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('shipping')
  deleteRate(@Param() { id }: IdParamDto) {
    return this.shippingRatesService.deleteRate(id);
  }
}
