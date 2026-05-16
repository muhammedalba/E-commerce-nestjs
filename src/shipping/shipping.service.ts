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
import { IdParamDto } from 'src/shared/dto/id-param.dto';
import {
  CreateShippingProviderDto,
  UpdateShippingProviderDto,
} from './shared/dto/shipping-provider.dto';


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
  protected slugSourceField = 'name';
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

  /**
   * Creates a new shipping provider with an optional logo.
   * @param data - The data for creating the shipping provider.
   * @param file - The uploaded logo file (optional).
   * @returns The created shipping provider document.
   */
  async createProvider(
    data: CreateShippingProviderDto,
    file?: MulterFileType,
  ): Promise<ShippingProviderDocument> {
    return (await this.createOneDoc(data, file, ShippingProvider.name, {
      fileFieldName: 'logo',
      checkField: 'name',
      fieldValue: data.name,
      useDefaultFile: true,
    })) as ShippingProviderDocument;
  }

  /**
   * Retrieves all shipping providers with pagination, searching, and filtering.
   * @param query - The query parameters for filtering and pagination.
   * @returns An object containing the localized providers and pagination info.
   */
  async getProviders(query: QueryString): Promise<any> {
    return await this.findAllDoc(ShippingProvider.name, query);
  }

  /**
   * Updates an existing shipping provider and its logo.
   * @param id - The ID of the shipping provider to update.
   * @param data - The update data.
   * @param file - The new logo file (optional).
   * @returns The updated shipping provider document.
   * @throws NotFoundException if the provider does not exist.
   */
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

  /**
   * Deletes a shipping provider, its associated logo, and all its shipping rates.
   * @param id - The ID of the shipping provider to delete.
   * @returns A success message.
   */
  async deleteProvider(id: string): Promise<{ message: string }> {
    const idParam: IdParamDto = { id };
    await this.deleteOneDoc(idParam, 'logo');

    // Remove associated rates to maintain data integrity
    await this.rateModel.deleteMany({ provider: id });

    return { message: 'Shipping provider deleted successfully' };
  }
}
