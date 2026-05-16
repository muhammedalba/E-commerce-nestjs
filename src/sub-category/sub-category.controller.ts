import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { SubCategoryService } from './sub-category.service';
import { CreateSubCategoryDto } from './shared/dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './shared/dto/update-sub-category.dto';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('sub-category')
@UseInterceptors(ClearCacheInterceptor)
export class SubCategoryController {
  constructor(private readonly SubCategoryService: SubCategoryService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  CREATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  @RequirePermission(Permissions.MANAGE_CATEGORIES)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('sub-category')
  @Post()
  create(@Body() createSubCategoryDto: CreateSubCategoryDto) {
    return this.SubCategoryService.create(createSubCategoryDto);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findAll(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return this.SubCategoryService.findAll(queryString, returnAllLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES STATISTICS ====== ---------- //
  // ------------ =============================== ---------- //
  @RequirePermission(Permissions.MANAGE_CATEGORIES)
  @UseGuards(AuthGuard, PermissionsGuard)
  @Get('statistics')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  findStatistics() {
    return this.SubCategoryService.findStatistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET SUP CATEGORY BY ID  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  findOne(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return this.SubCategoryService.findOne(idParamDto, returnAllLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  @RequirePermission(Permissions.MANAGE_CATEGORIES)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('sub-category')
  @Patch(':id')
  update(
    @Param() idParamDto: IdParamDto,
    @Body() updateSubCategoryDto: UpdateSubCategoryDto,
  ) {
    return this.SubCategoryService.update(idParamDto, updateSubCategoryDto);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  DELETE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  @RequirePermission(Permissions.MANAGE_CATEGORIES)
  @UseGuards(AuthGuard, PermissionsGuard)
  @ClearCache('sub-category')
  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.SubCategoryService.remove(idParamDto);
  }
}
