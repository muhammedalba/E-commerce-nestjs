import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ShippingProvider,
  ShippingProviderDocument,
} from './shared/schema/shipping-provider.schema';
import {
  ShippingRate,
  ShippingRateDocument,
} from './shared/schema/shipping-rate.schema';

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
export class ShippingService {
  constructor(
    @InjectModel(ShippingProvider.name)
    private readonly providerModel: Model<ShippingProviderDocument>,

    @InjectModel(ShippingRate.name)
    private readonly rateModel: Model<ShippingRateDocument>,
  ) {}

  async createProvider(
    data: Partial<ShippingProvider>,
  ): Promise<ShippingProviderDocument> {
    return this.providerModel.create(data);
  }

  async getProviders(): Promise<any[]> {
    return this.providerModel.find({ isActive: true }).lean();
  }

  async updateProvider(
    id: string,
    data: Partial<ShippingProvider>,
  ): Promise<ShippingProviderDocument> {
    const updated = await this.providerModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Shipping provider not found');
    return updated;
  }

  async createRate(data: Partial<ShippingRate>): Promise<ShippingRateDocument> {
    return this.rateModel.create(data);
  }

  async getRatesByCity(cityId: string): Promise<any[]> {
    return this.rateModel
      .find({ city: cityId, isActive: true })
      .populate('provider', 'name code logo trackingUrl')
      .lean();
  }

  async updateRate(
    id: string,
    data: Partial<ShippingRate>,
  ): Promise<ShippingRateDocument> {
    const updated = await this.rateModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Shipping rate not found');
    return updated;
  }

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

  async getRateById(rateId: string): Promise<any> {
    const rate = await this.rateModel
      .findById(rateId)
      .populate('provider', 'name code trackingUrl')
      .lean();

    if (!rate) throw new NotFoundException('Shipping rate not found');
    return rate;
  }
}
