import { Injectable } from '@nestjs/common';
import { CreateBrandDto } from './dto/create-brand.dto';
import { InjectModel } from '@nestjs/mongoose';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { Brand, BrandDocument } from './schemas/brand.schema';
import { Model } from 'mongoose';

import { MulterFile } from 'src/shared/utils/interfaces/fileInterface';

import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { BaseMultiService } from 'src/shared/utils/service/base.Multi..service';

@Injectable()
export class BrandsService extends BaseMultiService<BrandDocument> {
  constructor(
    @InjectModel(Brand.name) private brandModel: Model<BrandDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(brandModel, i18n, fileUploadService);
  }
  async create(createBrandDto: CreateBrandDto, file: MulterFile): Promise<any> {
    // const brand = await this.brandModel.create(createBrandDto);
    //2) file upload service (save image in disk storage)
    // let filePath = `/${process.env.UPLOADS_FOLDER}/brands/image.png`;
    // if (file) {
    //   try {
    //     filePath = await this.fileUploadService.saveFileToDisk(file, 'brands');
    //   } catch (error) {
    //     console.error('File upload failed:', error);
    //   }
    // }

    // //3) save user to db with avatar path
    // createBrandDto.image = filePath;
    // const new_brand = await this.brandModel.create(createBrandDto);
    // //4) update avatar url
    // new_brand.image = `${process.env.BASE_URL}${filePath}`;

    // const toJSONLocalizedOnly = this.brandModel.schema.methods
    //   .toJSONLocalizedOnly as (new_brand: Brand, lang: string) => Brand;
    // const localize_brand = toJSONLocalizedOnly(
    //   new_brand,
    //   this.getCurrentLang(),
    // );
    return await this.createOneDoc(createBrandDto, file, 'brands', {
      fileFieldName: 'image',
    });
  }

  async findAll(queryString: QueryString): Promise<{
    status: string;
    results: number;
    pagination: any;
    data: Brand[];
  }> {
    // const brands = await this.brandModel.find();
    // if (!brands) {
    //   throw new BadRequestException('Brands not found');
    // }
    // const toJSONLocalizedOnly = this.brandModel.schema.methods
    //   .toJSONLocalizedOnly as (brands: Brand[], lang: string) => Brand[];
    // const localize_brand = toJSONLocalizedOnly(brands, this.getCurrentLang());
    return await this.findAllDoc('brands', queryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async deleteOne(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
