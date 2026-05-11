import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tax, TaxDocument } from './shared/schema/tax.schema';
import { CreateTaxDto, UpdateTaxDto } from './shared/dto/tax.dto';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class TaxesService {
  constructor(
    @InjectModel(Tax.name)
    private readonly taxModel: Model<TaxDocument>,
    private readonly settingsService: SettingsService,
  ) {}

  async create(dto: CreateTaxDto): Promise<TaxDocument> {
    return this.taxModel.create(dto);
  }

  async findAll(): Promise<any[]> {
    return this.taxModel.find().sort({ createdAt: -1 }).lean();
  }

  async findOne(id: string): Promise<any> {
    const tax = await this.taxModel.findById(id).lean();
    if (!tax) throw new NotFoundException('Tax not found');
    return tax;
  }

  async update(id: string, dto: UpdateTaxDto): Promise<TaxDocument> {
    const updated = await this.taxModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Tax not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.taxModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Tax not found');
  }

  /**
   * جلب نسبة الضريبة النشطة - نفضل الإعدادات العامة أولاً
   */
  async getActiveTaxPercentage(): Promise<number> {
    const settings = await this.settingsService.getSettings();
    if (settings.vatRate !== undefined && settings.vatRate > 0) {
      return settings.vatRate;
    }

    // Fallback للـ Tax collection القديم
    const activeTax = await this.taxModel
      .findOne({ isActive: true })
      .select('percentage')
      .lean();
    return (activeTax as any)?.percentage ?? 0;
  }

  /**
   * حساب الضريبة بناءً على الإعدادات العامة
   */
  async calculateTax(subtotal: number): Promise<{
    taxPercentage: number;
    taxAmount: number;
    totalWithTax: number;
    isIncluded: boolean;
  }> {
    const settings = await this.settingsService.getSettings();

    // نستخدم القيم من الإعدادات العامة
    const taxPercentage = settings.vatRate ?? 0;
    const isIncluded = settings.taxesIncluded ?? false;

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
