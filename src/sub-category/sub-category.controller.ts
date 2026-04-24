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
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('sub-category')
  @Post()
  create(
    @Body() createSubCategoryDto: CreateSubCategoryDto,
  ) {
    return this.SubCategoryService.create(createSubCategoryDto);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @Roles(roles.ADMIN, roles.MANAGER, roles.USER)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @ClearCache('sub-category')
  @Delete(':id')
  remove(@Param() idParamDto: IdParamDto) {
    return this.SubCategoryService.remove(idParamDto);
  }
}
