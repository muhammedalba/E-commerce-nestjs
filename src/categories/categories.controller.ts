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
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

  @Get('Statistics')
  async Categories_statistics() {
    return await this.categoryService.Categories_statistics();
  }
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
  @Roles(roles.ADMIN, roles.MANAGER, roles.USER)
  async findAll(@Query() queryString: QueryString) {
    return await this.categoryService.findAll(queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.findOne(idParamDto);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
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

  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.categoryService.deleteOne(idParamDto);
  }
}
