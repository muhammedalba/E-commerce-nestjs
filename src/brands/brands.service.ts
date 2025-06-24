import { Injectable } from '@nestjs/common';
import { CreateBrandDto } from './shared/dto/create-brand.dto';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { Brand, BrandDocument } from './shared/schemas/brand.schema';
import { Model } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { UpdateBrandDto } from './shared/dto/update-brand.dto';
import { BaseService } from 'src/shared/utils/service/base.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { BrandsStatistics } from './shared/brands-helper/brands-statistics.service';

@Injectable()
export class BrandsService extends BaseService<BrandDocument> {
  constructor(
    @InjectModel(Brand.name) private brandModel: Model<BrandDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly brandsStatistics: BrandsStatistics,
    protected readonly i18n: CustomI18nService,
  ) {
    super(brandModel, i18n, fileUploadService);
  }
  async BrandsStatistics() {
    return await this.brandsStatistics.statistics();
  }

  async create(
    createBrandDto: CreateBrandDto,
    file: MulterFileType,
  ): Promise<any> {
    return await this.createOneDoc(createBrandDto, file, 'brands', {
      fileFieldName: 'image',
      checkField: 'name.en',
      fieldValue: createBrandDto.name.en,
    });
  }
  async findAll(queryString: QueryString): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: Brand[];
  }> {
    return await this.findAllDoc('brands', queryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }
  async updateBrand(
    idParamDto: IdParamDto,
    updateBrandDto: UpdateBrandDto,
    file: MulterFileType,
  ): Promise<any> {
    const selectedFields = 'image';
    return await this.updateOneDoc(
      idParamDto,
      updateBrandDto,
      file,
      'brands',
      selectedFields,
      {
        checkField: 'name.en',
        fieldValue: updateBrandDto.name?.en,
        fileFieldName: 'image',
      },
    );
  }
  async deleteOne(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
