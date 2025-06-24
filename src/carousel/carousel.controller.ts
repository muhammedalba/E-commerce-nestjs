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
  UploadedFiles,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { CarouselService } from './carousel.service';
import { CreateCarouselDto } from './shared/dto/create-carousel.dto';
import { UpdateCarouselDto } from './shared/dto/update-carousel.dto';

import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { ParseFileFieldsPipe } from 'src/shared/files/ParseFileFieldsPipe';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/auth/shared/decorators/rolesdecorator';
import { roles } from 'src/auth/shared/enums/role.enum';
import { RoleGuard } from 'src/auth/shared/guards/role.guard';
import { AuthGuard } from 'src/auth/shared/guards/auth.guard';
import { Request } from 'express';
import { MaxFileCount } from 'src/shared/files/constants/file-count.constants';
type file = Request['file'];
@Controller('carousel')
@Roles(roles.ADMIN)
@UseGuards(AuthGuard, RoleGuard)
export class CarouselController {
  constructor(private readonly carouselService: CarouselService) {}

  static readonly imageSize = [
    { name: 'carouselSm', maxCount: MaxFileCount.CAROUSEl },
    { name: 'carouselMd', maxCount: MaxFileCount.CAROUSEl },
    { name: 'carouselLg', maxCount: MaxFileCount.CAROUSEl },
  ];
  @Post()
  @UseInterceptors(FileFieldsInterceptor(CarouselController.imageSize))
  async create(
    @Body()
    createCarouselDto: CreateCarouselDto,
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp'],
        [
          { name: 'carouselLg', required: true },
          { name: 'carouselMd', required: true },
          { name: 'carouselSm', required: true },
        ],
      ),
    )
    files: {
      carouselLg: file;
      carouselMd: file;
      carouselSm: file;
    },
  ) {
    if (!files.carouselLg || !files.carouselMd || !files.carouselSm) {
      throw new BadRequestException('All carousel images are required.');
    }
    return await this.carouselService.createCarousel(createCarouselDto, {
      carouselLg: files.carouselLg,
      carouselMd: files.carouselMd,
      carouselSm: files.carouselSm,
    });
  }
  @Get()
  @Roles(roles.USER, roles.ADMIN, roles.MANAGER)
  async findAll(@Query() queryString: QueryString) {
    return await this.carouselService.findAll(queryString);
  }

  @Get(':id')
  async findOne(@Param() idParamDto: IdParamDto) {
    return await this.carouselService.findOne(idParamDto);
  }

  @Patch(':id')
  @UseInterceptors(FileFieldsInterceptor(CarouselController.imageSize))
  async update(
    @UploadedFiles(
      new ParseFileFieldsPipe(
        '1MB',
        ['png', 'jpeg', 'webp'],
        [
          { name: 'carouselLg', required: false },
          { name: 'carouselMd', required: false },
          { name: 'carouselSm', required: false },
        ],
      ),
    )
    files: {
      carouselLg?: MulterFileType;
      carouselMd?: MulterFileType;
      carouselSm?: MulterFileType;
    },
    @Param() idParamDto: IdParamDto,
    @Body() updateCarouselDto: UpdateCarouselDto,
  ): Promise<any> {
    return await this.carouselService.updateOne(
      idParamDto,
      updateCarouselDto,
      files,
    );
  }

  @Delete(':id')
  async remove(@Param() idParamDto: IdParamDto): Promise<void> {
    return await this.carouselService.remove(idParamDto);
  }
}
