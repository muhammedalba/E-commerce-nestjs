import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { LocationsService } from './locations.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('locations')
@UseInterceptors(ClearCacheInterceptor)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /* ================================================ */
  /*  COUNTRIES                                        */
  /* ================================================ */
  @Get('countries')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(86400000) // 24 hours
  getCountries() {
    return this.locationsService.getCountries();
  }

  @Post('countries')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  createCountry(@Body() body: any) {
    return this.locationsService.createCountry(body);
  }

  @Patch('countries/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  updateCountry(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.locationsService.updateCountry(id, body);
  }

  /* ================================================ */
  /*  REGIONS - بحسب الدولة                           */
  /* ================================================ */
  @Get('regions/:countryId')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(86400000) // 24 hours
  getRegions(@Param('countryId') countryId: string) {
    return this.locationsService.getRegionsByCountry(countryId);
  }

  @Post('regions')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  createRegion(@Body() body: any) {
    return this.locationsService.createRegion(body);
  }

  @Patch('regions/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  updateRegion(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.locationsService.updateRegion(id, body);
  }

  /* ================================================ */
  /*  CITIES - بحسب المنطقة                           */
  /* ================================================ */
  @Get('cities/:regionId')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(86400000) // 24 hours
  getCities(@Param('regionId') regionId: string) {
    return this.locationsService.getCitiesByRegion(regionId);
  }

  @Get('cities/detail/:id')
  getCityById(@Param() { id }: IdParamDto) {
    return this.locationsService.getCityById(id);
  }

  @Post('cities')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  createCity(@Body() body: any) {
    return this.locationsService.createCity(body);
  }

  @Patch('cities/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  updateCity(@Param() { id }: IdParamDto, @Body() body: any) {
    return this.locationsService.updateCity(id, body);
  }
}
