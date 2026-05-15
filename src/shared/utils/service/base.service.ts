import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Model, Types, isValidObjectId } from 'mongoose';
import { CustomI18nService } from '../i18n/custom-i18n.service';
import { ApiFeatures } from '../ApiFeatures';
import { QueryString } from '../interfaces/queryInterface';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { MulterFileType } from '../interfaces/fileInterface';
import { TranslateOptions } from 'nestjs-i18n';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import * as path from 'path';

/**
 * Interface representing a document with potential file fields.
 */
interface FileSchema {
  avatar?: string;
  email?: string;
  image?: string;
  carouselImage?: string;
  _id: string;
}

/**
 * Base Service providing common CRUD operations and utility methods for Mongoose models.
 * Includes support for localization, file uploads, and API features (filtering, sorting, pagination).
 * 
 * @template T The Mongoose document type.
 */
export class BaseService<T> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly model: Model<T>,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
  ) { }

  /**
   * Generates the default file path for a model if no file is uploaded.
   * 
   * @param modelName - The name of the model (e.g., 'users', 'products').
   * @returns The relative path to the default image.
   */
  private getDefaultFilePath(modelName: string): string {
    const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
    const defaultImage = modelName === 'User' ? 'avatar.png' : 'default.png';

    return path.posix.join('/', uploadsDir, modelName, defaultImage);
  }

  /**
   * Checks if a specific field value is already taken by another document.
   * 
   * @param field - The field to check (e.g., 'email', 'name').
   * @param value - The value to check for uniqueness.
   * @param excludeId - Optional ID to exclude from the check (useful for updates).
   * @param onlyActive - Whether to check uniqueness only among active records.
   * @throws BadRequestException if the field value is already taken.
   */
  protected async isFieldTaken(
    field: string,
    value: string,
    excludeId?: string,
    onlyActive: boolean = false,
  ): Promise<void> {
    const query: Record<string, any> = {
      [field]: value.trim(),
    };

    if (onlyActive) {
      query.isActive = true;
    }


    if (excludeId) {
      const idToExclude = isValidObjectId(excludeId)
        ? new Types.ObjectId(excludeId)
        : excludeId;
      query._id = { $ne: idToExclude };
    }
    const result = await this.model.exists(query);
    if (result) {
      const exceptionKey =
        this.model.modelName === 'User'
          ? 'exception.EMAIL_EXISTS' : this.model.modelName === 'Tax'
            ? 'exception.COUNTRY_EXISTS' : 'exception.NAME_EXISTS';
      throw new BadRequestException(this.t(exceptionKey));
    }
    return;
  }

  /**
   * Helper method to translate messages using the I18n service.
   * 
   * @param key - The translation key.
   * @param option - Translation options (args, etc.).
   * @returns The translated string.
   */
  protected t(key: string, option?: TranslateOptions): string {
    return this.i18n.translate(key, option);
  }

  /**
   * Handles file uploads, either saving a new file or updating an existing one.
   * 
   * @param file - The uploaded file object.
   * @param modelName - The name of the model associated with the file.
   * @param doc - Optional existing document for update context.
   * @param oldPath - Optional path of the old file to be replaced.
   * @returns The path of the uploaded file or the default file path.
   * @throws InternalServerErrorException if the upload fails.
   */
  private async handleFileUpload(
    file: MulterFileType,
    modelName: string,
    doc?: FileSchema,
    oldPath?: string,
  ): Promise<string> {
    if (!file) {
      return this.getDefaultFilePath(modelName);
    }

    try {
      return doc
        ? ((await this.fileUploadService.updateFile(file, modelName, doc, oldPath)) ??
          this.getDefaultFilePath(modelName))
        : await this.fileUploadService.saveFileToDisk(file, modelName);
    } catch (error) {
      this.logger.error('File upload failed', error);
      throw new InternalServerErrorException(
        this.t('exception.ERROR_FILE_UPLOAD'),
      );
    }
  }

  /**
   * Creates a new document with optional file upload and uniqueness checks.
   * 
   * @param CreateDataDto - The data to create the document.
   * @param file - Optional file to upload.
   * @param modelName - The name of the model.
   * @param options - Configuration for file field and uniqueness checks.
   * @returns The created and localized document.
   */
  async createOneDoc(
    CreateDataDto: Partial<T> | Record<string, any>,
    file: MulterFileType | undefined,
    modelName: string,
    options?: {
      fileFieldName?: string;
      checkField?: string;
      fieldValue?: string;
      useDefaultFile?: boolean;
      onlyActive?: boolean;
    },
  ): Promise<T> {
    const {
      fileFieldName = 'avatar',
      checkField,
      fieldValue,
      useDefaultFile = false,
      onlyActive = false,
    } = options || {};

    if (checkField && fieldValue) {
      await this.isFieldTaken(checkField, fieldValue, undefined, onlyActive);
    }

    let filePath: string | undefined;
    if (file || useDefaultFile) {
      filePath = await this.handleFileUpload(file, modelName);
      CreateDataDto[fileFieldName] = filePath;
    }
    try {
      const newDoc = await this.model.create(CreateDataDto);

      if (filePath) {
        (newDoc as any)[fileFieldName] = `${process.env.BASE_URL}${filePath}`;
      }

      let newDocFilter = newDoc as any;
      if (modelName === 'users') {
        newDocFilter = {
          ...(newDoc as any).toObject(),
          password: undefined,
          __v: undefined,
        } as T;
      }
      return this.i18n.localize(newDocFilter) as T;
    } catch (dbError) {
      if (filePath && !filePath.includes('default.png') && !filePath.includes('avatar.png')) {
        this.logger.warn(`DB insertion failed. Rolling back file: ${filePath}`);
        await this.fileUploadService.deleteFile(filePath).catch(() => { });
      }
      throw dbError;
    }
  }

  /**
   * Retrieves all documents matching the query with support for filtering, sorting, pagination, and population.
   * 
   * @param modelName - The name of the model for search context.
   * @param QueryString - The query parameters (filter, sort, etc.).
   * @param populate - Optional population options.
   * @param allLangs - Whether to return values for all languages or just the current one.
   * @returns An object containing the results count, pagination info, and localized data.
   */
  async findAllDoc(
    modelName: string,
    QueryString: QueryString,
    populate?: {
      path: string;
      select: string;
    },
    allLangs: boolean = false,
  ): Promise<{
    results: number;
    pagination: any;
    data: T[];
  }> {
    const features = new ApiFeatures(this.model.find(), QueryString)
      .filter()
      .search(modelName);

    const filter = features.getQuery().getFilter();
    const total = await this.model.countDocuments(filter);

    features.sort().limitFields().paginate(total);

    const data = populate
      ? await features
        .getQuery()
        .populate({ path: populate.path, select: populate.select }).lean()
      : await features.getQuery().lean();

    if (!data) {
      throw new BadRequestException(this.t('exception.NOT_FOUND'));
    }

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(data, allLangs),
    };
  }

  /**
   * Retrieves a single document by ID or slug with optional population and localization.
   * 
   * @param idParamDto - Object containing the ID or slug.
   * @param selected - Space-separated list of fields to select.
   * @param allLangs - Whether to return values for all languages.
   * @param populate - Optional population options.
   * @returns The found and localized document.
   * @throws NotFoundException if the document is not found.
   */
  async findOneDoc(
    idParamDto: IdParamDto,
    selected: string,
    allLangs: boolean = false,
    populate?: {
      path: string;
      select: string;
    },
  ): Promise<T> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);

    let query = isObjectId
      ? this.model.findById(idParamDto.id)
      : this.model.findOne({ slug: idParamDto.id });

    query = query.select(selected);

    if (populate) {
      query = query.populate(populate);
    }

    const doc = await query.lean().exec();

    if (!doc) {
      throw new NotFoundException(
        this.t('exception.NOT_FOUND', { args: { variable: idParamDto.id } }),
      );
    }

    return this.i18n.localize(doc, allLangs);
  }

  /**
   * Updates a document by ID with optional file upload and uniqueness checks.
   * 
   * @param idParamDto - Object containing the document ID.
   * @param UpdateDataDto - The data to update.
   * @param file - Optional new file to upload.
   * @param modelName - The name of the model.
   * @param selectedFields - Fields to select in the returned document.
   * @param options - Configuration for file field and uniqueness checks.
   * @returns The updated and localized document.
   * @throws NotFoundException if the document is not found.
   */
  async updateOneDoc(
    idParamDto: IdParamDto,
    UpdateDataDto: {
      email?: string;
      [key: string]: any;
    },
    file: MulterFileType | undefined,
    modelName: string,
    selectedFields: string = '',
    options?: {
      fileFieldName?: string;
      fieldValue?: string;
      checkField?: string;
      onlyActive?: boolean;
    },
  ): Promise<T | null> {
    const {
      fileFieldName = 'avatar',
      checkField,
      fieldValue,
      onlyActive = false,
    } = options || {};

    const doc = (await this.model
      .findById(idParamDto.id)
      .select(`${selectedFields} _id ${fileFieldName}`)
      .lean()
      .exec()) as any;

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }

    if (checkField && fieldValue) {
      await this.isFieldTaken(checkField, fieldValue, doc._id, onlyActive);
    }

    let newFilePath: string | undefined;
    if (file) {
      const oldPath = doc[fileFieldName] as string | undefined;
      newFilePath = await this.handleFileUpload(file, modelName, doc, oldPath);
      UpdateDataDto[fileFieldName] = newFilePath;
    }

    try {
      const updatedData = await this.model.findByIdAndUpdate(
        { _id: doc._id },
        { $set: UpdateDataDto },
        { new: true, runValidators: true, lean: true },
      );

      if (newFilePath && updatedData) {
        updatedData[fileFieldName] = `${process.env.BASE_URL}${newFilePath}`;
      }
      return updatedData ? this.i18n.localize(updatedData) : null;
    } catch (dbError) {
      if (newFilePath) {
        this.logger.warn(`DB update failed. Rolling back file: ${newFilePath}`);
        await this.fileUploadService.deleteFile(newFilePath).catch(() => { });
      }
      throw dbError;
    }
  }

  /**
   * Deletes a document by ID and removes its associated file from disk.
   * 
   * @param idParamDto - Object containing the document ID.
   * @param fileFieldName - The name of the field storing the file path.
   * @throws NotFoundException if the ID is invalid or document not found.
   * @throws BadGatewayException if file deletion fails.
   */
  async deleteOneDoc(idParamDto: IdParamDto, fileFieldName: string = 'avatar'): Promise<void> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    if (!isObjectId) {
      throw new NotFoundException(
        this.t('exception.INVALID', { args: { variable: idParamDto.id } }),
      );
    }

    const doc = (await this.model
      .findById(idParamDto.id)
      .select(`${fileFieldName}`)) as any;

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }

    const imagePath = doc[fileFieldName];
    if (imagePath) {
      try {
        await this.fileUploadService.deleteFile(imagePath);
      } catch (error) {
        this.logger.error(`Error deleting file ${imagePath}`, error);
        throw new BadGatewayException(
          this.t('exception.PROFILE_UPDATE_OLD-IMAGE'),
        );
      }
    }

    await this.model.deleteOne({ _id: doc._id });
    return;
  }
}
