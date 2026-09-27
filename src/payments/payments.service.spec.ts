import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaymentsService } from './payments.service';
import { PaymentType } from './shared/schema/payment-method.schema';
import { CreatePaymentMethodDto } from './shared/dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './shared/dto/update-payment-method.dto';
import { VerifyPaymentParamDto } from './shared/dto/link-moyasar-payment.dto';

// SettingsService pulls in file-upload → ESM-only `uuid`.
jest.mock('src/settings/settings.service', () => ({
  SettingsService: class {},
}));

const createService = (method: Record<string, unknown> | null) => {
  const lean = jest.fn(() => Promise.resolve(method));
  const find = jest.fn(() => ({
    sort: () => ({ select: () => ({ lean: () => Promise.resolve([]) }) }),
  }));
  const model = { findOne: jest.fn(() => ({ lean })), find };
  const service = new PaymentsService(
    model as never,
    {
      getSettings: () => Promise.resolve({ paymentsEnabled: true }),
    } as never,
    { localize: (v: unknown) => v } as never,
  );
  return { service, model };
};

describe('PaymentsService.validatePaymentMethod', () => {
  it.each([
    ['stripe', PaymentType.CARD],
    ['paypal', PaymentType.WALLET],
    ['tabby', PaymentType.BUY_NOW_PAY_LATER],
  ])(
    'rejects online method "%s", which has no integration and would never charge',
    async (code, type) => {
      const { service } = createService({ code, type });

      await expect(
        service.validatePaymentMethod(code, true),
      ).rejects.toMatchObject({ status: 404 });
    },
  );

  it.each([
    ['moyasar', PaymentType.CARD],
    ['cod', PaymentType.CASH_ON_DELIVERY],
    ['banktransfer', PaymentType.BANK_TRANSFER],
  ])('accepts "%s"', async (code, type) => {
    const { service } = createService({ code, type });

    await expect(service.validatePaymentMethod(code, true)).resolves.toEqual({
      code,
      type,
    });
  });
});

describe('PaymentsService.getActiveMethods', () => {
  it('hides online methods without an integration', async () => {
    const { service, model } = createService(null);

    await service.getActiveMethods();

    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: [
          {
            $or: [
              {
                type: {
                  $nin: [
                    PaymentType.CARD,
                    PaymentType.WALLET,
                    PaymentType.BUY_NOW_PAY_LATER,
                  ],
                },
              },
              { code: { $in: ['moyasar'] } },
            ],
          },
        ],
      }),
    );
  });
});

describe('payment method fee bounds', () => {
  const base = {
    name: { ar: 'دفع عند الاستلام', en: 'Cash on delivery' },
    code: 'x',
    type: PaymentType.CASH_ON_DELIVERY,
    feeType: 'fixed',
    provider: 'COD',
  };
  const errorsFor = async (cls: new () => object, body: object) =>
    (await validate(plainToInstance(cls, body))).map((e) => e.property);

  it.each([
    [{ fixedFee: -5 }, 'fixedFee'],
    [{ percentageFee: -1 }, 'percentageFee'],
    [{ percentageFee: 101 }, 'percentageFee'],
  ])('rejects %o on create', async (fees, property) => {
    expect(
      await errorsFor(CreatePaymentMethodDto, { ...base, ...fees }),
    ).toEqual([property]);
  });

  it('rejects a negative fee on update too', async () => {
    expect(await errorsFor(UpdatePaymentMethodDto, { fixedFee: -1 })).toEqual([
      'fixedFee',
    ]);
  });

  it('accepts 0-100 percent and non-negative fixed fees', async () => {
    expect(
      await errorsFor(CreatePaymentMethodDto, {
        ...base,
        fixedFee: 0,
        percentageFee: 100,
      }),
    ).toEqual([]);
  });
});

describe('VerifyPaymentParamDto', () => {
  it.each(['../invoices/x', 'a/b', 'x'.repeat(65)])(
    'rejects %s',
    async (id) => {
      const errors = await validate(
        plainToInstance(VerifyPaymentParamDto, { invoiceId: id }),
      );
      expect(errors).toHaveLength(1);
    },
  );

  it('accepts a Moyasar payment id', async () => {
    const errors = await validate(
      plainToInstance(VerifyPaymentParamDto, {
        invoiceId: '760878ec-d1d3-5f72-9056-191683f55872',
      }),
    );
    expect(errors).toEqual([]);
  });
});

describe('PaymentsService admin views never expose secrets', () => {
  const stored = {
    MOYASAR_SECRET_KEY: 'sk_live_abcdefgh1234',
    MOYASAR_WEBHOOK_SECRET: 'whsec_987654321',
  };
  const createAdminService = () => {
    const doc = { _id: 'm1', code: 'moyasar', secretConfig: stored };
    const byIdQuery = {
      select: () => byIdQuery,
      lean: () => Promise.resolve(doc),
    };
    const model = {
      findById: jest.fn(() => byIdQuery),
      findByIdAndUpdate: jest.fn(
        (_id: string, update: Record<string, unknown>) => ({
          lean: () => Promise.resolve({ ...doc, ...update }),
        }),
      ),
      create: jest.fn((data: Record<string, unknown>) =>
        Promise.resolve({ toObject: () => ({ _id: 'm2', ...data }) }),
      ),
      updateMany: jest.fn(),
    };
    const service = new PaymentsService(
      model as never,
      {} as never,
      { localize: (v: unknown) => v } as never,
    );
    return { service, model };
  };
  const leaksSecret = (value: unknown) =>
    JSON.stringify(value).includes('sk_live_') ||
    JSON.stringify(value).includes('whsec_');

  it('masks secretConfig on GET /payments/:id', async () => {
    const { service } = createAdminService();

    const method = await service.findById('m1');

    expect(leaksSecret(method)).toBe(false);
    expect(method.secretConfig).toEqual({
      MOYASAR_SECRET_KEY: '••••••••1234',
      MOYASAR_WEBHOOK_SECRET: '••••••••4321',
    });
  });

  it('merges an update that echoes masked values and changes one key', async () => {
    const { service, model } = createAdminService();

    const result = await service.update('m1', {
      secretConfig: {
        MOYASAR_SECRET_KEY: '••••••••1234',
        MOYASAR_WEBHOOK_SECRET: 'whsec_new_value',
      },
    });

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'm1',
      {
        secretConfig: {
          MOYASAR_SECRET_KEY: 'sk_live_abcdefgh1234',
          MOYASAR_WEBHOOK_SECRET: 'whsec_new_value',
        },
      },
      { new: true },
    );
    expect(leaksSecret(result)).toBe(false);
  });

  it('keeps the other keys when only one is sent', async () => {
    const { service, model } = createAdminService();

    await service.update('m1', {
      secretConfig: { MOYASAR_SECRET_KEY: 'sk_live_rotated_0000' },
    });

    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'm1',
      {
        secretConfig: {
          MOYASAR_SECRET_KEY: 'sk_live_rotated_0000',
          MOYASAR_WEBHOOK_SECRET: 'whsec_987654321',
        },
      },
      { new: true },
    );
  });

  it('masks secretConfig in the create response', async () => {
    const { service } = createAdminService();

    const created = await service.create({
      name: { ar: 'بطاقة بنكية', en: 'Bank card' },
      code: 'moyasar2',
      type: PaymentType.CARD,
      feeType: 'fixed' as never,
      provider: 'MOYASAR',
      secretConfig: { MOYASAR_SECRET_KEY: 'sk_live_abcdefgh1234' },
    });

    expect(leaksSecret(created)).toBe(false);
  });
});

describe('PaymentsService publicConfig', () => {
  it.each([
    [
      'create',
      (s: PaymentsService) =>
        s.create({
          name: { ar: 'بطاقة بنكية', en: 'Bank card' },
          code: 'moyasar',
          type: PaymentType.CARD,
          feeType: 'fixed' as never,
          provider: 'MOYASAR',
          publicConfig: { publishableKey: 'pk_x', secretKey: 'sk_live_1' },
        }),
    ],
    [
      'update',
      (s: PaymentsService) =>
        s.update('m1', { publicConfig: { key: 'sk_live_1' } }),
    ],
  ])(
    'rejects secrets in publicConfig on %s, before writing',
    async (_, call) => {
      const model = {
        create: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        updateMany: jest.fn(),
        findById: jest.fn(),
      };
      const service = new PaymentsService(
        model as never,
        {} as never,
        { localize: (v: unknown) => v } as never,
      );

      await expect(call(service)).rejects.toMatchObject({ status: 400 });
      expect(model.create).not.toHaveBeenCalled();
      expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );
});
