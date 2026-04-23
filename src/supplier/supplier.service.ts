import { Injectable } from '@nestjs/common';
import { CreateSupplierDto } from './shared/dto/create-supplier.dto';
import { UpdateSupplierDto } from './shared/dto/update-supplier.dto';
import { Supplier, SupplierDocument } from './shared/schema/Supplier.schema';
import { BaseService } from 'src/shared/utils/service/base.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { SupplierStatistics } from './shared/Suppliers-helper/supplier-statistics.service';
import { generateUniqueSlug } from 'src/shared/utils/slug.util';

@Injectable()
export class SupplierService extends BaseService<SupplierDocument> {
  constructor(
    @InjectModel(Supplier.name) private SupplierModel: Model<SupplierDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
    protected readonly supplierStatistics: SupplierStatistics,
  ) {
    super(SupplierModel, i18n, fileUploadService);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET statistics  ====== ---------- //
  // ------------ =============================== ---------- //
  async suppliers_statistics() {
    return await this.supplierStatistics.suppliers_statistics();
  }
  // ------------ =============================== ---------- //
  // ------------ ======  CREATE SUPPLIER   ====== ---------- //
  // ------------ =============================== ---------- //
  async create_Supplier(
    createSupplierDto: CreateSupplierDto,
    file: MulterFileType,
  ): Promise<any> {
    if (createSupplierDto.name.trim()) {
      createSupplierDto.slug = await generateUniqueSlug(
        createSupplierDto.name.trim(),
        this.SupplierModel,
      );
    }
    return await this.createOneDoc(createSupplierDto, file, Supplier.name, {
      fileFieldName: 'avatar',
      checkField: 'name',
      fieldValue: createSupplierDto.name.trim(),
    });
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET ALL SUPPLIERS  ====== ---------- //
  // ------------ =============================== ---------- //
  async get_Suppliers(queryString: QueryString): Promise<any> {
    return await this.findAllDoc(Supplier.name, queryString, undefined, false);
  }
  // ------------ =============================== ---------- //
  // ------------ ======  GET SUPPLIER BY ID  ====== ---------- //
  // ------------ =============================== ---------- //
  async get_Supplier(idParamDto: IdParamDto) {
    return await this.findOneDoc(idParamDto, '-__v');
  }
  // ------------ =============================== ---------- //
  // ------------ ======  UPDATE SUPPLIER  ====== ---------- //
  // ------------ =============================== ---------- //
  async update__Supplier(
    idParamDto: IdParamDto,
    UpdateSupplierDto: UpdateSupplierDto,
    file: MulterFileType,
  ): Promise<any> {
    const selectedFields = '_id avatar email';
    return await this.updateOneDoc(
      idParamDto,
      UpdateSupplierDto,
      file,
      Supplier.name,
      selectedFields,
      {
        checkField: 'name',
        fieldValue: UpdateSupplierDto.name,
        fileFieldName: 'avatar',
      },
    );
  }
  // ------------ =============================== ---------- //
  // ------------ ======  DELETE SUPPLIER  ====== ---------- //
  // ------------ =============================== ---------- //
  async delete_Supplier(idParamDto: IdParamDto): Promise<void> {
    return await this.deleteOneDoc(idParamDto, 'avatar');
  }
}
