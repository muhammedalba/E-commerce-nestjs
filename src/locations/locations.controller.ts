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
import { LocationsService } from './locations.service';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import {
  CreateCityDto,
  CreateCountryDto,
  CreateRegionDto,
  UpdateCityDto,
  UpdateCountryDto,
  UpdateRegionDto,
} from './shared/dto';

@Controller('locations')
@UseInterceptors(ClearCacheInterceptor)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /* ================================================ */
  /*  COUNTRIES                                        */
  /* ================================================ */
  @Get('countries')
  // Caching is handled at the service level (LocationsService) for better efficiency
  // as it provides a global cache shared across all users/languages.
  getCountries(@Query('isActive') isActive?: string) {
    const isActiveBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.locationsService.getCountries(isActiveBool);
  }

  @Post('countries')
  @RequirePermission(Permissions.MANAGE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('locations')
  createCountry(@Body() body: CreateCountryDto) {
    return this.locationsService.createCountry(body);
  }

  @Patch('countries/:id')
  @RequirePermission(Permissions.MANAGE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('locations')
  updateCountry(@Param() { id }: IdParamDto, @Body() body: UpdateCountryDto) {
    return this.locationsService.updateCountry(id, body);
  }

  /* ================================================ */
  /*  REGIONS - by Country                            */
  /* ================================================ */
  @Get('regions/:countryId')
  // Caching is handled at the service level to avoid per-user cache redundancy
  getRegions(
    @Param('countryId') countryId: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.locationsService.getRegionsByCountry(countryId, isActiveBool);
  }

  @Post('regions')
  @RequirePermission(Permissions.MANAGE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('locations')
  createRegion(@Body() body: CreateRegionDto) {
    return this.locationsService.createRegion(body);
  }

  @Patch('regions/:id')
  @RequirePermission(Permissions.MANAGE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('locations')
  updateRegion(@Param() { id }: IdParamDto, @Body() body: UpdateRegionDto) {
    return this.locationsService.updateRegion(id, body);
  }

  /* ================================================ */
  /*  CITIES - by Region                            */
  /* ================================================ */
  @Get('cities/:regionId')
  // Caching is handled at the service level
  getCities(
    @Param('regionId') regionId: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.locationsService.getCitiesByRegion(regionId, isActiveBool);
  }

  @Get('cities/detail/:id')
  getCityById(@Param() { id }: IdParamDto) {
    return this.locationsService.getCityById(id);
  }

  @Post('cities')
  @RequirePermission(Permissions.MANAGE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('locations')
  createCity(@Body() body: CreateCityDto) {
    return this.locationsService.createCity(body);
  }

  @Patch('cities/:id')
  @RequirePermission(Permissions.MANAGE_SETTINGS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('locations')
  updateCity(@Param() { id }: IdParamDto, @Body() body: UpdateCityDto) {
    return this.locationsService.updateCity(id, body);
  }
}
