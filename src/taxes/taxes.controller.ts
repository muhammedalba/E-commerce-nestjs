import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { TaxesService } from './taxes.service';
import { CreateTaxDto, UpdateTaxDto } from './shared/dto/tax.dto';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Controller('taxes')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
@UseInterceptors(ClearCacheInterceptor)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  /* ================================================ */
  /*  GET ALL TAXES - Admin Only                       */
  /* ================================================ */
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(3600000) // 1 hour
  findAll(@Query() queryString: QueryString) {
    return this.taxesService.findAll(queryString);
  }

  /* ================================================ */
  /*  CREATE TAX - Admin Only                          */
  /* ================================================ */
  @Post()
  @ClearCache('taxes')
  create(@Body() createTaxDto: CreateTaxDto) {
    return this.taxesService.create(createTaxDto);
  }

  /* ================================================ */
  /*  UPDATE TAX - Admin Only                          */
  /* ================================================ */
  @Patch(':id')
  @ClearCache('taxes')
  update(@Param() id: IdParamDto, @Body() updateTaxDto: UpdateTaxDto) {
    return this.taxesService.update(id, updateTaxDto);
  }

  /* ================================================ */
  /*  DELETE TAX - Admin Only                          */
  /* ================================================ */
  @Delete(':id')
  @ClearCache('taxes')
  remove(@Param() id: IdParamDto) {
    return this.taxesService.remove(id);
  }
}
