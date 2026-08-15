import {
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
import slugify from 'slugify';

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
 * Configuration options injected by child services to customise BaseService behaviour.
 * Using this interface removes all hardcoded model-name checks from BaseService and
 * follows the Open/Closed Principle — the base class is open for extension via options,
 * but closed for direct modification when adding a new module.
 */
export interface BaseServiceOptions {
  /**
   * Optional custom model/module name used for file upload folders and search strategies.
   * If omitted, defaults automatically to `this.model.modelName`.
   */
  modelName?: string;

  /**
   * Default image filename used when no file is uploaded.
   * Use `'avatar.png'` for user/person models, `'default.png'` for all others.
   * @default 'default.png'
   */
  defaultFileName?: 'avatar.png' | 'default.png';

  /**
   * The i18n key thrown by `isFieldTaken` when a duplicate value is detected.
   * @default 'exception.NAME_EXISTS'
   */
  fieldTakenExceptionKey?: string;

  /**
   * Optional transform applied to the raw Mongoose document immediately after
   * successful creation (e.g. strip sensitive fields like `password` or `__v`).
   */
  postCreateTransform?: (
    doc: Record<string, unknown>,
  ) => Record<string, unknown>;
}

/**
 * Base Service providing common CRUD operations and utility methods for Mongoose models.
 * Includes support for localization, file uploads, and API features (filtering, sorting, pagination).
 *
 * @template T The Mongoose document type.
 */
export class BaseService<T> {
  protected readonly logger = new Logger(this.constructor.name);
  protected slugSourceField: string | null = null;

  constructor(
    protected readonly model: Model<T>,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
    protected readonly serviceOptions: BaseServiceOptions = {},
  ) {}

  /**
   * Protected getter returning the module/model name.
   * Priority: explicit `serviceOptions.modelName` -> automatically derived `this.model.modelName`.
   */
  protected get modelName(): string {
    return this.serviceOptions.modelName ?? this.model.modelName;
  }

  /**
   * Generates the default file path for a model if no file is uploaded.
   *
   * @param modelName - Optional name of the model (defaults to `this.modelName`).
   * @returns The relative path to the default image.
   */
  private getDefaultFilePath(modelName?: string): string {
    const targetModelName = modelName ?? this.modelName;
    const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
    // Resolved from the child service's options — no hardcoded model names needed.
    const defaultImage = this.serviceOptions.defaultFileName ?? 'default.png';
    return path.posix.join('/', uploadsDir, targetModelName, defaultImage);
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
    const query: Record<string, any> = { [field]: value.trim() };
    if (excludeId) {
      const idToExclude = isValidObjectId(excludeId)
        ? new Types.ObjectId(excludeId)
        : excludeId;
      query._id = { $ne: idToExclude };
    }
    if (onlyActive) {
      query.isActive = true;
    }

    const count = await this.model.countDocuments(query);
    if (count > 0) {
      const key =
        this.serviceOptions.fieldTakenExceptionKey ?? 'exception.NAME_EXISTS';
      throw new BadRequestException(this.t(key));
    }
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
   * @param modelName - Optional name of the model (defaults to `this.modelName`).
   * @param doc - Optional existing document for update context.
   * @param oldPath - Optional path of the old file to be replaced.
   * @returns The path of the uploaded file or the default file path.
   * @throws InternalServerErrorException if the upload fails.
   */
  private async handleFileUpload(
    file: MulterFileType,
    modelName?: string,
    doc?: FileSchema,
    oldPath?: string,
  ): Promise<string> {
    const targetModelName = modelName ?? this.modelName;
    if (!file) {
      return this.getDefaultFilePath(targetModelName);
    }

    try {
      return doc
        ? ((await this.fileUploadService.updateFile(
            file,
            targetModelName,
            doc,
            oldPath,
          )) ?? this.getDefaultFilePath(targetModelName))
        : await this.fileUploadService.saveFileToDisk(file, targetModelName);
    } catch (error) {
      this.logger.error('File upload failed', error);
      throw new InternalServerErrorException(
        this.t('exception.ERROR_FILE_UPLOAD'),
      );
    }
  }

  /**
   * Generates a URL-friendly slug from a string or localized object.
   *
   * @param value - The string or localized object (e.g., { en: '...', ar: '...' })
   * @returns The generated slug.
   */
  protected generateSlug(value: unknown): string {
    let text = '';

    if (typeof value === 'object' && value !== null) {
      const valObj = value as Record<string, unknown>;
      const en = typeof valObj.en === 'string' ? valObj.en.trim() : '';
      const ar = typeof valObj.ar === 'string' ? valObj.ar.trim() : '';
      text = en || ar || '';
    } else if (typeof value === 'string') {
      text = value.trim();
    }

    if (!text) return '';

    return slugify(text.toLowerCase(), {
      lower: true,
      strict: true,
    });
  }

  /**
   * Creates a new document with optional file upload and uniqueness checks.
   *
   * @param CreateDataDto - The data to create the document.
   * @param file - Optional file to upload.
   * @param optionsOrModelName - Configuration options OR optional string modelName for legacy callers.
   * @param optionsParam - Optional configuration if modelName was explicitly passed.
   * @returns The created and localized document.
   */
  async createOneDoc(
    CreateDataDto: Partial<T> | Record<string, any>,
    file: MulterFileType | undefined,
    optionsOrModelName?:
      | {
          fileFieldName?: string;
          checkField?: string;
          fieldValue?: string;
          useDefaultFile?: boolean;
          onlyActive?: boolean;
        }
      | string,
    optionsParam?: {
      fileFieldName?: string;
      checkField?: string;
      fieldValue?: string;
      useDefaultFile?: boolean;
      onlyActive?: boolean;
    },
  ): Promise<T> {
    const targetModelName =
      typeof optionsOrModelName === 'string'
        ? optionsOrModelName
        : this.modelName;
    const options =
      typeof optionsOrModelName === 'object'
        ? optionsOrModelName
        : optionsParam;

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

    if (
      this.slugSourceField &&
      (CreateDataDto as Record<string, unknown>)[this.slugSourceField]
    ) {
      (CreateDataDto as Record<string, unknown>).slug = this.generateSlug(
        (CreateDataDto as Record<string, unknown>)[this.slugSourceField],
      );
    }

    let filePath: string | undefined;
    if (file || useDefaultFile) {
      filePath = await this.handleFileUpload(file, targetModelName);
      CreateDataDto[fileFieldName] = filePath;
    }
    try {
      const newDoc = await this.model.create(CreateDataDto);

      const rawDoc = newDoc as unknown as Record<string, unknown>;

      if (filePath) {
        rawDoc[fileFieldName] = `${process.env.BASE_URL}${filePath}`;
      }

      const newDocFilter: Record<string, unknown> = this.serviceOptions
        .postCreateTransform
        ? this.serviceOptions.postCreateTransform(rawDoc)
        : rawDoc;
      return this.i18n.localize(newDocFilter) as T;
    } catch (dbError) {
      if (
        filePath &&
        !filePath.includes('default.png') &&
        !filePath.includes('avatar.png')
      ) {
        this.logger.warn(`DB insertion failed. Rolling back file: ${filePath}`);
        await this.fileUploadService.deleteFile(filePath).catch(() => {});
      }
      throw dbError;
    }
  }

  /**
   * Retrieves all documents matching the query with support for filtering, sorting, pagination, and population.
   *
   * @param arg1 - QueryString parameters OR optional string modelName for legacy callers.
   * @param arg2 - Population options OR QueryString parameters if modelName was passed first.
   * @param arg3 - allLangs boolean OR population options.
   * @param arg4 - allLangs boolean if modelName was passed first.
   * @returns An object containing the results count, pagination info, and localized data.
   */
  async findAllDoc(
    arg1: QueryString | string,
    arg2?:
      | QueryString
      | {
          path: string;
          select: string;
        },
    arg3?:
      | {
          path: string;
          select: string;
        }
      | boolean,
    arg4: boolean = false,
  ): Promise<{
    results: number;
    pagination: any;
    data: T[];
  }> {
    let targetModelName = this.modelName;
    let queryString: QueryString;
    let populate: { path: string; select: string } | undefined;
    let allLangs = false;

    if (typeof arg1 === 'string') {
      targetModelName = arg1;
      queryString = arg2 as QueryString;
      populate = arg3 as { path: string; select: string } | undefined;
      allLangs = arg4;
    } else {
      queryString = arg1;
      populate = arg2 as { path: string; select: string } | undefined;
      allLangs = typeof arg3 === 'boolean' ? arg3 : false;
    }

    const features = new ApiFeatures(this.model.find(), queryString)
      .filter()
      .search(targetModelName);

    const filter = features.getQuery().getFilter();
    const total = await this.model.countDocuments(filter);

    features.sort().limitFields().paginate(total);

    const data = populate
      ? await features
          .getQuery()
          .populate({ path: populate.path, select: populate.select })
          .lean()
      : await features.getQuery().lean();

    if (!data) {
      throw new BadRequestException(this.t('exception.NOT_FOUND'));
    }

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(data, allLangs) as T[],
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

    return this.i18n.localize(doc, allLangs) as T;
  }

  /**
   * Updates a document by ID with optional file upload and uniqueness checks.
   *
   * @param idParamDto - Object containing the document ID.
   * @param UpdateDataDto - The data to update.
   * @param file - Optional new file to upload.
   * @param arg4 - Selected fields string OR optional modelName string for legacy callers.
   * @param arg5 - Options object OR selected fields string.
   * @param arg6 - Options object if modelName was explicitly passed as arg4.
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
    arg4?:
      | string
      | {
          fileFieldName?: string;
          fieldValue?: string;
          checkField?: string;
          onlyActive?: boolean;
        },
    arg5?:
      | string
      | {
          fileFieldName?: string;
          fieldValue?: string;
          checkField?: string;
          onlyActive?: boolean;
        },
    arg6?: {
      fileFieldName?: string;
      fieldValue?: string;
      checkField?: string;
      onlyActive?: boolean;
    },
  ): Promise<T | null> {
    let targetModelName = this.modelName;
    let selectedFields = '';
    let options:
      | {
          fileFieldName?: string;
          fieldValue?: string;
          checkField?: string;
          onlyActive?: boolean;
        }
      | undefined;

    if (
      typeof arg4 === 'string' &&
      (typeof arg5 === 'string' || (typeof arg5 === 'object' && arg5 !== null))
    ) {
      // Legacy signature: updateOneDoc(idParam, updateDto, file, modelName, selectedFields, options)
      targetModelName = arg4;
      selectedFields = typeof arg5 === 'string' ? arg5 : '';
      options = arg6 ?? (typeof arg5 === 'object' ? arg5 : undefined);
    } else {
      // Clean signature: updateOneDoc(idParam, updateDto, file, selectedFields, options)
      selectedFields = typeof arg4 === 'string' ? arg4 : '';
      options = (
        typeof arg4 === 'object'
          ? arg4
          : typeof arg5 === 'object'
            ? arg5
            : undefined
      ) as
        | {
            fileFieldName?: string;
            fieldValue?: string;
            checkField?: string;
            onlyActive?: boolean;
          }
        | undefined;
    }

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
      .exec()) as
      | (Record<string, unknown> & { _id: Types.ObjectId | string })
      | null;

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }

    if (checkField && fieldValue) {
      await this.isFieldTaken(
        checkField,
        fieldValue,
        doc._id.toString(),
        onlyActive,
      );
    }

    if (
      this.slugSourceField &&
      (UpdateDataDto as Record<string, unknown>)[this.slugSourceField]
    ) {
      (UpdateDataDto as Record<string, unknown>).slug = this.generateSlug(
        (UpdateDataDto as Record<string, unknown>)[this.slugSourceField],
      );
    }

    let newFilePath: string | undefined;

    if (file) {
      const oldPath = doc[fileFieldName] as string | undefined;
      newFilePath = await this.handleFileUpload(
        file,
        targetModelName,
        doc as unknown as FileSchema,
        oldPath,
      );
      UpdateDataDto[fileFieldName] = newFilePath;
    } else if (
      UpdateDataDto[fileFieldName] !== undefined &&
      (typeof UpdateDataDto[fileFieldName] === 'object' ||
        UpdateDataDto[fileFieldName] === '{}')
    ) {
      delete UpdateDataDto[fileFieldName];
    }

    try {
      const updatedData = (await this.model.findByIdAndUpdate(
        { _id: doc._id },
        { $set: UpdateDataDto },
        { new: true, runValidators: true, lean: true },
      )) as unknown as Record<string, unknown> | null;

      if (newFilePath && updatedData) {
        updatedData[fileFieldName] = `${process.env.BASE_URL}${newFilePath}`;
      }
      return updatedData ? (this.i18n.localize(updatedData) as T) : null;
    } catch (dbError) {
      if (newFilePath) {
        this.logger.warn(`DB update failed. Rolling back file: ${newFilePath}`);
        await this.fileUploadService.deleteFile(newFilePath).catch(() => {});
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
   * @note File-deletion failures are logged as warnings but do NOT block DB record removal.
   */
  async deleteOneDoc(
    idParamDto: IdParamDto,
    fileFieldName: string = 'avatar',
  ): Promise<void> {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    if (!isObjectId) {
      throw new NotFoundException(
        this.t('exception.INVALID', { args: { variable: idParamDto.id } }),
      );
    }

    const doc = (await this.model
      .findById(idParamDto.id)
      .select(`${fileFieldName}`)
      .lean()) as
      | (Record<string, string | undefined> & {
          _id: Types.ObjectId;
        })
      | null;

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }

    const imagePath = doc[fileFieldName];
    if (imagePath) {
      try {
        await this.fileUploadService.deleteFile(imagePath);
      } catch (error) {
        // Log a warning but do NOT block DB deletion.
        // The file may already be missing or corrupted on disk;
        // the database record must still be removed to keep the system consistent.
        this.logger.warn(
          `Could not delete file "${imagePath}" for document ${doc._id.toString()}. ` +
            `Proceeding with DB record deletion. Error: ${(error as Error).message}`,
        );
      }
    }

    await this.model.deleteOne({ _id: doc._id });
    return;
  }
}
