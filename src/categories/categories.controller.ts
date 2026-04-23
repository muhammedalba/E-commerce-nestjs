import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CategoriesService } from './categories.service';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';

@Controller('categories')
@UseInterceptors(ClearCacheInterceptor)
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

  // ------------ =============================== ---------- //
  // ------------ ======  get statistics categories  = ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Get('statistics')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  async Categories_statistics() {
    return await this.categoryService.Categories_statistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  CREATE CATEGORY   ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    return await this.categoryService.create(createCategoryDto, file);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  get all categories   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findAll(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return await this.categoryService.findAll(queryString, returnAllLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  get category by id   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findOne(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return await this.categoryService.findOne(idParamDto, returnAllLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  update category   ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
    @Param() idParamDto: IdParamDto,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<any> {
    return await this.categoryService.update(
      idParamDto,
      updateCategoryDto,
      file,
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  delete category   ====== ---------- //
  // ------------ =============================== ---------- //
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.deleteOne(idParamDto);
  }
}
