import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './shared/dto/create-brand.dto';
import { UpdateBrandDto } from './shared/dto/update-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { RequirePermission } from 'src/roles/shared/decorators/require-permission.decorator';
import { Permissions } from 'src/roles/shared/enums/permissions.enum';
import { PermissionsGuard } from 'src/roles/shared/guards/permissions.guard';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { CustomCacheInterceptor } from 'src/shared/interceptors/custom-cache.interceptor';
import { ClearCacheInterceptor } from 'src/shared/interceptors/clear-cache.interceptor';
import { ClearCache } from 'src/shared/decorators/clear-cache.decorator';

@Controller('brands')
@UseInterceptors(ClearCacheInterceptor)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}
  // ------------ =============================== ---------- //
  // ------------ ======  create brand   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @ClearCache('brands')
  @RequirePermission(Permissions.MANAGE_BRANDS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createBrandDto: CreateBrandDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFileType,
  ): Promise<any> {
    return await this.brandsService.create(createBrandDto, file);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  get all brands   ====== ---------- //
  // ------------ =============================== ---------- //
  @Get()
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findAll(
    @Query() queryString: QueryString,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return await this.brandsService.findAll(queryString, returnAllLangs);
  }
  // ------------ =============================== ---------- //
  // ------------ ====== get statistics brands  = ---------- //
  // ------------ =============================== ---------- //
  @Get('statistics')
  @RequirePermission(Permissions.MANAGE_BRANDS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(300000) // 5 minutes
  async BrandsStatistics() {
    return await this.brandsService.BrandsStatistics();
  }
  // ------------ =============================== ---------- //
  // ------------ ======  get brand by id  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
  @UseInterceptors(CustomCacheInterceptor)
  @CacheTTL(60000) // 60 seconds
  async findOne(
    @Param() idParamDto: IdParamDto,
    @Query('all_langs') allLangs?: string,
  ) {
    const returnAllLangs = allLangs === 'true';
    return await this.brandsService.findOne(idParamDto, returnAllLangs);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  update brand   ====== ---------- //
  // ------------ =============================== ---------- //
  @Patch(':id')
  @ClearCache('brands')
  @RequirePermission(Permissions.MANAGE_BRANDS)
  @UseGuards(AuthGuard, PermissionsGuard)
  @UseInterceptors(FileInterceptor('image'))
  async updateBrand(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFileType,
    @Param() idParamDto: IdParamDto,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<any> {
    return await this.brandsService.updateBrand(
      idParamDto,
      updateBrandDto,
      file,
    );
  }
  // ------------ =============================== ---------- //
  // ------------ ======  delete brand   ====== ---------- //
  // ------------ =============================== ---------- //
  @Delete(':id')
  @ClearCache('brands')
  @RequirePermission(Permissions.MANAGE_BRANDS)
  @UseGuards(AuthGuard, PermissionsGuard)
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.deleteOne(idParamDto);
  }
}
