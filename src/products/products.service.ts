import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateProductDto } from './shared/dto/create-product.dto';
import { UpdateProductDto } from './shared/dto/update-product.dto';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { Product, ProductDocument } from './shared/schemas/Product.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import slugify from 'slugify';
import {
  MulterFilesType,
  MulterFileType,
} from 'src/shared/utils/interfaces/fileInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { I18nContext } from 'nestjs-i18n';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {}
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }

  localize(data: Product | Product[]) {
    const toJSONLocalizedOnly = this.productModel.schema.methods
      ?.toJSONLocalizedOnly as
      | ((data: Product | Product[], lang: string) => Product)
      | undefined;

    const localizedDoc =
      typeof toJSONLocalizedOnly === 'function'
        ? toJSONLocalizedOnly(data as Product, this.getCurrentLang())
        : data;
    return localizedDoc;
  }
  private async uploadFile(
    file: MulterFileType,
    modelName: string,
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException(
        this.i18n.translate('exception.FILE_REQUIRED'),
      );
    }
    return this.fileUploadService.saveFileToDisk(file, modelName);
  }

  private async handleMultipleFilesUpload(
    files: MulterFilesType,
    folder: string,
  ): Promise<string[] | undefined> {
    if (!files || files.length === 0) return undefined;
    return this.fileUploadService.saveFilesToDisk(files, folder);
  }

  async create(
    createProductDto: CreateProductDto,
    files: {
      imageCover: MulterFilesType;
      images?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
    },
  ) {
    // 1) Generate slug from title
    createProductDto.slug = slugify(createProductDto.title.en.trim(), {
      lower: true,
      strict: true,
    });

    // 2) Check if product with same slug exists
    const isExists = await this.productModel.exists({
      slug: createProductDto.slug,
    });
    if (isExists) {
      throw new BadRequestException(
        this.i18n.translate('exception.NAME_EXISTS'),
      );
    }

    try {
      // 3) Handle file uploads
      if (files.imageCover) {
        createProductDto.imageCover =
          (await this.uploadFile(files.imageCover[0], 'products')) ?? '';
      }

      if (files.infoProductPdf) {
        createProductDto.infoProductPdf = await this.uploadFile(
          files.infoProductPdf[0],
          'products',
        );
      }

      createProductDto.images = await this.handleMultipleFilesUpload(
        files.images,
        'products',
      );

      // 4) Create document in DB
      const newDoc = await this.productModel.create(createProductDto);

      // 5) Add base URL to file paths
      const baseUrl = process.env.BASE_URL || '';
      newDoc.imageCover = `${baseUrl}${createProductDto.imageCover}`;
      newDoc.images = newDoc.images?.map((img) => `${baseUrl}${img}`);
      newDoc.infoProductPdf = createProductDto.infoProductPdf
        ? `${baseUrl}${createProductDto.infoProductPdf}`
        : undefined;

      // 6) Return localized version
      if (!newDoc) {
        throw new InternalServerErrorException(
          this.i18n.translate('exception.ERROR_SAVE'),
        );
      }
      return this.localize(newDoc);
    } catch (error) {
      console.error('Error creating product:', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }
  }

  async findAll(queryString: QueryString) {
    const total = await this.productModel.countDocuments();
    const features = new ApiFeatures(this.productModel.find(), queryString)
      .filter()
      .search('products')
      .sort()
      .limitFields()
      .paginate(total);

    const data = await features.getQuery();
    if (!data) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const localizedDoc = this.localize(data);
    return {
      status: 'success',
      results: data.length,
      pagination: features.getPagination(),
      data: localizedDoc as Product[],
    };
  }

  async findOne(idParamDto: IdParamDto) {
    // 1) check if id is valid ObjectId or slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    // 1) check  doc if found
    const doc = isObjectId
      ? await this.productModel.findById(idParamDto.id).select('-__v').exec()
      : await this.productModel
          .findOne({ slug: idParamDto.id })
          .select('-__v')
          .exec();

    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    const localizedDoc = this.localize(doc);
    return {
      status: 'success',
      message: this.i18n.translate('success.found_SUCCESS'),
      data: localizedDoc,
    };
  }

  async update(
    idParamDto: IdParamDto,
    updateProductDto: UpdateProductDto,
    files: {
      imageCover?: MulterFilesType;
      infoProductPdf?: MulterFilesType;
      images?: MulterFilesType;
    },
  ) {
    // 1) Fetch existing product
    const doc = await this.productModel
      .findById(idParamDto.id)
      .select('infoProductPdf imageCover images')
      .lean();
    if (!doc) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    // 2) Handle slug change if title is updated
    if (updateProductDto.title) {
      updateProductDto.slug = slugify(updateProductDto.title.en.trim(), {
        lower: true,
        strict: true,
      });

      const isExists = await this.productModel.exists({
        slug: updateProductDto.slug,
        _id: { $ne: doc._id },
      });

      if (isExists) {
        throw new BadRequestException(
          this.i18n.translate('exception.NAME_EXISTS'),
        );
      }
    }

    try {
      if (doc && files) {
        // 3) Handle single file updates
        const singleFiles: Record<string, MulterFilesType> = {
          imageCover: files.imageCover,
          infoProductPdf: files.infoProductPdf,
        };

        for (const [key, file] of Object.entries(singleFiles)) {
          if (file) {
            const newPath = await this.fileUploadService.saveFileToDisk(
              file?.[0],
              'products',
            );

            if (key === 'imageCover' || key === 'infoProductPdf') {
              const oldPath = doc[key] as string;

              if (oldPath) {
                await this.fileUploadService.deleteFile(`.${oldPath}`);
              }
            }

            updateProductDto[key] = newPath;
          }
        }

        // 4) Handle multiple images update
        if (files.images && files.images.length > 0) {
          // delete old images
          if (doc.images) {
            await this.fileUploadService.deleteFiles(doc.images);
          }

          const newImages = await this.fileUploadService.saveFilesToDisk(
            files.images,
            'products',
          );
          updateProductDto.images = newImages;
        }
      }
      // 5) Update product in database
      const updatedDoc = await this.productModel.findByIdAndUpdate(
        idParamDto.id,
        { $set: updateProductDto },
        { new: true, runValidators: true },
      );

      return {
        status: 'success',
        message: this.i18n.translate('success.updated_SUCCESS'),
        data: updatedDoc ? this.localize(updatedDoc) : updatedDoc,
      };
    } catch (error) {
      console.error('Error updating product:', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_SAVE'),
      );
    }
  }

  async remove(idParamDto: IdParamDto) {
    // 1) العثور على المنتج
    const doc = await this.productModel
      .findById(idParamDto.id)
      .select('imageCover infoProductPdf images')
      .lean();

    if (!doc) {
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }

    try {
      // 2) حذف الملفات المرتبطة
      if (doc.imageCover) {
        await this.fileUploadService.deleteFile(`.${doc.imageCover}`);
      }

      if (doc.infoProductPdf) {
        await this.fileUploadService.deleteFile(`.${doc.infoProductPdf}`);
      }

      if (doc.images && Array.isArray(doc.images)) {
        await this.fileUploadService.deleteFiles(doc.images);
      }

      // 3) حذف المنتج من قاعدة البيانات
      await this.productModel.findByIdAndDelete(idParamDto.id);

      return;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw new InternalServerErrorException(
        this.i18n.translate('exception.ERROR_DELETE'),
      );
    }
  }
}
