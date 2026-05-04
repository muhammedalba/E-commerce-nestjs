import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateCarouselDto } from './shared/dto/create-carousel.dto';
import { UpdateCarouselDto } from './shared/dto/update-carousel.dto';
import { BaseService } from 'src/shared/utils/service/base.service';
import { Carousel, CarouselDocument } from './shared/schemas/carousel.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { Request } from 'express';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';
type file = Request['file'];
@Injectable()
export class CarouselService extends BaseService<CarouselDocument> {
  protected override readonly logger = new Logger(CarouselService.name);

  constructor(
    @InjectModel(Carousel.name) private CarouselModel: Model<CarouselDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(CarouselModel, i18n, fileUploadService);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  create carousel   ====== ---------- //
  // ------------ =============================== ---------- //
  async createCarousel(
    createCarouselDto: CreateCarouselDto,
    files: {
      carouselSm: file;
      carouselMd: file;
      carouselLg: file;
    },
  ) {

    // check if there is active banner 
    if (createCarouselDto.isActive) {
      const isCarouselExist = await this.CarouselModel.exists({ isActive: true });
      if (isCarouselExist) {
        throw new BadRequestException(this.i18n.translate('exception.ALREADY_EXISTS_ACTIVE_CAROUSEL'));
      }
    }

    // generate unique slug for description
    const newSlug = await generateUniqueSlug(createCarouselDto.description?.en, this.CarouselModel,null,this.i18n.translate('exception.NAME_EXISTS'));
    createCarouselDto.slug = newSlug;
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
            Carousel.name,
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
      return this.i18n.localize(newDoc);
      // return this.localize(newDoc);
    } catch (error) {
      this.logger.error('Error saving carousel', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }
  }

  // ------------ =============================== ---------- //
  // ------------ ======  get all carousels  ====== ---------- //
  // ------------ =============================== ---------- //

  async findAll(
    queryString: QueryString,
    allLangs: boolean,
  ): Promise<{
    results: number;
    pagination: any;
    data: Carousel[];
  }> {
    return await this.findAllDoc(
      Carousel.name,
      queryString,
      undefined,
      allLangs,
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  get carousel by id  ====== ---------- //
  // ------------ =============================== ---------- //
  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    return await this.findOneDoc(idParamDto, '-__v', allLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  update carousel   ====== ---------- //
  // ------------ =============================== ---------- //
  // async updateOne(
  //   idParamDto: IdParamDto,
  //   updateCarouselDto: UpdateCarouselDto,
  //   files: {
  //     carouselSm?: file;
  //     carouselMd?: file;
  //     carouselLg?: file;
  //   },
  // ): Promise<any> {
  //   const { id } = idParamDto;

  //   // 1) check if the document exists
  //   const carousel = await this.CarouselModel.findById(id).select(
  //     'carouselMd carouselLg carouselSm',
  //   );
  //   if (!carousel) {
  //     throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
  //   }

  //   const imageFields: (keyof typeof files)[] = [
  //     'carouselSm',
  //     'carouselMd',
  //     'carouselLg',
  //   ];

  //   try {
  //     for (const key of imageFields) {
  //       const file = (files[key]?.[0] as file) ?? null;
  //       if (file) {
  //         // save the new file to disk
  //         const newPath = await this.fileUploadService.saveFileToDisk(
  //           file,
  //           Carousel.name,
  //         );

  //         // delete the old file from disk
  //         const oldPath = carousel[key];
  //         if (oldPath) {
  //           await this.fileUploadService.deleteFile(`.${oldPath}`);
  //         }

  //         // update the DTO with the new path
  //         updateCarouselDto[key] = newPath;
  //       } else {
  //         // if no new file is provided, keep the old path
  //         updateCarouselDto[key] = carousel[key];
  //       }
  //     }
  //   } catch (error) {
  //     this.logger.error('Error processing carousel images', error);
  //     throw new InternalServerErrorException(
  //       this.i18n.translate('exception.ERROR_SAVE'),
  //     );
  //   }

  //   // update the document in the database
  //   const updatedDoc = await this.CarouselModel.findByIdAndUpdate(
  //     { _id: id },
  //     { $set: updateCarouselDto },
  //     { new: true, runValidators: true },
  //   );

  //   return updatedDoc ? this.i18n.localize(updatedDoc) : [];
  // }
  async updateOne(
    idParamDto: IdParamDto,
    updateCarouselDto: UpdateCarouselDto,
    files: {
      carouselSm?: file;
      carouselMd?: file;
      carouselLg?: file;
    },
  ): Promise<Carousel> {
    const { id } = idParamDto;

    // 1) Find the document
    const carousel = await this.CarouselModel.findById(id).exec();
    if (!carousel) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND', { args: { variable: 'Carousel' } }));
    }
    //  check if there is another active carousel
    if (updateCarouselDto.isActive === true && carousel.isActive !== true) {
      const isAnotherActive = await this.CarouselModel.exists({
        isActive: true,
        _id: { $ne: id },
      });

      if (isAnotherActive) {
        throw new BadRequestException(this.i18n.translate('exception.ALREADY_EXISTS_ACTIVE_CAROUSEL'));
      }
    }

    // 2) Handle translations for description
    if (updateCarouselDto.description) {
      // generate unique slug for description
      const newSlug = await generateUniqueSlug(updateCarouselDto.description?.en, this.CarouselModel, id);
      carousel.slug = newSlug;
      carousel.description = updateCarouselDto.description;
    }

    // 3) Handle isActive
    if (updateCarouselDto.isActive !== undefined) {
      carousel.isActive = updateCarouselDto.isActive;
    }

    // 4) Handle Images
    const imageFields = ['carouselSm', 'carouselMd', 'carouselLg'] as const;
    const baseUrl = process.env.BASE_URL || '';



    for (const key of imageFields) {
      // Note: files[key] is actually an array because of FileFieldsInterceptor
      const fileArray = (files as any)[key];
      const file = fileArray?.[0] || null;

      if (file) {
        // Save new file
        const newPath = await this.fileUploadService.saveFileToDisk(file, Carousel.name);

        // Delete old file
        let oldPath = carousel[key];
        if (oldPath) {
          // Remove base URL if it exists to get relative path for deletion
          if (baseUrl && oldPath.startsWith(baseUrl)) {
            oldPath = oldPath.replace(baseUrl, '');
          }
          await this.fileUploadService.deleteFile(`.${oldPath}`);
        }

        // Update document with RELATIVE path
        carousel[key] = newPath;
      } else {
        // If no new file, ensure we don't save the absolute URL back to DB
        let currentPath = carousel[key];
        if (currentPath && baseUrl && currentPath.startsWith(baseUrl)) {
          carousel[key] = currentPath.replace(baseUrl, '');
        }
      }
    }

    // 5) Save the document
    const updatedDoc = await carousel.save();

    // 6) Return localized and absolute-pathed doc
    return this.i18n.localize(updatedDoc);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  delete carousel   ====== ---------- //
  // ------------ =============================== ---------- //
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
      console.log(imagePaths);
      await Promise.all(
        imagePaths.map((path) => this.fileUploadService.deleteFile(`.${path}`)),
      );
    } catch (error) {
      this.logger.error('Error deleting carousel images', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }

    // 4) delete the document from the database
    await this.CarouselModel.findByIdAndDelete(id);
    return;
  }
}
