import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseService } from 'src/shared/utils/service/base.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import {
  ShippingRate,
  ShippingRateDocument,
} from './shared/schema/shipping-rate.schema';
import {
  CreateShippingRateDto,
  UpdateShippingRateDto,
} from './shared/dto/shipping-rate.dto';
import { ShippingProvider } from './shared/schema/shipping-provider.schema';

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

    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(rateModel, i18n, fileUploadService);
  }

  /**
   * Creates a new shipping rate.
   * @param data - The data for creating the shipping rate.
   * @returns The created shipping rate document.
   */
  async createRate(data: CreateShippingRateDto): Promise<ShippingRateDocument> {
    return this.createOneDoc(data, undefined, ShippingRate.name, {
      onlyActive: true,
      fieldValue: data.city,
      checkField: 'city',
    });
  }

  /**
   * Retrieves all shipping rates with pagination, searching, and filtering.
   * Automatically populates provider and location details and localizes the results.
   * @param query - The query parameters for filtering, sorting, and pagination.
   * @returns An object containing the localized rates, total count, and pagination info.
   */
  async getRates(query: QueryString): Promise<any> {
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
      data: this.i18n.localize(populatedData),
    };
  }

  /**
   * Retrieves active shipping rates for a specific city.
   * @param cityId - The ID of the city to filter rates for.
   * @returns A localized list of active shipping rates for the given city.
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
   * @param id - The ID of the shipping rate to update.
   * @param data - The update data.
   * @returns The updated shipping rate document.
   */
  async updateRate(
    id: string,
    data: UpdateShippingRateDto,
  ): Promise<ShippingRateDocument> {
    const updated = await this.updateOneDoc({ id }, data, undefined, ShippingRate.name, '', {
      onlyActive: true,
      fieldValue: data.city,
      checkField: 'city',
    });
    return updated as ShippingRateDocument;
  }

  /**
   * Deletes a shipping rate by ID.
   * @param id - The ID of the shipping rate to delete.
   * @returns A success message.
   */
  async deleteRate(id: string): Promise<{ message: string }> {
    await this.deleteOneDoc({ id });
    return { message: 'Shipping rate deleted successfully' };
  }

  /**
   * Calculates shipping costs for a specific city and weight.
   * Considers base weight, extra weight pricing, and active status.
   * @param cityId - Target city ID.
   * @param totalWeight - Total weight of the shipment.
   * @returns A list of available shipping options with calculated costs.
   * @throws NotFoundException if no active rates are found for the city.
   */
  async calculateShipping(
    cityId: string,
    totalWeight: number,
  ): Promise<ShippingCalculationResult[]> {
    const rates = (await this.rateModel
      .find({ city: cityId, isActive: true })
      .populate<{ provider: ShippingProvider }>('provider', 'name code')
      .lean()) as any[];

    if (!rates || rates.length === 0) {
      throw new NotFoundException('No shipping rates available for this city');
    }

    return rates.map((rate) => {
      let extraWeightCost = 0;

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
   * @param rateId - The ID of the rate to retrieve.
   * @returns The shipping rate document.
   */
  async getRateById(rateId: string): Promise<any> {
    const rate = await this.findOneDoc({ id: rateId }, "-__v", true, { path: 'provider', select: 'name code trackingUrl' });

    return rate;
  }
}
