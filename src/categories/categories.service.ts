import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { Category, CategoryDocument } from './shared/schemas/category.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CategoriesStatisticsService } from './categories-helper/categories-statistics.service';

@Injectable()
export class CategoriesService extends BaseService<CategoryDocument> {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly categoriesStatistics: CategoriesStatisticsService,
  ) {
    super(categoryModel, i18n, fileUploadService);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  categories statistics  ====== ---------- //
  // ------------ =============================== ---------- //
  async Categories_statistics() {
    return await this.categoriesStatistics.categoriesStatistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  create category   ====== ---------- //
  // ------------ =============================== ---------- //
  async create(
    createCategoryDto: CreateCategoryDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.createOneDoc(createCategoryDto, file, Category.name, {
      fileFieldName: 'image',
      checkField: 'name.en',
      fieldValue: createCategoryDto.name.en,
    });
  }

  // ------------ =============================== ---------- //
  // ------------ ======  get all categories ====== ---------- //
  // ------------ =============================== ---------- //
  async findAll(
    queryString: QueryString,
    allLangs: boolean,
  ): Promise<{
    results: number;
    pagination: any;
    data: Category[];
  }> {
    const populate = {
      path: 'SubCategories',
      select: 'name slug',
    };
    return await this.findAllDoc(
      Category.name,
      queryString,
      populate,
      allLangs,
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  get category by id ====== ---------- //
  // ------------ =============================== ---------- //
  async findOne(idParamDto: IdParamDto, allLangs: boolean) {
    return await this.findOneDoc(idParamDto, '-__v', allLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  update category   ====== ---------- //
  // ------------ =============================== ---------- //
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
      Category.name,
      selectedFields,
      {
        checkField: 'name.en',
        fieldValue: updateCategoryDto.name?.en,
        fileFieldName: 'image',
      },
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  delete category   ====== ---------- //
  // ------------ =============================== ---------- //
  async deleteOne(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
