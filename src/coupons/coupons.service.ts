import { Injectable } from '@nestjs/common';
import { CreateCouponDto } from './shared/dto/create-coupon.dto';
import { UpdateCouponDto } from './shared/dto/update-coupon.dto';
import { IdParamDto } from 'src/users/shared/dto/id-param.dto';
import { BrandDocument } from 'src/brands/schemas/brand.schema';
import { BaseService } from 'src/shared/utils/service/base.service';
import { InjectModel } from '@nestjs/mongoose';
import { Coupon } from './shared/Schemas/coupons.schema';
import { Model } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/costum-i18n-service';
import { FileUploadService } from 'src/file-upload-in-diskStorage/file-upload.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';

@Injectable()
export class CouponsService extends BaseService<BrandDocument> {
  constructor(
    @InjectModel(Coupon.name) private brandModel: Model<BrandDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(brandModel, i18n, fileUploadService);
  }
  async create(createCouponDto: CreateCouponDto) {
    return await this.createOneDoc(createCouponDto, undefined, 'coupon', {
      checkField: 'name',
      fieldValue: createCouponDto.name,
    });
  }

  async findAll(queryString: QueryString) {
    return await this.findAllDoc('coupon', queryString);
  }

  async findOne(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }

  async update(idParamDto: IdParamDto, updateCouponDto: UpdateCouponDto) {
    const selectedFields = 'name';
    return await this.updateOneDoc(
      idParamDto,
      updateCouponDto,
      undefined,
      'coupon',
      selectedFields,
      {
        checkField: 'name',
        fieldValue: updateCouponDto.name,
      },
    );
  }

  async remove(idParamDto: IdParamDto) {
    return await this.deleteOneDoc(idParamDto, 'image');
  }
}
