import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CreateCarouselDto } from './shared/dto/create-carousel.dto';
import { UpdateCarouselDto } from './shared/dto/update-carousel.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { createParseFilePipe } from 'src/shared/files/files-validation-factory';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';

@Controller('carousel')
export class CarouselController {
  constructor(private readonly carouselService: CarouselService) {}

  @Post()
  @UseInterceptors(FileInterceptor('image'))
  async create(
    @Body()
    createCarouselDto: CreateCarouselDto,
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp'], true))
    file: MulterFile,
  ): Promise<any> {
    return await this.carouselService.create(createCarouselDto, file);
  }

  @Get()
  async findAll(@Query() queryString: QueryString) {
    return await this.carouselService.findAll(queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.carouselService.findOne(idParamDto);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('image'))
  async update(
    @UploadedFile(createParseFilePipe('1MB', ['png', 'jpeg', 'webp']))
    file: MulterFile,
    @Param() idParamDto: IdParamDto,
    @Body() updateCarouselDto: UpdateCarouselDto,
  ): Promise<any> {
    return await this.carouselService.updateOne(
      idParamDto,
      updateCarouselDto,
      file,
    );
  }

  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto): Promise<void> {
    return await this.carouselService.remove(idParamDto);
  }
}
