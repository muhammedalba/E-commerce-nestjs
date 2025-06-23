import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { Category, CategoryDocument } from './shared/schemas/category.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { CategoriesStatistics } from './Categories-helper/categories-statistics.service';

@Injectable()
export class CategoriesService extends BaseService<CategoryDocument> {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly categoriesStatistics: CategoriesStatistics,
  ) {
    super(categoryModel, i18n, fileUploadService);
  }
  async Categories_statistics() {
    return await this.categoriesStatistics.categoriesStatistics();
  }
  async create(
    createCategoryDto: CreateCategoryDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.createOneDoc(createCategoryDto, file, 'categories', {
      fileFieldName: 'image',
      checkField: 'name.en',
      fieldValue: createCategoryDto.name.en,
    });
  }

  async findAll(queryString: QueryString): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: Category[];
  }> {
    return await this.findAllDoc('categories', queryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async update(
    idParamDto: IdParamDto,
    updateCategoryDto: UpdateCategoryDto,
    file: MulterFileType,
  ): Promise<any> {
    const selectedFields = 'image';
    return await this.updateOneDoc(
      idParamDto,
      updateCategoryDto,
      file,
      'categories',
      selectedFields,
      {
        checkField: 'name.en',
        fieldValue: updateCategoryDto.name?.en,
        fileFieldName: 'image',
      },
    );
  }

  async deleteOne(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
