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
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { CategoriesService } from './categories.service';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Get('statistics')
  async Categories_statistics() {
    return await this.categoryService.Categories_statistics();
  }
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

  @Get()
  async findAll(@Query() queryString: QueryString) {
    return await this.categoryService.findAll(queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.findOne(idParamDto);
  }
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
  @Roles(roles.ADMIN)
  @UseGuards(AuthGuard, RoleGuard)
  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.deleteOne(idParamDto);
  }
}
