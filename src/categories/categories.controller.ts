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
} from '@nestjs/common';
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { CategoriesService } from './categories.service';
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoryService: CategoriesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], false))
    file: MulterFile,
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

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFile,
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
