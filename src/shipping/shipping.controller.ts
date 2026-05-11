import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ShippingService } from './shipping.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('shipping')
@UseInterceptors(ClearCacheInterceptor)
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

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
  getProviders() {
    return this.shippingService.getProviders();
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
  createProvider(@Body() body: any) {
    return this.shippingService.createProvider(body);
  }

  @Patch('providers/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  updateProvider(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.shippingService.updateProvider(id, body);
  }

  @Post('rates')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  createRate(@Body() body: any) {
    return this.shippingService.createRate(body);
  }

  @Patch('rates/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('shipping')
  updateRate(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.shippingService.updateRate(id, body);
  }
}
