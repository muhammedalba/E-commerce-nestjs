import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSubCategoryDto } from './shared/dto/create-sub-category.dto';
import { UpdateSubCategoryDto } from './shared/dto/update-sub-category.dto';
import {
  SubCategory,
  SubCategoryDocument,
} from './shared/schemas/sub-category.schema';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

import { SubCategoriesStatistics } from './shared/sub-categories-helper/sub-categories-statistics.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { IdParamDto } from 'src/shared/dto/id-param.dto';

@Injectable()
export class SubCategoryService extends BaseService<SubCategoryDocument> {
  constructor(
    @InjectModel(SubCategory.name)
    private SubCategoryModel: Model<SubCategoryDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly SubCategoriesStatistics: SubCategoriesStatistics,
  ) {
    super(SubCategoryModel, i18n, fileUploadService);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET SUP CATEGORIES STATISTICS  ====== ---------- //
  // ------------ =============================== ---------- //
  async findStatistics() {
    return await this.SubCategoriesStatistics.SubCategoriesStatistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  CREATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  async create(createSubCategoryDto: CreateSubCategoryDto): Promise<any> {
    return await this.createOneDoc(
      createSubCategoryDto,
      undefined,
      SubCategory.name,
      {
        checkField: 'name.en',
        fieldValue: createSubCategoryDto.name.en,
      },
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES  ====== ---------- //
  // ------------ =============================== ---------- //
  async findAll(queryString: QueryString, allLangs: boolean) {
    return await this.findAllDoc(
      SubCategory.name,
      queryString,
      {
        path: 'category',
        select: 'name',
      },
      allLangs,
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET SUP CATEGORY BY ID  ====== ---------- //
  // ------------ =============================== ---------- //
  async findOne(idParamDto: IdParamDto, allLangs: boolean = false) {
    return await this.findOneDoc(idParamDto, '-__v', allLangs);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  async update(
    idParamDto: IdParamDto,
    updateCategoryDto: UpdateSubCategoryDto,
  ): Promise<any> {
    const selectedFields = 'image';
    return await this.updateOneDoc(
      idParamDto,
      updateCategoryDto,
      undefined,
      SubCategory.name,
      selectedFields,
      {
        checkField: 'name.en',
        fieldValue: updateCategoryDto.name?.en,
      },
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  DELETE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  async remove(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
