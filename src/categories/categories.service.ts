import { Injectable } from '@nestjs/common';
import { CreateCategoryDto } from './shared/dto/create-category.dto';
import { UpdateCategoryDto } from './shared/dto/update-category.dto';
import { Category, CategoryDocument } from './shared/schemas/category.schema';
import {
  SubCategory,
  SubCategoryDocument,
} from 'src/sub-category/shared/schemas/sub-category.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CategoriesStatisticsService } from './categories-helper/categories-statistics.service';
import { Product } from 'src/products/shared/schemas/Product.schema';
import { assertNoLinkedProducts } from 'src/shared/utils/linked-products.util';

@Injectable()
export class CategoriesService extends BaseService<CategoryDocument> {
  protected slugSourceField = 'name';
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(SubCategory.name)
    private subCategoryModel: Model<SubCategoryDocument>,
    @InjectModel(Product.name) private productModel: Model<Product>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly categoriesStatistics: CategoriesStatisticsService,
  ) {
    super(categoryModel, i18n, fileUploadService);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  categories statistics  ====== ---------- //
  // ------------ =============================== ---------- //
  async categories_statistics() {
    return await this.categoriesStatistics.categoriesStatistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  create category   ====== ---------- //
  // ------------ =============================== ---------- //
  async create(
    createCategoryDto: CreateCategoryDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.createOneDoc(createCategoryDto, file, {
      fileFieldName: 'image',
      checkField: 'name.en',
      fieldValue: createCategoryDto.name.en,
      useDefaultFile: true,
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
      select: 'name slug id',
    };
    return await this.findAllDoc(queryString, populate, allLangs);
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
    // Its sub-categories are deleted with it, so their products block it too.
    const subCategoryIds = await this.subCategoryModel.distinct('_id', {
      category: idParamDto.id,
    });
    await assertNoLinkedProducts(
      this.productModel,
      {
        $or: [
          { category: idParamDto.id },
          { SubCategories: { $in: subCategoryIds } },
        ],
      },
      this.i18n,
    );
    await this.deleteOneDoc(idParamDto, 'image');
    await this.subCategoryModel.deleteMany({ category: idParamDto.id });
    return;
  }
}
