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
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import * as path from 'path';
import slugify from 'slugify';
import { FileAsset } from 'src/shared/schema/file-asset.schema';

/**
 * Interface representing a document with potential file fields.
 */
interface FileSchema {
  avatar?: FileAsset | string;
  email?: string;
  image?: FileAsset | string;
  carouselImage?: FileAsset | string;
}

/**
 * Configuration options for BaseService behavior.
 */
export interface BaseServiceOptions {
  /**
   * Override the model name used for permissions, cache, or logs.
   * If omitted, `this.model.modelName` is used automatically.
   */
  modelName?: string;

  /**
   * The field on the DTO used to generate the slug (e.g. `'name'`).
   * When set, `createOneDoc` and `updateOneDoc` will automatically
   * generate and assign `dto.slug` from this field.
   */
  slugSourceField?: string;

  /**
   * Default filename (e.g. `'default.png'`, `'avatar.png'`) used when no file is uploaded.
   * Defaults to `'default.png'`.
   */
  defaultFileName?: string;

  /**
   * Translation key to throw when `isFieldTaken` detects a duplicate.
   * Defaults to `'exception.NAME_EXISTS'`.
   */
  fieldTakenExceptionKey?: string;

  /**
   * Hook to transform the created document before localization and return.
   * Useful for stripping sensitive fields (e.g. password) or appending metadata.
   */
  postCreateTransform?: (
    doc: Record<string, unknown>,
  ) => Record<string, unknown>;
}

/**
 * Base service providing reusable CRUD operations, file handling,
 * localization, slug generation, and unique field validation.
 *
 * @template T - The Mongoose document type.
 */
export class BaseService<T> {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(
    protected readonly model: Model<T>,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService?: FileUploadService,
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
   * @returns The relative path to the default image as a FileAsset.
   */
  private getDefaultFilePath(modelName?: string): FileAsset {
    const targetModelName = modelName ?? this.modelName;
    const uploadsDir = process.env.UPLOADS_FOLDER || 'uploads';
    // Resolved from the child service's options — no hardcoded model names needed.
    const defaultImage = this.serviceOptions.defaultFileName ?? 'default.png';
    const relPath = path.posix.join(
      '/',
      uploadsDir,
      targetModelName,
      defaultImage,
    );
    return {
      url: relPath,
      publicId: relPath,
      provider: 'local',
    };
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
   * @param option - Optional translation variables.
   * @returns The translated string in the current locale.
   */
  protected t(key: string, option?: any): string {
    return this.i18n.translate(key, option);
  }

  /**
   * Handles file uploads, either saving a new file or updating an existing one.
   *
   * @param file - The uploaded file object.
   * @param modelName - Optional name of the model (defaults to `this.modelName`).
   * @param doc - Optional existing document for update context.
   * @param oldAsset - Optional old file asset to be replaced.
   * @returns The FileAsset object or default FileAsset.
   * @throws InternalServerErrorException if the upload fails.
   */
  private async handleFileUpload(
    file: MulterFileType,
    modelName?: string,
    doc?: FileSchema,
    oldAsset?: FileAsset | string,
  ): Promise<FileAsset> {
    const targetModelName = modelName ?? this.modelName;
    if (!file) {
      return this.getDefaultFilePath(targetModelName);
    }

    if (!this.fileUploadService) {
      this.logger.error(
        'FileUploadService is not injected, but file upload was requested.',
      );
      throw new InternalServerErrorException(
        this.t('exception.ERROR_FILE_UPLOAD'),
      );
    }

    try {
      return doc
        ? ((await this.fileUploadService.updateFile(
            file,
            targetModelName,
            doc,
            oldAsset,
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
        : (optionsParam ?? {});

    const {
      fileFieldName = 'avatar',
      checkField,
      fieldValue,
      useDefaultFile = false,
      onlyActive = false,
    } = options;

    if (checkField && fieldValue) {
      await this.isFieldTaken(checkField, fieldValue, undefined, onlyActive);
    }

    const slugSource = this.serviceOptions.slugSourceField;
    if (
      slugSource &&
      (CreateDataDto as Record<string, unknown>)[slugSource] &&
      !(CreateDataDto as Record<string, unknown>).slug
    ) {
      (CreateDataDto as Record<string, unknown>).slug = this.generateSlug(
        (CreateDataDto as Record<string, unknown>)[slugSource],
      );
    }

    let fileAsset: FileAsset | undefined;
    if (file || useDefaultFile) {
      fileAsset = await this.handleFileUpload(file, targetModelName);
      CreateDataDto[fileFieldName] = fileAsset;
    }
    try {
      const newDoc = await this.model.create(CreateDataDto);
      const rawDoc = (newDoc as any).toObject
        ? (newDoc as any).toObject()
        : { ...(newDoc as any) };

      const newDocFilter: Record<string, unknown> = this.serviceOptions
        .postCreateTransform
        ? this.serviceOptions.postCreateTransform(rawDoc)
        : rawDoc;
      return this.i18n.localize(newDocFilter) as T;
    } catch (dbError) {
      if (fileAsset) {
        this.logger.warn(
          `DB insertion failed. Rolling back file: ${JSON.stringify(fileAsset)}`,
        );
        await this.fileUploadService?.deleteFile(fileAsset).catch(() => {});
      }
      throw dbError;
    }
  }

  /**
   * Retrieves all documents matching the query with support for filtering, sorting, pagination, and population.
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
          .exec()
      : await features.getQuery().lean().exec();

    const localizedData = this.i18n.localize(data, allLangs) as T[];

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: localizedData,
    };
  }

  /**
   * Retrieves a single document by its ID with support for field selection and population.
   */
  async findOneDoc(
    idParamDto: IdParamDto,
    selectedFields?: string,
    allLangs: boolean = false,
    populate?: { path: string; select: string },
  ): Promise<T> {
    let query = this.model.findById(idParamDto.id);

    if (selectedFields) {
      query = query.select(selectedFields);
    }

    if (populate) {
      query = query.populate(populate);
    }

    const data = await query.lean().exec();

    if (!data) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }

    return this.i18n.localize(data, allLangs) as T;
  }

  /**
   * Updates a single document with optional file replacement and field uniqueness checks.
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

    if (typeof arg4 === 'string' && typeof arg5 === 'string') {
      // Legacy signature: updateOneDoc(idParam, updateDto, file, modelName, selectedFields, options)
      targetModelName = arg4;
      selectedFields = arg5;
      options = arg6 ?? undefined;
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

    const slugSource = this.serviceOptions.slugSourceField;
    if (slugSource && (UpdateDataDto as Record<string, unknown>)[slugSource]) {
      (UpdateDataDto as Record<string, unknown>).slug = this.generateSlug(
        (UpdateDataDto as Record<string, unknown>)[slugSource],
      );
    }

    let newFileAsset: FileAsset | undefined;

    if (file) {
      const oldAsset = doc[fileFieldName] as FileAsset | string | undefined;
      newFileAsset = await this.handleFileUpload(
        file,
        targetModelName,
        doc as unknown as FileSchema,
        oldAsset,
      );
      UpdateDataDto[fileFieldName] = newFileAsset;
    } else if (
      UpdateDataDto[fileFieldName] !== undefined &&
      (typeof UpdateDataDto[fileFieldName] === 'object' ||
        UpdateDataDto[fileFieldName] === '{}') &&
      !('url' in (UpdateDataDto[fileFieldName] || {}))
    ) {
      delete UpdateDataDto[fileFieldName];
    }

    try {
      const updatedData = (await this.model.findByIdAndUpdate(
        { _id: doc._id },
        { $set: UpdateDataDto },
        { new: true, runValidators: true, lean: true },
      )) as unknown as Record<string, unknown> | null;

      return updatedData ? (this.i18n.localize(updatedData) as T) : null;
    } catch (dbError) {
      if (newFileAsset) {
        this.logger.warn(
          `DB update failed. Rolling back file: ${JSON.stringify(newFileAsset)}`,
        );
        await this.fileUploadService?.deleteFile(newFileAsset).catch(() => {});
      }
      throw dbError;
    }
  }

  /**
   * Deletes a document by ID and removes its associated file.
   */
  async deleteDoc(
    idParamDto: IdParamDto,
    fileFieldName?: string,
  ): Promise<void> {
    const isDocFound = await this.model.exists({ _id: idParamDto.id });
    if (!isDocFound) {
      throw new NotFoundException(
        this.t(
          this.serviceOptions.fieldTakenExceptionKey ?? 'exception.NOT_FOUND',
        ),
      );
    }

    const doc = (await this.model
      .findById(idParamDto.id)
      .select(`${fileFieldName}`)
      .lean()) as
      | (Record<string, FileAsset | string | undefined> & {
          _id: Types.ObjectId;
        })
      | null;

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }

    const asset = fileFieldName ? doc[fileFieldName] : undefined;
    if (asset && this.fileUploadService) {
      try {
        await this.fileUploadService.deleteFile(asset);
      } catch (error) {
        this.logger.warn(
          `Could not delete file "${JSON.stringify(asset)}" for document ${doc._id.toString()}. ` +
            `Proceeding with DB record deletion. Error: ${(error as Error).message}`,
        );
      }
    }

    await this.model.deleteOne({ _id: doc._id });
  }

  /**
   * Alias for deleteDoc to support legacy callers.
   */
  async deleteOneDoc(
    idParamDto: IdParamDto,
    fileFieldName?: string,
  ): Promise<void> {
    return this.deleteDoc(idParamDto, fileFieldName);
  }
}
