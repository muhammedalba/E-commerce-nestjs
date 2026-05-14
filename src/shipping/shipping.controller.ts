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
import { FileInterceptor } from '@nestjs/platform-express';
import { ShippingService } from './shipping.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
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

@Controller('shipping')
@UseInterceptors(ClearCacheInterceptor)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) { }

  /* ================================================ */
  /*  CALCULATE SHIPPING - Public                      */
  /* ================================================ */
  @Get('calculate')
  calculateShipping(
    @Query('cityId') cityId: string,
    @Query('weight') weight: string,
  ) {
    return this.shippingService.calculateShipping(
      cityId,
      parseFloat(weight) || 1,
    );
  }

  /* ================================================ */
  /*  GET PROVIDERS - Public                           */
  /* ================================================ */
  @Get('providers')
  getProviders(@Query() query: QueryString) {
    return this.shippingService.getProviders(query);
  }

  /* ================================================ */
  /*  GET ALL RATES - Admin                          */
  /* ================================================ */
  @Get('rates')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  getRates(@Query() query: QueryString) {
    return this.shippingService.getRates(query);
  }

  /* ================================================ */
  /*  GET RATES BY CITY - Public                       */
  /* ================================================ */
  @Get('rates/:cityId')
  getRatesByCity(@Param('cityId') cityId: string) {
    return this.shippingService.getRatesByCity(cityId);
  }

  /* ================================================ */
  /*  ADMIN ENDPOINTS                                  */
  /* ================================================ */
  @Post('providers')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  createRate(@Body() body: CreateShippingRateDto) {
    return this.shippingService.createRate(body);
  }

  @Patch('rates/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  updateRate(@Param() { id }: IdParamDto, @Body() body: UpdateShippingRateDto) {
    return this.shippingService.updateRate(id, body);
  }

  @Delete('providers/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  deleteProvider(@Param() { id }: IdParamDto) {
    return this.shippingService.deleteProvider(id);
  }

  @Delete('rates/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  deleteRate(@Param() { id }: IdParamDto) {
    return this.shippingService.deleteRate(id);
  }
}
