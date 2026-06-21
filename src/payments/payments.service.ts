import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
  PaymentType,
  decryptConfigValues,
} from './shared/schema/payment-method.schema';
import { SettingsService } from '../settings/settings.service';
import { CreatePaymentMethodDto } from './shared/dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './shared/dto/update-payment-method.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

/**
 * Strict whitelist of public (non-secret) fields per payment provider.
 * NEVER spread config. NEVER expose secretKey, webhookSecret, apiSecret.
 */
function buildPublicConfig(
  code: string,
  config: Record<string, unknown>,
): Record<string, unknown> {
  switch (code) {
    case 'moyasar':
      return {
        publishableKey:
          typeof config.publishableKey === 'string'
            ? config.publishableKey
            : undefined,
      };
    case 'stripe':
      return {
        publishableKey:
          typeof config.publishableKey === 'string'
            ? config.publishableKey
            : undefined,
      };
    default:
      return {};
  }
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethodModel: Model<PaymentMethodDocument>,
    private readonly settingsService: SettingsService,
    private readonly i18n: CustomI18nService,
  ) {}

  async create(data: CreatePaymentMethodDto): Promise<PaymentMethodDocument> {
    if (data.isDefault) {
      await this.paymentMethodModel.updateMany({}, { isDefault: false });
    }
    return this.paymentMethodModel.create(data);
  }

  /**
   * جلب الوسائل النشطة - يتم تصفيتها بناءً على الإعدادات العامة
   */
  async getActiveMethods(query?: {
    currency?: string;
    countryId?: string;
  }): Promise<Record<string, unknown>[]> {
    const settings = await this.settingsService.getSettings();

    if (!settings.paymentsEnabled) {
      return [];
    }
    const filterQuery: import('mongoose').FilterQuery<PaymentMethodDocument> = {
      isActive: true,
    };

    if (query?.currency) {
      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({
        $or: [
          { supportedCurrencies: { $exists: false } },
          { supportedCurrencies: { $size: 0 } },
          { supportedCurrencies: query.currency },
        ],
      });
    }

    if (query?.countryId) {
      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({
        $or: [
          { supportedCountries: { $exists: false } },
          { supportedCountries: { $size: 0 } },
          { supportedCountries: query.countryId },
        ],
      });
    }

    // Use .lean() for performance — decryption is done explicitly below
    // instead of relying on the post('find') hook + toObject() chain.
    const methods = await this.paymentMethodModel
      .find(filterQuery)
      .sort({ displayOrder: 1 })
      .lean();

    const methodsWithPublicConfig = methods.map((method) => {
      // Explicitly decrypt config so buildPublicConfig receives plaintext values
      const decryptedConfig = decryptConfigValues(
        method.config ?? {},
      ) as Record<string, unknown>;

      return {
        ...method,
        publicConfig: buildPublicConfig(method.code, decryptedConfig),
        // Never leak raw config to the frontend
        config: undefined,
      };
    });

    return this.i18n.localize(methodsWithPublicConfig) as Record<
      string,
      unknown
    >[];
  }

  async findAll(queryString: QueryString): Promise<any> {
    const features = new ApiFeatures(
      this.paymentMethodModel.find(),
      queryString,
    )
      .filter()
      .search('PaymentMethod');

    const filter = features.getQuery().getFilter();
    const total = await this.paymentMethodModel.countDocuments(filter);

    features.limitFields().paginate(total);

    const data = await features.getQuery().sort({ displayOrder: 1 }).lean();

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(data) as Record<string, unknown>[],
    };
  }

  async findByCode(code: string): Promise<PaymentMethod | null> {
    const settings = await this.settingsService.getSettings();

    if (!settings.paymentsEnabled) {
      return null;
    }

    return this.paymentMethodModel.findOne({ code, isActive: true }).lean();
  }

  async findById(id: string): Promise<PaymentMethodDocument> {
    const method = await this.paymentMethodModel.findById(id);
    if (!method) throw new NotFoundException('Payment method not found');
    return method;
  }

  async update(
    id: string,
    data: UpdatePaymentMethodDto,
  ): Promise<PaymentMethodDocument> {
    if (data.isDefault) {
      await this.paymentMethodModel.updateMany(
        { _id: { $ne: id } },
        { isDefault: false },
      );
    }
    const updated = await this.paymentMethodModel.findByIdAndUpdate(id, data, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Payment method not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.paymentMethodModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Payment method not found');
  }

  async validatePaymentMethod(
    code: string,
    supportsCOD: boolean,
  ): Promise<PaymentMethod> {
    const method = await this.findByCode(code);

    if (!method) {
      throw new NotFoundException(`Payment method "${code}" is not available`);
    }

    if (method.type === PaymentType.CASH_ON_DELIVERY && !supportsCOD) {
      throw new NotFoundException(
        'Cash on delivery is not available for your region or shipping provider',
      );
    }

    return method;
  }
}
