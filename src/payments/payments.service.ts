import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  PaymentMethodDocument,
} from './shared/schema/payment-method.schema';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethodModel: Model<PaymentMethodDocument>,
    private readonly settingsService: SettingsService,
  ) {}

  async create(data: Partial<PaymentMethod>): Promise<PaymentMethodDocument> {
    return this.paymentMethodModel.create(data);
  }

  /**
   * جلب الوسائل النشطة - يتم تصفيتها بناءً على الإعدادات العامة
   */
  async getActiveMethods(): Promise<any[]> {
    const settings = await this.settingsService.getSettings();
    const allMethods = await this.paymentMethodModel
      .find({ isActive: true })
      .sort({ displayOrder: 1 })
      .lean();

    // تصفية الوسائل بناءً على الـ Gateways في الإعدادات
    return allMethods.filter((method) => {
      const code = method.code;
      // نتحقق إذا كانت البوابة مفعلة في الإعدادات العامة
      return settings.gateways?.[code] !== false;
    });
  }

  async findAll(): Promise<any[]> {
    return this.paymentMethodModel.find().sort({ displayOrder: 1 }).lean();
  }

  async findByCode(code: string): Promise<any> {
    const settings = await this.settingsService.getSettings();

    // إذا كانت البوابة معطلة في الإعدادات العامة، نعتبرها غير موجودة
    if (settings.gateways?.[code] === false) {
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
    data: Partial<PaymentMethod>,
  ): Promise<PaymentMethodDocument> {
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
  ): Promise<any> {
    const method = await this.findByCode(code);

    if (!method) {
      throw new NotFoundException(`Payment method "${code}" is not available`);
    }

    if (code === 'cod' && !supportsCOD) {
      throw new NotFoundException(
        'Cash on delivery is not available for your region',
      );
    }

    return method;
  }
}
