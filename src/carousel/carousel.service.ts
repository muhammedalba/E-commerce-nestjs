import { Injectable } from '@nestjs/common';
import { CreateCarouselDto } from './shared/dto/create-carousel.dto';
import { UpdateCarouselDto } from './shared/dto/update-carousel.dto';
import { BaseService } from 'src/shared/utils/service/base.service';
import { Carousel, CarouselDocument } from './shared/schemas/carousel.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';

@Injectable()
export class CarouselService extends BaseService<CarouselDocument> {
  constructor(
    @InjectModel(Carousel.name) private CarouselModel: Model<CarouselDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(CarouselModel, i18n, fileUploadService);
  }
  async create(
    createCarouselDto: CreateCarouselDto,
    file: MulterFile,
  ): Promise<any> {
    return await this.createOneDoc(createCarouselDto, file, 'carousel', {
      fileFieldName: 'image',
    });
  }

  async findAll(queryString: QueryString): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: Carousel[];
  }> {
    return await this.findAllDoc('brands', queryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async updateOne(
    idParamDto: IdParamDto,
    updateCarouselDto: UpdateCarouselDto,
    file: MulterFile,
  ): Promise<any> {
    const selectedFields = 'image';
    return await this.updateOneDoc(
      idParamDto,
      updateCarouselDto,
      file,
      'carousel',
      selectedFields,
      {
        fileFieldName: 'image',
      },
    );
  }
  async remove(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
