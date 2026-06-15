import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
  PaymentType,
} from './shared/schema/payment-method.schema';
import { SettingsService } from '../settings/settings.service';
import { CreatePaymentMethodDto } from './shared/dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './shared/dto/update-payment-method.dto';
import { QueryString } from 'src/shared/utils/interfaces/queryInterface';
import { ApiFeatures } from 'src/shared/utils/ApiFeatures';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethodModel: Model<PaymentMethodDocument>,
    private readonly settingsService: SettingsService,
  ) {}

  async create(data: CreatePaymentMethodDto): Promise<PaymentMethodDocument> {
    console.log(data);

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
    countryCode?: string;
  }): Promise<any[]> {
    const settings = await this.settingsService.getSettings();

    if (!settings.paymentsEnabled) {
      return [];
    }

    let methods = await this.paymentMethodModel
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();

    if (query?.currency) {
      methods = methods.filter(
        (m) =>
          !m.supportedCurrencies ||
          m.supportedCurrencies.length === 0 ||
          m.supportedCurrencies.includes(query.currency!),
      );
    }

    if (query?.countryCode) {
      methods = methods.filter(
        (m) =>
          !m.supportedCountries ||
          m.supportedCountries.length === 0 ||
          m.supportedCountries.includes(query.countryCode!),
      );
    }

    return methods;
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

    features.sort().limitFields().paginate(total);

    const data = await features.getQuery().lean();

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: data,
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
