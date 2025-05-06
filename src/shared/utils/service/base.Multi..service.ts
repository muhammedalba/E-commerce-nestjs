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
import { UpdateUserDto } from 'src/users/shared/dto/update-user.dto';
import { I18nContext } from 'nestjs-i18n';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
//
interface FileSchema {
  avatar?: string;
  image?: string;
  email?: string;
  _id: string;
}
export class BaseMultiService<T> {
  constructor(
    protected readonly model: Model<T>,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
  ) {}
  private getCurrentLang(): string {
    const lang =
      I18nContext.current()?.lang ?? process.env.DEFAULT_LANGUAGE ?? 'ar';
    return lang;
  }

  async createOneDoc(
    CreateDataDto: { image?: string; [key: string]: any },
    file: MulterFile,
    modelName: string,
    options?: {
      fileFieldName?: string;
    },
  ): Promise<{ status: string; message: string; data: T }> {
    // const brand = await this.brandModel.create(createBrandDto);
    const fileFieldName = options?.fileFieldName ?? 'image';
    // 2) handle file upload
    let filePath: string | undefined;
    // Set default file path based on model name( /uploads/users/avatar.png)
    filePath =
      modelName === 'users'
        ? `/${process.env.UPLOADS_FOLDER}/${modelName}/avatar.png`
        : '';
    if (file) {
      try {
        filePath = await this.fileUploadService.saveFileToDisk(file, modelName);
        // set file path in CreateDataDto
        CreateDataDto[fileFieldName] = filePath;
      } catch (error) {
        console.error('File upload failed:', error);
        throw new InternalServerErrorException(
          this.i18n.translate('exception.ERROR_FILE_UPLOAD'),
        );
      }
    }
    // 3) create document in database
    const newDoc = await this.model.create(CreateDataDto);
    // 4) optionally add full URL to avatar or image
    if (filePath) {
      newDoc[fileFieldName] = `${process.env.BASE_URL}${filePath}`;
    }

    const toJSONLocalizedOnly = this.model.schema.methods
      .toJSONLocalizedOnly as (new_brand: T, lang: string) => T;
    const localize_brand = toJSONLocalizedOnly(newDoc, this.getCurrentLang());
    return {
      status: 'success',
      message: this.i18n.translate('success.created_SUCCESS'),
      data: localize_brand,
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
      throw new BadRequestException(this.i18n.translate('exception.NOT_FOUND'));
    }
    const toJSONLocalizedOnly = this.model.schema.methods
      .toJSONLocalizedOnly as (data: T[], lang: string) => T[];
    const localize_brand = toJSONLocalizedOnly(data, this.getCurrentLang());
    return {
      status: 'success',
      results: data.length,
      pagination: features.getPagination(),
      data: localize_brand,
    };
  }

  async findOneDoc(
    idParamDto: IdParamDto,
    selected: string,
  ): Promise<{ status: string; message: string; data: any }> {
    const doc = await this.model
      .findById(idParamDto.id)
      .select(selected)
      .exec();
    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }

    const toJSONLocalizedOnly = this.model.schema.methods
      .toJSONLocalizedOnly as (data: T, lang: string) => T[];
    const localize_brand = toJSONLocalizedOnly(doc as T, this.getCurrentLang());
    return {
      status: 'success',
      message: this.i18n.translate('success.found_SUCCESS'),
      data: localize_brand,
    };
  }

  async updateOneDoc(
    id: string,
    UpdateDataDto: UpdateUserDto,
    file: MulterFile,
    modelName: string,
    selectedFields: string,
  ): Promise<{
    status: string;
    message: string;
    data: any;
  }> {
    //1) check  doc if found
    const doc =
      ((await this.model.findById(id).select(selectedFields)) as FileSchema) ||
      null;
    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    //2) check if email already exists
    if (UpdateDataDto.email && UpdateDataDto.email !== doc.email) {
      const isExists = await this.model
        .exists({
          email: UpdateDataDto.email,
          _id: { $ne: doc._id },
        })
        .lean();
      if (isExists) {
        throw new BadRequestException(
          this.i18n.translate('exception.EMAIL_EXISTS'),
        );
      }
    }

    // 3) update doc ( avatar image ) if new file is provided
    if (file) {
      const avatarPath = await this.fileUploadService.updateFile(
        file,
        modelName,
        doc,
      );
      // 4) update user avatar
      UpdateDataDto.avatar = avatarPath;
    }
    // 5) update doc in the database
    const updatedData = await this.model
      .findByIdAndUpdate(
        { _id: doc._id },
        { $set: UpdateDataDto },
        { new: true, runValidators: true },
      )
      .select('-__v');
    return {
      status: 'success',
      message: this.i18n.translate('success.updated_SUCCESS'),
      data: updatedData,
    };
  }
  async deleteOneDoc(idParamDto: IdParamDto, selected: string): Promise<void> {
    // 1) check  document if found
    const doc = (await this.model
      .findById(idParamDto.id)
      .select(selected)) as FileSchema | null;
    if (!doc) {
      throw new NotFoundException(this.i18n.translate('exception.NOT_FOUND'));
    }
    //3) delete  file from disk
    let path: string | null;
    if (doc && (doc.avatar || doc.image)) {
      path = `.${doc.avatar}`;
      path = `.${doc.image}`;
      try {
        await this.fileUploadService.deleteFile(path);
      } catch (error) {
        console.error(`Error deleting file ${path}:`, error);
        throw new BadGatewayException(
          this.i18n.translate('exception.PROFILE_UPDATE_OLD-IMAGE'),
        );
      }
    }
    // 2) delete  doc from the database
    await this.model.deleteOne({ _id: doc._id });
    return;
  }
}
