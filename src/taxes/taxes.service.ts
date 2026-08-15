import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { Tax, TaxDocument, TaxScope } from './shared/schema/tax.schema';
import { CreateTaxDto, UpdateTaxDto } from './shared/dto/tax.dto';
import { SettingsService } from '../settings/settings.service';
import { BaseService } from 'src/shared/utils/service/base.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import {
  Region,
  RegionDocument,
} from '../locations/shared/schema/region.schema';
import { City, CityDocument } from '../locations/shared/schema/city.schema';

@Injectable()
export class TaxesService extends BaseService<TaxDocument> {
  constructor(
    @InjectModel(Tax.name)
    private readonly taxModel: Model<TaxDocument>,
    @InjectModel(Region.name)
    private readonly regionModel: Model<RegionDocument>,
    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,
    private readonly settingsService: SettingsService,
    protected readonly i18n: CustomI18nService,
    protected readonly fileUploadService: FileUploadService,
  ) {
    super(taxModel, i18n, fileUploadService, {
      fieldTakenExceptionKey: 'exception.COUNTRY_EXISTS',
    });
  }

  /**
   * Finds the most specific applicable tax based on location hierarchy:
   * City -> Region -> Country -> Global -> Settings Fallback
   */
  async findApplicableTax(
    countryId?: string,
    regionId?: string,
    cityId?: string,
  ) {
    // 1. Search by City if cityId is valid
    if (
      cityId &&
      Types.ObjectId.isValid(cityId) &&
      regionId &&
      Types.ObjectId.isValid(regionId) &&
      countryId &&
      Types.ObjectId.isValid(countryId)
    ) {
      const cityTax = await this.taxModel
        .find({
          scope: TaxScope.CITY,
          country: new Types.ObjectId(countryId),
          region: new Types.ObjectId(regionId),
          city: new Types.ObjectId(cityId),
          isActive: true,
        })
        .select('percentage isIncludedInPrice country region city scope')
        .lean();
      if (cityTax.length > 0) return cityTax;
    }

    // 2. Search by Region if regionId is valid
    if (
      regionId &&
      Types.ObjectId.isValid(regionId) &&
      countryId &&
      Types.ObjectId.isValid(countryId)
    ) {
      const regionTax = await this.taxModel
        .find({
          scope: TaxScope.REGION,
          country: new Types.ObjectId(countryId),
          region: new Types.ObjectId(regionId),
          isActive: true,
        })
        .select('percentage isIncludedInPrice country region city scope')
        .lean();
      if (regionTax.length > 0) return regionTax;
    }

    // 3. Search by Country if countryId is valid
    if (countryId && Types.ObjectId.isValid(countryId)) {
      const countryTax = await this.taxModel
        .find({
          scope: TaxScope.COUNTRY,
          country: new Types.ObjectId(countryId),
          isActive: true,
        })
        .select('percentage isIncludedInPrice country region city scope')
        .lean();
      if (countryTax.length > 0) return countryTax;
    }

    // 4. Search by Global
    const globalTax = await this.taxModel
      .find({
        scope: TaxScope.GLOBAL,
        isActive: true,
      })
      .select('percentage isIncludedInPrice country region city scope')
      .lean();
    if (globalTax.length > 0) return globalTax;

    // 5. Fallback to settings
    const settings = await this.settingsService.getSettings();
    if (settings?.vatRate > 0) {
      return [
        {
          percentage: settings.vatRate,
          isIncludedInPrice: settings.taxesIncluded,
          country: null,
          region: null,
          city: null,
          scope: TaxScope.GLOBAL,
        },
      ];
    }

    return [];
  }

  /**
   * Backward compatible wrapper for findByCountry endpoint/callers
   */
  async findByCountry(countryId?: string) {
    return this.findApplicableTax(countryId);
  }

  /**
   * Validates tax uniqueness and location relationships.
   */
  private async validateTaxUniqueness(
    dto: CreateTaxDto | UpdateTaxDto,
    id?: string,
  ) {
    let scope = dto.scope;
    let country = dto.country;
    let region = dto.region;
    let city = dto.city;
    let name = dto.name;
    let isActive = dto.isActive;

    if (id) {
      const current = await this.taxModel.findById(id).lean();
      if (!current) throw new NotFoundException(this.t('exception.NOT_FOUND'));
      if (scope === undefined) scope = current.scope;
      if (country === undefined) {
        country = current.country ? current.country.toString() : undefined;
      }
      if (region === undefined) {
        region = current.region ? current.region.toString() : undefined;
      }
      if (city === undefined) {
        city = current.city ? current.city.toString() : undefined;
      }
      if (name === undefined) name = current.name;
      if (isActive === undefined) isActive = current.isActive;
    } else {
      if (isActive === undefined) isActive = true;
    }

    // No conflict if the tax is inactive
    if (!isActive) return;

    // Verify geographical hierarchy relationships
    if (scope === TaxScope.REGION || scope === TaxScope.CITY) {
      if (!country || !region) {
        throw new BadRequestException(this.t('exception.TAX_SCOPE_INVALID'));
      }
      const regionDoc = await this.regionModel.findById(region).lean();
      if (!regionDoc) {
        throw new BadRequestException(this.t('exception.REGION_NOT_FOUND'));
      }
      const regionCountryId = (
        regionDoc.country as unknown as Types.ObjectId
      ).toString();
      if (regionCountryId !== country) {
        throw new BadRequestException(
          this.t('exception.REGION_COUNTRY_MISMATCH'),
        );
      }
    }

    if (scope === TaxScope.CITY) {
      if (!country || !region || !city) {
        throw new BadRequestException(this.t('exception.TAX_SCOPE_INVALID'));
      }
      const cityDoc = await this.cityModel.findById(city).lean();
      if (!cityDoc) {
        throw new BadRequestException(this.t('exception.CITY_NOT_FOUND'));
      }
      const cityRegionId = (
        cityDoc.region as unknown as Types.ObjectId
      ).toString();
      if (cityRegionId !== region) {
        throw new BadRequestException(this.t('exception.CITY_REGION_MISMATCH'));
      }
      const cityCountryId = (
        cityDoc.country as unknown as Types.ObjectId
      ).toString();
      if (cityCountryId !== country) {
        throw new BadRequestException(
          this.t('exception.CITY_COUNTRY_MISMATCH'),
        );
      }
    }

    const query: FilterQuery<TaxDocument> = {
      isActive: true,
      _id: id ? { $ne: id } : { $exists: true },
    };

    if (scope === TaxScope.GLOBAL) {
      query.scope = TaxScope.GLOBAL;

      const exists = await this.taxModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.TAX_NAME_EXISTS'));
      }
    } else if (scope === TaxScope.COUNTRY) {
      query.scope = TaxScope.COUNTRY;
      query.country = country;

      const exists = await this.taxModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.TAX_COUNTRY_EXISTS'));
      }
    } else if (scope === TaxScope.REGION) {
      query.scope = TaxScope.REGION;
      query.country = country;
      query.region = region;

      const exists = await this.taxModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.TAX_REGION_EXISTS'));
      }
    } else if (scope === TaxScope.CITY) {
      query.scope = TaxScope.CITY;
      query.country = country;
      query.region = region;
      query.city = city;

      const exists = await this.taxModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.TAX_CITY_EXISTS'));
      }
    }
  }

  async create(dto: CreateTaxDto): Promise<TaxDocument> {
    await this.validateTaxUniqueness(dto);
    return this.createOneDoc(dto, undefined);
  }

  async findAll(queryString: QueryString): Promise<any> {
    return this.findAllDoc(queryString, {
      path: 'country region city',
      select: 'name code',
    });
  }

  async findOne(id: IdParamDto): Promise<TaxDocument> {
    return this.findOneDoc(id, '', false, {
      path: 'country region city',
      select: 'name code',
    });
  }

  async update(id: IdParamDto, dto: UpdateTaxDto): Promise<TaxDocument> {
    await this.validateTaxUniqueness(dto, id.id);
    return (await this.updateOneDoc(id, dto, undefined)) as TaxDocument;
  }

  async remove(id: IdParamDto): Promise<void> {
    return this.deleteOneDoc(id);
  }

  /**
   * Calculate tax based on city, region, country, global, or settings fallback
   */
  async calculateTax(
    subtotal: number,
    countryId?: string,
    regionId?: string,
    cityId?: string,
  ): Promise<{
    taxPercentage: number;
    taxAmount: number;
    totalWithTax: number;
    isIncluded: boolean;
  }> {
    let taxPercentage = 0;
    let isIncluded = false;

    // Find the applicable tax
    const applicableTax = await this.findApplicableTax(
      countryId,
      regionId,
      cityId,
    );
    if (applicableTax && applicableTax.length > 0) {
      taxPercentage = applicableTax[0].percentage;
      isIncluded = applicableTax[0].isIncludedInPrice;
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
      taxAmount = subtotal - subtotal / (1 + taxPercentage / 100);
      totalWithTax = subtotal;
    } else {
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
