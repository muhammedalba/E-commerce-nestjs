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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './shared/dto/create-brand.dto';
import { UpdateBrandDto } from './shared/dto/update-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { Roles } from 'src/auth/shared/decorators/roles.decorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}
  // ------------ =============================== ---------- //
  // ------------ ======  create brand   ====== ---------- //
  // ------------ =============================== ---------- //
  @Post()
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.USER, roles.ADMIN, roles.MANAGER)
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
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
  async BrandsStatistics() {
    return await this.brandsService.BrandsStatistics();
  }
  // ------------ =============================== ---------- //
  // ------------ ======  get brand by id  ====== ---------- //
  // ------------ =============================== ---------- //
  @Get(':id')
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
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
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
  @Roles(roles.ADMIN, roles.MANAGER)
  @UseGuards(AuthGuard, RoleGuard)
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.deleteOne(idParamDto);
  }
}
