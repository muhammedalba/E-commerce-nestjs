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
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';

@Controller('brands')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createBrandDto: CreateBrandDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFile,
  ): Promise<any> {
    return await this.brandsService.create(createBrandDto, file);
  }
  @Get()
  @Roles(roles.USER, roles.ADMIN, roles.MANAGER)
  async findAll(@Query() queryString: QueryString) {
    return await this.brandsService.findAll(queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.findOne(idParamDto);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async updateBrand(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFile,
    @Param() idParamDto: IdParamDto,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<any> {
    return await this.brandsService.updateBrand(
      idParamDto,
      updateBrandDto,
      file,
    );
  }

  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.deleteOne(idParamDto);
  }
}
