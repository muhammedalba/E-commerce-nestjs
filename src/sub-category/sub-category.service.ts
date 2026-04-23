import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateSupCategoryDto } from './shared/dto/create-sup-category.dto';
import { UpdateSupCategoryDto } from './shared/dto/update-sup-category.dto';
import {
  SupCategory,
  SupCategoryDocument,
} from './shared/schemas/sup-category.schema';
import { BaseService } from 'src/shared/utils/service/base.service';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { SupCategoriesStatistics } from './shared/sup-categories-helper/sup-categories-statistics.service';

@Injectable()
export class SupCategoryService extends BaseService<SupCategoryDocument> {
  constructor(
    @InjectModel(SupCategory.name)
    private supCategoryModel: Model<SupCategoryDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly supCategoriesStatistics: SupCategoriesStatistics,
  ) {
    super(supCategoryModel, i18n, fileUploadService);
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET SUP CATEGORIES STATISTICS  ====== ---------- //
  // ------------ =============================== ---------- //
  async findStatistics() {
    return await this.supCategoriesStatistics.supCategoriesStatistics();
  }

  // ------------ =============================== ---------- //
  // ------------ ======  CREATE SUP CATEGORY  ====== ---------- //
  // ------------ =============================== ---------- //
  async create(createSupCategoryDto: CreateSupCategoryDto): Promise<any> {
    return await this.createOneDoc(
      createSupCategoryDto,
      undefined,
      SupCategory.name,
      {
        checkField: 'name.en',
        fieldValue: createSupCategoryDto.name.en,
      },
    );
  }

  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUP CATEGORIES  ====== ---------- //
  // ------------ =============================== ---------- //
  async findAll(queryString: QueryString, allLangs: boolean) {
    return await this.findAllDoc(
      SupCategory.name,
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
    updateCategoryDto: UpdateSupCategoryDto,
  ): Promise<any> {
    const selectedFields = 'image';
    return await this.updateOneDoc(
      idParamDto,
      updateCategoryDto,
      undefined,
      SupCategory.name,
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
