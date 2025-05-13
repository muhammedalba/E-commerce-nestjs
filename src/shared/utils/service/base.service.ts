import {
  BadGatewayException,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { CustomI18nService } from '../i18n/costum-i18n-service';
import { ApiFeatures } from '../ApiFeatures';
import { QueryString } from '../interfaces/queryInterface';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { MulterFile } from '../interfaces/fileInterface';
import { I18nContext } from 'nestjs-i18n';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
//
interface FileSchema {
  avatar?: string;
  email?: string;
  image?: string;
  carouselImage?: string;
  _id: string;
}
export class BaseService<T> {
  constructor(
    protected readonly model: Model<T>,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
  ) {}
  // This method is used to get the current language from the request context
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }
  // This method is used to get the default file path based on the model name '/uploads/users/avatar.png'
  private getDefaultFilePath = (modelName: string): string =>
    `/${process.env.UPLOADS_FOLDER}/${modelName}/${modelName === 'users' ? 'avatar.png' : 'default.png'}`;

  // This method is used to check if the email is already taken
  protected async isFieldTaken(
    field: string,
    value: string,
    excludeId?: string,
  ): Promise<boolean> {
    const query: Record<string, any> = { [field]: value.trim() };
    if (excludeId) query._id = { $ne: excludeId };
    const result = await this.model.exists(query);
    return !!result;
  }

  // This method is used to get the current language
  private t(key: string): string {
    return this.i18n.translate(key);
  }
  // This method is used to localize the document
  localize(data: T | T[]): T | T[] {
    const toJSONLocalizedOnly = this.model.schema.methods
      ?.toJSONLocalizedOnly as ((data: T | T[], lang: string) => T) | undefined;

    const localizedDoc =
      typeof toJSONLocalizedOnly === 'function'
        ? toJSONLocalizedOnly(data as T, this.getCurrentLang())
        : data;
    return localizedDoc;
  }
  // This method is used to handle the file upload
  private async handleFileUpload(
    file: MulterFile,
    modelName: string,
    doc?: FileSchema,
  ): Promise<string> {
    // Return default file path if no file is provided
    if (!file) {
      return this.getDefaultFilePath(modelName);
    }

    try {
      // If a document is provided, update the file; otherwise, save a new file
      return doc
        ? ((await this.fileUploadService.updateFile(file, modelName, doc)) ??
            this.getDefaultFilePath(modelName))
        : await this.fileUploadService.saveFileToDisk(file, modelName);
    } catch (error) {
      console.error('File upload failed:', error);
      throw new InternalServerErrorException(
        this.t('exception.ERROR_FILE_UPLOAD'),
      );
    }
  }

  async createOneDoc(
    CreateDataDto: { [key: string]: any },
    file: MulterFile | undefined,
    modelName: string,
    options?: {
      fileFieldName?: string;
      checkField?: string;
      fieldValue?: string;
    },
  ): Promise<{ status: string; message: string; data: T }> {
    const { fileFieldName = 'avatar', checkField, fieldValue } = options || {};
    if (
      checkField &&
      fieldValue &&
      (await this.isFieldTaken(checkField, fieldValue))
    ) {
      const exceptionKey =
        modelName === 'users'
          ? 'exception.EMAIL_EXISTS'
          : 'exception.NAME_EXISTS';
      throw new BadRequestException(this.t(exceptionKey));
    }
    // 2) handle file upload

    const filePath = await this.handleFileUpload(file, modelName);
    CreateDataDto[fileFieldName] = filePath;

    // 3) create document in database
    const newDoc = await this.model.create(CreateDataDto);
    // 4) optionally add full URL to avatar or image
    if (filePath) {
      newDoc[fileFieldName] = `${process.env.BASE_URL}${filePath}`;
    }
    let newDocFilter: T | T[];
    // 5) clean up response
    if (modelName === 'users') {
      newDocFilter = {
        ...newDoc.toObject(),
        password: undefined,
        __v: undefined,
      } as T;
    } else {
      newDocFilter = newDoc as T;
    }

    // 6) localize the document
    const localizedDoc = this.localize(newDocFilter);

    return {
      status: 'success',
      message: this.t('success.created_SUCCESS'),
      data: localizedDoc as T,
    };
  }
  async findAllDoc(
    modelName: string,
    QueryString: QueryString,
  ): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: T[];
  }> {
    const total = await this.model.countDocuments();
    const features = new ApiFeatures(this.model.find(), QueryString)
      .filter()
      .search(modelName)
      .sort()
      .limitFields()
      .paginate(total);

    const data = await features.getQuery();
    if (!data) {
      throw new BadRequestException(this.t('exception.NOT_FOUND'));
    }

    const localizedDoc = this.localize(data);
    return {
      status: 'success',
      results: data.length,
      pagination: features.getPagination(),
      data: localizedDoc as T[],
    };
  }

  async findOneDoc(
    idParamDto: IdParamDto,
    selected: string,
  ): Promise<{ status: string; message: string; data: T }> {
    // 1) check if id is valid ObjectId or slug
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(idParamDto.id);
    // 1) check  doc if found
    const doc = isObjectId
      ? await this.model.findById(idParamDto.id).select(selected).exec()
      : await this.model
          .findOne({ slug: idParamDto.id })
          .select(selected)
          .exec();

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }
    const localizedDoc = this.localize(doc);
    return {
      status: 'success',
      message: this.t('success.found_SUCCESS'),
      data: Array.isArray(localizedDoc) ? localizedDoc[0] : localizedDoc,
    };
  }

  async updateOneDoc(
    idParamDto: IdParamDto,
    UpdateDataDto: {
      email?: string;
      [key: string]: any;
    },
    file: MulterFile,
    modelName: string,
    selectedFields: string,
    options?: {
      fileFieldName?: string;
      fieldValue?: string;
      checkField?: string;
    },
  ): Promise<{
    status: string;
    message: string;
    data: any;
  }> {
    const { fileFieldName = 'avatar', checkField, fieldValue } = options || {};
    //1) check  doc if found
    const doc = (await this.model
      .findById(idParamDto.id)
      .select(selectedFields)
      .exec()) as FileSchema;

    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }
    //2) check if email already exists
    if (
      checkField &&
      fieldValue &&
      (await this.isFieldTaken(checkField, fieldValue, doc._id.toString()))
    ) {
      const exceptionKey =
        modelName === 'users'
          ? 'exception.EMAIL_EXISTS'
          : 'exception.NAME_EXISTS';
      throw new BadRequestException(this.t(exceptionKey));
    }

    // 3) update doc ( avatar image ) if new file is provided
    let filePath: string | undefined;
    if (file) {
      // 2) handle file upload
      filePath = await this.handleFileUpload(file, modelName, doc);

      UpdateDataDto[fileFieldName] = filePath;
    }
    // 5) update doc in the database
    const updatedData = await this.model.findByIdAndUpdate(
      { _id: doc._id },
      { $set: UpdateDataDto },
      { new: true, runValidators: true },
    );
    // 4) optionally add full URL to avatar or image
    if (filePath && updatedData) {
      updatedData[fileFieldName] = `${process.env.BASE_URL}${filePath}`;
    }
    const localizedDoc = updatedData ? this.localize(updatedData) : null;
    return {
      status: 'success',
      message: this.t('success.updated_SUCCESS'),
      data: localizedDoc,
    };
  }
  async deleteOneDoc(idParamDto: IdParamDto, selected: string): Promise<void> {
    // 1) check  document if found
    const doc = (await this.model
      .findById(idParamDto.id)
      .select(selected)) as FileSchema | null;
    if (!doc) {
      throw new NotFoundException(this.t('exception.NOT_FOUND'));
    }
    //3) delete  file from disk

    const imagePath = doc.avatar || doc.image || doc.carouselImage;
    if (imagePath) {
      const path = `.${imagePath}`;
      try {
        await this.fileUploadService.deleteFile(path);
      } catch (error) {
        console.error(`Error deleting file ${path}:`, error);
        throw new BadGatewayException(
          this.t('exception.PROFILE_UPDATE_OLD-IMAGE'),
        );
      }
    }
    // 2) delete  doc from the database
    await this.model.deleteOne({ _id: doc._id });
    return;
  }
}
