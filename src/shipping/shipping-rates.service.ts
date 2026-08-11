import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { BaseService } from 'src/shared/utils/service/base.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import {
  ShippingRate,
  ShippingRateDocument,
  ShippingRateScope,
} from './shared/schema/shipping-rate.schema';
import {
  CreateShippingRateDto,
  UpdateShippingRateDto,
} from './shared/dto/shipping-rate.dto';
import {
  Region,
  RegionDocument,
} from '../locations/shared/schema/region.schema';
import { City, CityDocument } from '../locations/shared/schema/city.schema';

export interface ShippingCalculationResult {
  providerId: string;
  providerName: string;
  basePrice: number;
  extraWeightCost: number;
  totalShippingCost: number;
  estimatedDays: string;
  supportsCOD: boolean;
  rateId: string;
}

@Injectable()
export class ShippingRatesService extends BaseService<ShippingRateDocument> {
  constructor(
    @InjectModel(ShippingRate.name)
    private readonly rateModel: Model<ShippingRateDocument>,
    @InjectModel(Region.name)
    private readonly regionModel: Model<RegionDocument>,
    @InjectModel(City.name)
    private readonly cityModel: Model<CityDocument>,
    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(rateModel, i18n, fileUploadService);
  }

  /**
   * Validates shipping rate uniqueness and location relationships.
   */
  private async validateShippingUniqueness(
    dto: CreateShippingRateDto | UpdateShippingRateDto,
    id?: string,
  ) {
    let scope = dto.scope;
    let country = dto.country;
    let region = dto.region;
    let city = dto.city;
    let provider = dto.provider;
    let isActive = dto.isActive;

    if (id) {
      const current = await this.rateModel.findById(id).lean();
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
      if (provider === undefined) {
        provider = current.provider ? current.provider.toString() : undefined;
      }
      if (isActive === undefined) isActive = current.isActive;
    } else {
      if (isActive === undefined) isActive = true;
    }

    if (!isActive) return;

    if (
      scope === ShippingRateScope.REGION ||
      scope === ShippingRateScope.CITY
    ) {
      if (!country || !region) {
        throw new BadRequestException(
          this.t('exception.SHIPPING_SCOPE_INVALID'),
        );
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

    if (scope === ShippingRateScope.CITY) {
      if (!country || !region || !city) {
        throw new BadRequestException(
          this.t('exception.SHIPPING_SCOPE_INVALID'),
        );
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

    const query: FilterQuery<ShippingRateDocument> = {
      isActive: true,
      provider: provider,
      _id: id ? { $ne: id } : { $exists: true },
    };

    if (scope === ShippingRateScope.GLOBAL) {
      query.scope = ShippingRateScope.GLOBAL;
      const exists = await this.rateModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.SHIPPING_NAME_EXISTS'));
      }
    } else if (scope === ShippingRateScope.COUNTRY) {
      query.scope = ShippingRateScope.COUNTRY;
      query.country = country;
      const exists = await this.rateModel.exists(query);
      if (exists) {
        throw new BadRequestException(
          this.t('exception.SHIPPING_COUNTRY_EXISTS'),
        );
      }
    } else if (scope === ShippingRateScope.REGION) {
      query.scope = ShippingRateScope.REGION;
      query.country = country;
      query.region = region;
      const exists = await this.rateModel.exists(query);
      if (exists) {
        throw new BadRequestException(
          this.t('exception.SHIPPING_REGION_EXISTS'),
        );
      }
    } else if (scope === ShippingRateScope.CITY) {
      query.scope = ShippingRateScope.CITY;
      query.country = country;
      query.region = region;
      query.city = city;
      const exists = await this.rateModel.exists(query);
      if (exists) {
        throw new BadRequestException(this.t('exception.SHIPPING_CITY_EXISTS'));
      }
    }
  }

  /**
   * Creates a new shipping rate.
   */
  async createRate(data: CreateShippingRateDto): Promise<ShippingRateDocument> {
    await this.validateShippingUniqueness(data);
    return this.createOneDoc(data, undefined, ShippingRate.name);
  }

  /**
   * Retrieves all shipping rates with pagination, searching, and filtering.
   */
  async getRates(query: QueryString): Promise<unknown> {
    const features = new ApiFeatures(this.rateModel.find(), query)
      .filter()
      .search(ShippingRate.name);

    const filter = features.getQuery().getFilter();
    const total = await this.rateModel.countDocuments(filter);

    features.sort().limitFields().paginate(total);

    const populatedData = await features
      .getQuery()
      .populate('provider', 'name code logo')
      .populate('country', 'name')
      .populate('region', 'name')
      .populate('city', 'name')
      .lean();

    return {
      results: populatedData.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(populatedData) as unknown,
    };
  }

  /**
   * Retrieves active shipping rates for a specific city.
   */
  async getRatesByCity(cityId: string) {
    return await this.findAllDoc(
      ShippingRate.name,
      { city: cityId, isActive: 'true' },
      { path: 'provider', select: 'name code logo trackingUrl' },
    );
  }

  /**
   * Updates an existing shipping rate.
   */
  async updateRate(
    id: string,
    data: UpdateShippingRateDto,
  ): Promise<ShippingRateDocument> {
    await this.validateShippingUniqueness(data, id);
    const updated = await this.updateOneDoc(
      { id },
      data,
      undefined,
      ShippingRate.name,
      '',
    );
    return updated as ShippingRateDocument;
  }

  /**
   * Deletes a shipping rate by ID.
   */
  async deleteRate(id: string): Promise<{ message: string }> {
    await this.deleteOneDoc({ id });
    return { message: 'Shipping rate deleted successfully' };
  }

  /**
   * Finds the most specific applicable shipping rates based on location hierarchy.
   */
  async findApplicableShippingRates(
    countryId?: string,
    regionId?: string,
    cityId?: string,
  ) {
    // 1. Search by City
    if (
      cityId &&
      Types.ObjectId.isValid(cityId) &&
      regionId &&
      Types.ObjectId.isValid(regionId) &&
      countryId &&
      Types.ObjectId.isValid(countryId)
    ) {
      const cityRates = await this.rateModel
        .find({
          scope: ShippingRateScope.CITY,
          country: new Types.ObjectId(countryId),
          region: new Types.ObjectId(regionId),
          city: new Types.ObjectId(cityId),
          isActive: true,
        })
        .populate('provider', 'name code')
        .lean();
      if (cityRates.length > 0) return cityRates;
    }

    // 2. Search by Region
    if (
      regionId &&
      Types.ObjectId.isValid(regionId) &&
      countryId &&
      Types.ObjectId.isValid(countryId)
    ) {
      const regionRates = await this.rateModel
        .find({
          scope: ShippingRateScope.REGION,
          country: new Types.ObjectId(countryId),
          region: new Types.ObjectId(regionId),
          isActive: true,
        })
        .populate('provider', 'name code')
        .lean();
      if (regionRates.length > 0) return regionRates;
    }

    // 3. Search by Country
    if (countryId && Types.ObjectId.isValid(countryId)) {
      const countryRates = await this.rateModel
        .find({
          scope: ShippingRateScope.COUNTRY,
          country: new Types.ObjectId(countryId),
          isActive: true,
        })
        .populate('provider', 'name code')
        .lean();
      if (countryRates.length > 0) return countryRates;
    }

    // 4. Search by Global
    const globalRates = await this.rateModel
      .find({
        scope: ShippingRateScope.GLOBAL,
        isActive: true,
      })
      .populate('provider', 'name code')
      .lean();
    if (globalRates.length > 0) return globalRates;

    return [];
  }

  /**
   * Calculates shipping costs for a specific location and weight.
   */
  async calculateShipping(
    cityId: string,
    totalWeight: number,
    subtotal: number,
    countryId?: string,
    regionId?: string,
  ): Promise<ShippingCalculationResult[]> {
    const rates = (await this.findApplicableShippingRates(
      countryId,
      regionId,
      cityId,
    )) as unknown as (Omit<ShippingRate, 'provider'> & {
      _id: { toString(): string };
      provider?: {
        _id: { toString(): string };
        name: string;
        code: string;
      } | null;
    })[];

    if (!rates || rates.length === 0) {
      throw new NotFoundException(
        'No shipping rates available for this location',
      );
    }

    return rates.map((rate) => {
      let extraWeightCost = 0;
      const freeShippingThreshold = rate.freeShippingThreshold || 0;

      if (subtotal >= freeShippingThreshold && freeShippingThreshold > 0) {
        return {
          providerId: rate.provider?._id?.toString() ?? '',
          providerName: rate.provider?.name ?? '',
          basePrice: rate.basePrice,
          extraWeightCost: 0,
          totalShippingCost: 0,
          estimatedDays: rate.estimatedDays,
          supportsCOD: rate.supportsCOD,
          rateId: rate._id.toString(),
        };
      }

      if (totalWeight > rate.baseWeight) {
        const extraKg = totalWeight - rate.baseWeight;
        extraWeightCost = parseFloat(
          (extraKg * rate.additionalKgPrice).toFixed(2),
        );
      }

      const totalShippingCost = parseFloat(
        (rate.basePrice + extraWeightCost).toFixed(2),
      );

      return {
        providerId: rate.provider?._id?.toString() ?? '',
        providerName: rate.provider?.name ?? '',
        basePrice: rate.basePrice,
        extraWeightCost,
        totalShippingCost,
        estimatedDays: rate.estimatedDays,
        supportsCOD: rate.supportsCOD,
        rateId: rate._id.toString(),
      };
    });
  }

  /**
   * Retrieves a single shipping rate by its ID with populated provider details.
   */
  async getRateById(rateId: string): Promise<any> {
    const rate = await this.findOneDoc({ id: rateId }, '-__v', true, {
      path: 'provider',
      select: 'name code trackingUrl',
    });

    return rate;
  }
}
