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
import { MulterFileType } from 'src/shared/utils/interfaces/fileInterface';
import { BaseService } from 'src/shared/utils/service/base.service';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import {
  CreateShippingProviderDto,
  UpdateShippingProviderDto,
} from './shared/dto/shipping-provider.dto';
import {
  CreateShippingRateDto,
  UpdateShippingRateDto,
} from './shared/dto/shipping-rate.dto';

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
export class ShippingService extends BaseService<ShippingProviderDocument> {
  constructor(
    @InjectModel(ShippingProvider.name)
    private readonly providerModel: Model<ShippingProviderDocument>,

    @InjectModel(ShippingRate.name)
    private readonly rateModel: Model<ShippingRateDocument>,

    protected readonly fileUploadService: FileUploadService,
    protected readonly i18n: CustomI18nService,
  ) {
    super(providerModel, i18n, fileUploadService);
  }

  /* ================================================ */
  /*  SHIPPING PROVIDERS CRUD (using BaseService)     */
  /* ================================================ */

  async createProvider(
    data: CreateShippingProviderDto,
    file?: MulterFileType,
  ): Promise<ShippingProviderDocument> {
    console.log("file",file);
    console.log("data",data);
    
    return (await this.createOneDoc(data, file, ShippingProvider.name, {
      fileFieldName: 'logo',
      checkField: 'name',
      fieldValue: data.name,
    })) as ShippingProviderDocument;
  }

  async getProviders(query: QueryString): Promise<any> {
    return await this.findAllDoc(ShippingProvider.name, query);
  }

  async updateProvider(
    id: string,
    data: UpdateShippingProviderDto,
    file?: MulterFileType,
  ): Promise<ShippingProviderDocument> {
    const idParam: IdParamDto = { id };
    const updated = await this.updateOneDoc(
      idParam,
      data,
      file,
      ShippingProvider.name,
      'name logo code trackingUrl isActive',
      {
        fileFieldName: 'logo',
        checkField: 'name',
        fieldValue: (data as any).name,
      },
    );
    if (!updated) throw new NotFoundException('Shipping provider not found');
    return updated as ShippingProviderDocument;
  }

  async deleteProvider(id: string): Promise<{ message: string }> {
    const idParam: IdParamDto = { id };
    await this.deleteOneDoc(idParam, 'logo');

    // Remove associated rates
    await this.rateModel.deleteMany({ provider: id });

    return { message: 'Shipping provider deleted successfully' };
  }

  /* ================================================ */
  /*  SHIPPING RATES CRUD                             */
  /* ================================================ */

  async createRate(data: CreateShippingRateDto): Promise<ShippingRateDocument> {
    return this.rateModel.create(data);
  }

  async getRates(query: QueryString): Promise<any> {
    const { results, pagination, data } = await this.findAllDoc(
      ShippingRate.name,
      query,
    );

    // Manual population for the result of findAllDoc if needed, 
    // but findAllDoc might not support complex population easily.
    // Let's use a custom find if needed, or update findAllDoc.
    // Actually, findAllDoc supports a 'populate' parameter.
    
    // We need to populate provider, country, region, city
    // findAllDoc only supports one path for now.
    // Let's implement it manually here to get full detail.
    
    // Or better, let's use the rateModel directly to ensure full population.
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

  async getRatesByCity(cityId: string): Promise<any[]> {
    return this.rateModel
      .find({ city: cityId })
      .populate('provider', 'name code logo trackingUrl')
      .lean();
  }

  async updateRate(
    id: string,
    data: UpdateShippingRateDto,
  ): Promise<ShippingRateDocument> {
    const updated = await this.rateModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Shipping rate not found');
    return updated;
  }

  async deleteRate(id: string): Promise<{ message: string }> {
    const deleted = await this.rateModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Shipping rate not found');
    return { message: 'Shipping rate deleted successfully' };
  }

  /* ================================================ */
  /*  CALCULATION LOGIC                               */
  /* ================================================ */

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
