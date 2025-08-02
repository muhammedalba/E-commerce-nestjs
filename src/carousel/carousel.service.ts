import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateCarouselDto } from './shared/dto/create-carousel.dto';
import { UpdateCarouselDto } from './shared/dto/update-carousel.dto';
import { BaseService } from 'src/shared/utils/service/base.service';
import { Carousel, CarouselDocument } from './shared/schemas/carousel.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { Request } from 'express';
type file = Request['file'];
@Injectable()
export class CarouselService extends BaseService<CarouselDocument> {
  constructor(
    @InjectModel(Carousel.name) private CarouselModel: Model<CarouselDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(CarouselModel, i18n, fileUploadService);
  }

  async createCarousel(
    createCarouselDto: CreateCarouselDto,
    files: {
      carouselSm: file;
      carouselMd: file;
      carouselLg: file;
    },
  ) {
    //1) check if the files is not empty
    const requiredKeys = ['carouselSm', 'carouselMd', 'carouselLg'] as const;

    for (const key of requiredKeys) {
      if (!files[key] || !files[key][0]) {
        throw new BadRequestException(`Image ${key} is required.`);
      }
    }

    try {
      //2) save files to disk
      const savedPaths = await Promise.all(
        requiredKeys.map((key) =>
          this.fileUploadService.saveFileToDisk(
            files[key]?.[0] as file,
            'carousel',
          ),
        ),
      );

      // 3) add the saved paths to the DTO
      [
        createCarouselDto.carouselSm,
        createCarouselDto.carouselMd,
        createCarouselDto.carouselLg,
      ] = savedPaths;

      //5) create the document in the database
      const newDoc = await this.CarouselModel.create(createCarouselDto);
      //6) add the base URL to the image paths
      const baseUrl = process.env.BASE_URL || '';
      newDoc.carouselSm = `${baseUrl}${createCarouselDto.carouselSm}`;
      newDoc.carouselMd = `${baseUrl}${createCarouselDto.carouselMd}`;
      newDoc.carouselLg = `${baseUrl}${createCarouselDto.carouselLg}`;

      //7) return the localized document
      return {
        status: 'success',
        message: this.i18n.translate('success.created_SUCCESS'),
        data: this.localize(newDoc),
      };
    } catch (error) {
      console.error('Error saving carousel:', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }
  }

  async findAll(queryString: QueryString): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: Carousel[];
  }> {
    return await this.findAllDoc('carousel', queryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async updateOne(
    idParamDto: IdParamDto,
    updateCarouselDto: UpdateCarouselDto,
    files: {
      carouselSm?: file;
      carouselMd?: file;
      carouselLg?: file;
    },
  ): Promise<any> {
    const { id } = idParamDto;

    // 1) check if the document exists
    const carousel = await this.CarouselModel.findById(id).select(
      'carouselMd carouselLg carouselSm',
    );
    if (!carousel) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const imageFields: (keyof typeof files)[] = [
      'carouselSm',
      'carouselMd',
      'carouselLg',
    ];

    try {
      for (const key of imageFields) {
        const file = (files[key]?.[0] as file) ?? null;
        if (file) {
          // save the new file to disk
          const newPath = await this.fileUploadService.saveFileToDisk(
            file,
            'carousel',
          );

          // delete the old file from disk
          const oldPath = carousel[key];
          if (oldPath) {
            await this.fileUploadService.deleteFile(`.${oldPath}`);
          }

          // update the DTO with the new path
          updateCarouselDto[key] = newPath;
        } else {
          // if no new file is provided, keep the old path
          updateCarouselDto[key] = carousel[key];
        }
      }
    } catch (error) {
      console.error('Error processing carousel images:', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    // update the document in the database
    const updatedDoc = await this.CarouselModel.findByIdAndUpdate(
      { _id: id },
      { $set: updateCarouselDto },
      { new: true, runValidators: true },
    );

    return {
      status: 'success',
      message: this.i18n.translate('success.updated_SUCCESS'),
      data: updatedDoc ? this.localize(updatedDoc) : [],
    };
  }

  async remove(idParamDto: IdParamDto): Promise<void> {
    const { id } = idParamDto;
    // 1) check if the document exists
    const carousel = await this.CarouselModel.findById(id).select(
      'carouselMd carouselLg carouselSm',
    );

    if (!carousel) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // 2) get the image paths
    const imagePaths = ['carouselSm', 'carouselMd', 'carouselLg']
      .map((key) => carousel[key as keyof typeof carousel] as string)
      .filter((path): path is string => typeof path === 'string');

    // 3 ) delete the images from disk
    try {
      await Promise.all(
        imagePaths.map((path) => this.fileUploadService.deleteFile(`.${path}`)),
      );
    } catch (error) {
      console.error('Error deleting carousel images:', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    // 4) delete the document from the database
    await this.CarouselModel.findByIdAndDelete(id);
    return;
  }
}
