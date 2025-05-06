import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';

@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  create(
    @Body() createBrandDto: CreateBrandDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFile,
  ) {
    return this.brandsService.create(createBrandDto, file);
  }

  @Get()
  async findAll(@Query() queryString: QueryString) {
    return await this.brandsService.findAll(queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.findOne(idParamDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return `this.brandsService.update(+${id}, {updateBrandDto});`;
  }

  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto) {
    return await this.brandsService.deleteOne(idParamDto);
  }
}
