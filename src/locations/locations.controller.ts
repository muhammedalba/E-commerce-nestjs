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
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  createCountry(@Body() body: CreateCountryDto) {
    return this.locationsService.createCountry(body);
  }

  @Patch('countries/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  createRegion(@Body() body: CreateRegionDto) {
    return this.locationsService.createRegion(body);
  }

  @Patch('regions/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  createCity(@Body() body: CreateCityDto) {
    return this.locationsService.createCity(body);
  }

  @Patch('cities/:id')
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('locations')
  updateCity(@Param() { id }: IdParamDto, @Body() body: UpdateCityDto) {
    return this.locationsService.updateCity(id, body);
  }
}
