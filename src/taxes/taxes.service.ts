import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Tax, TaxDocument } from './shared/schema/tax.schema';
import { CreateTaxDto, UpdateTaxDto } from './shared/dto/tax.dto';
import { SettingsService } from '../settings/settings.service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';

@Injectable()
export class TaxesService extends BaseService<TaxDocument> {
  constructor(
    @InjectModel(Tax.name)
    private readonly taxModel: Model<TaxDocument>,
    private readonly settingsService: SettingsService,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
  ) {
    super(taxModel, i18n, fileUploadService);
  }

  async findByCountry(countryId: string) {
    if (!countryId) {
      throw new BadRequestException(this.t('exception.NOT_FOUND'));
    }
    // convert country id to object id
    const countryQuery = Types.ObjectId.isValid(countryId)
      ? new Types.ObjectId(countryId)
      : countryId;

    // 1. Search by country first
    const listByCountry = await this.taxModel
      .find({
        country: countryQuery,
        isActive: true,
      })
      .select('percentage isIncludedInPrice country')
      .lean();

    // Mongoose .find() always returns an array, so we only check length
    if (listByCountry.length > 0) return listByCountry;

    // 2. Search for the general tax if no tax was found for the country
    const generalTax = await this.taxModel
      .find({
        $or: [
          { country: { $exists: false } },
          { country: null },
          { country: '' },
        ],
        isActive: true,
      })
      .select('percentage isIncludedInPrice country')
      .lean();

    if (generalTax.length > 0) return generalTax;

    // 3. Search for the general tax in the settings if the above failed
    const settings = await this.settingsService.getSettings();

    // Optional Chaining
    if (settings?.vatRate > 0) {
      return [
        {
          percentage: settings.vatRate,
          isIncludedInPrice: settings.taxesIncluded,
          country: null,
        },
      ];
    }

    return [];
  }

  /**
   * Validates tax uniqueness based on country or global name.
   * @param dto - The tax data (create or update)
   * @param id - Optional ID to exclude (for updates)
   */
  private async validateTaxUniqueness(
    dto: CreateTaxDto | UpdateTaxDto,
    id?: string,
  ) {
    let country = dto.country;
    let name = dto.name;
    let isActive = dto.isActive;

    if (id) {
      const current = await this.taxModel.findById(id).lean();
      if (!current) throw new NotFoundException(this.t('exception.NOT_FOUND'));
      if (country === undefined)
        country = current.country ? current.country.toString() : undefined;
      if (name === undefined) name = current.name;
      if (isActive === undefined) isActive = current.isActive;
    } else {
      if (isActive === undefined) isActive = true; // default when creating
    }

    // No conflict if the tax is inactive
    if (!isActive) return;

    const query: FilterQuery<TaxDocument> = {
      isActive: true,
      _id: id ? { $ne: id } : { $exists: true },
    };

    if (!country) {
      // Global Tax: Check name uniqueness among global active taxes
      query.country = null;
      query.name = name;

      const exists = await this.taxModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.TAX_NAME_EXISTS'));
      }
    } else {
      // Country Tax: Only one active tax rule per country
      query.country = country;

      const exists = await this.taxModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.TAX_COUNTRY_EXISTS'));
      }
    }
  }

  async create(dto: CreateTaxDto): Promise<TaxDocument> {
    await this.validateTaxUniqueness(dto);
    return this.createOneDoc(dto, undefined, Tax.name);
  }

  async findAll(queryString: QueryString): Promise<any> {
    console.log(queryString);

    return this.findAllDoc(Tax.name, queryString, {
      path: 'country',
      select: 'name code',
    });
  }

  async findOne(id: IdParamDto): Promise<TaxDocument> {
    return this.findOneDoc(id, '', false, {
      path: 'country',
      select: 'name code',
    });
  }

  async update(id: IdParamDto, dto: UpdateTaxDto): Promise<TaxDocument> {
    await this.validateTaxUniqueness(dto, id.id);
    return (await this.updateOneDoc(
      id,
      dto,
      undefined,
      Tax.name,
    )) as TaxDocument;
  }

  async remove(id: IdParamDto): Promise<void> {
    return this.deleteOneDoc(id);
  }

  /**
   * حساب الضريبة بناءً على الدولة أو الإعدادات العامة
   */
  async calculateTax(
    subtotal: number,
    countryId?: string,
  ): Promise<{
    taxPercentage: number;
    taxAmount: number;
    totalWithTax: number;
    isIncluded: boolean;
  }> {
    let taxPercentage = 0;
    let isIncluded = false;

    // 1. إذا تم تمرير دولة، نبحث عن ضريبة مخصصة لها أولاً
    if (countryId) {
      const countryTax = await this.findByCountry(countryId);
      if (countryTax) {
        taxPercentage = countryTax[0].percentage;
        isIncluded = countryTax[0].isIncludedInPrice;
      }
    } else {
      throw new BadRequestException(this.t('exception.NOT_FOUND'));
    }

    if (taxPercentage <= 0) {
      return {
        taxPercentage: 0,
        taxAmount: 0,
        totalWithTax: subtotal,
        isIncluded: false,
      };
    }

    let taxAmount = 0;
    let totalWithTax = subtotal;

    if (isIncluded) {
      // إذا كانت الضريبة مشمولة: السعر يحتوي الضريبة بالفعل
      // المعادلة: Amount - (Amount / (1 + Rate))
      taxAmount = subtotal - subtotal / (1 + taxPercentage / 100);
      totalWithTax = subtotal;
    } else {
      // إذا كانت الضريبة غير مشمولة: تضاف للسعر
      taxAmount = (subtotal * taxPercentage) / 100;
      totalWithTax = subtotal + taxAmount;
    }

    return {
      taxPercentage,
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      totalWithTax: parseFloat(totalWithTax.toFixed(2)),
      isIncluded,
    };
  }
}
