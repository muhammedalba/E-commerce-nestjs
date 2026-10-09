import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import {
  ONLINE_PAYMENT_TYPES,
  SUPPORTED_ONLINE_PAYMENT_CODES,
} from './shared/constants/payment-methods.constants';
import { decryptConfigValues } from './shared/utils/encryption.util';
import {
  findSecretLikePaths,
  maskSecretConfig,
  mergeSecretConfig,
} from './shared/utils/secret-config.util';

// Removed buildPublicConfig function as we now use native publicConfig field.

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private readonly paymentMethodModel: Model<PaymentMethodDocument>,
    private readonly settingsService: SettingsService,
    private readonly i18n: CustomI18nService,
  ) {}

  async create(data: CreatePaymentMethodDto): Promise<PaymentMethod> {
    this.assertNoSecretsInPublicConfig(data.publicConfig);
    if (data.isDefault) {
      await this.paymentMethodModel.updateMany({}, { isDefault: false });
    }
    const created = await this.paymentMethodModel.create(
      data.secretConfig
        ? { ...data, secretConfig: mergeSecretConfig({}, data.secretConfig) }
        : data,
    );
    return this.toAdminView(created.toObject());
  }

  /**
   * publicConfig is returned to every visitor by GET /payments (and cached),
   * so a secret saved there by mistake would be public.
   *
   * @throws {BadRequestException} Naming the secret-looking paths.
   */
  private assertNoSecretsInPublicConfig(
    publicConfig?: Record<string, unknown>,
  ) {
    const paths = findSecretLikePaths(publicConfig ?? {});
    if (paths.length > 0) {
      throw new BadRequestException(
        `publicConfig is visible to every customer; move ${paths.join(', ')} to secretConfig`,
      );
    }
  }

  /**
   * What the admin API returns for a method: `secretConfig` masked, never the
   * real secrets (anyone with view permission would otherwise read live keys).
   * Accepts encrypted or already-decrypted values.
   */
  private toAdminView<T extends { secretConfig?: unknown }>(method: T): T {
    if (method.secretConfig === undefined) return method;
    return {
      ...method,
      secretConfig: maskSecretConfig(decryptConfigValues(method.secretConfig)),
    };
  }

  /**
   * جلب الوسائل النشطة - يتم تصفيتها بناءً على الإعدادات العامة
   */
  async getActiveMethods(query?: {
    currency?: string;
    countryId?: string;
  }): Promise<Record<string, unknown>[]> {
    // 1. Check if online payments are enabled (Ensure getSettings uses caching under the hood)
    const settings = await this.settingsService.getSettings();

    // 2. Build Query Declaratively
    const filterQuery: import('mongoose').FilterQuery<PaymentMethodDocument> = {
      isActive: true,
    };

    const andConditions: any[] = [
      // Online methods without an integration would never charge the customer.
      // With online payments disabled, only offline methods (COD, bank transfer) remain.
      settings.paymentsEnabled
        ? {
            $or: [
              { type: { $nin: ONLINE_PAYMENT_TYPES } },
              { code: { $in: SUPPORTED_ONLINE_PAYMENT_CODES } },
            ],
          }
        : { type: { $nin: ONLINE_PAYMENT_TYPES } },
    ];

    if (query?.currency) {
      andConditions.push({
        $or: [
          { supportedCurrencies: { $exists: false } },
          { supportedCurrencies: { $size: 0 } },
          { supportedCurrencies: query.currency },
        ],
      });
    }

    if (query?.countryId) {
      andConditions.push({
        $or: [
          { supportedCountries: { $exists: false } },
          { supportedCountries: { $size: 0 } },
          { supportedCountries: query.countryId },
        ],
      });
    }

    if (andConditions.length > 0) {
      filterQuery.$and = andConditions;
    }

    // 3. Fetch Data
    const methods = await this.paymentMethodModel
      .find(filterQuery)
      .sort({ displayOrder: 1, _id: 1 })
      .select(
        'publicConfig code name provider description type feeType fixedFee percentageFee passFeesToCustomer requiresOnlineConfirmation requiresAdditionalInfo icon displayOrder isDefault',
      )
      .lean();

    // 4. Localize and Return
    return this.i18n.localize(methods);
  }

  // get all payment methods for admin
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

    const data = await features
      .getQuery()
      .sort({ displayOrder: 1, _id: 1 })
      .lean();

    return {
      results: data.length,
      pagination: features.getPagination(),
      data: this.i18n.localize(
        data.map((method) =>
          this.toAdminView(method as { secretConfig?: unknown }),
        ),
      ) as Record<string, unknown>[],
    };
  }
  // find payment method by code
  async findByCode(code: string): Promise<PaymentMethod | null> {
    const settings = await this.settingsService.getSettings();

    // `paymentsEnabled` only switches off online methods; offline ones stay usable.
    return this.paymentMethodModel
      .findOne({
        code,
        isActive: true,
        ...(!settings.paymentsEnabled && {
          type: { $nin: ONLINE_PAYMENT_TYPES },
        }),
      })
      .lean();
  }

  /**
   * Loads a method's stored credentials for server-side provider calls.
   * Unlike findByCode it ignores `paymentsEnabled` and `isActive`: payments
   * already in flight must still be verified after an admin disables online payments
   * or the method, instead of silently falling back to environment keys.
   */
  async findCredentialsByCode(code: string): Promise<PaymentMethod | null> {
    return this.paymentMethodModel.findOne({ code }).lean();
  }
  // find payment method by id
  async findById(id: string): Promise<PaymentMethod> {
    const method = await this.paymentMethodModel.findById(id).lean();
    if (!method) throw new NotFoundException('Payment method not found');
    return this.toAdminView(method);
  }
  // update payment method
  async update(
    id: string,
    data: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    this.assertNoSecretsInPublicConfig(data.publicConfig);
    let update = data;
    if (data.secretConfig) {
      // Merge per key (see mergeSecretConfig): the admin form sends back the
      // masked values it received, and a partial update must not wipe keys.
      const current = await this.paymentMethodModel
        .findById(id)
        .select('secretConfig')
        .lean();
      if (!current) throw new NotFoundException('Payment method not found');
      update = {
        ...data,
        secretConfig: mergeSecretConfig(
          decryptConfigValues(current.secretConfig ?? {}) as Record<
            string,
            unknown
          >,
          data.secretConfig,
        ),
      };
    }
    if (data.isDefault) {
      await this.paymentMethodModel.updateMany(
        { _id: { $ne: id } },
        { isDefault: false },
      );
    }
    const updated = await this.paymentMethodModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Payment method not found');
    return this.toAdminView(updated);
  }
  // delete payment method
  async remove(id: string): Promise<void> {
    const deleted = await this.paymentMethodModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Payment method not found');
  }
  // validate payment method
  async validatePaymentMethod(
    code: string,
    supportsCOD: boolean,
  ): Promise<PaymentMethod> {
    const method = await this.findByCode(code);

    if (
      !method ||
      (ONLINE_PAYMENT_TYPES.includes(method.type) &&
        !SUPPORTED_ONLINE_PAYMENT_CODES.includes(method.code))
    ) {
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
