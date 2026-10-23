import { Types } from 'mongoose';

// Pulls in sharp and the ESM-only uuid; the uploads are mocked below.
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

import { OrderService } from './order.service';

/** Mongoose query stand-in: chainable `.select().lean()` and directly awaitable. */
const query = <T>(value: T) => {
  const q = {
    select: () => q,
    lean: () => q,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const id = new Types.ObjectId().toString();
const receipt = {
  url: '/uploads/Order/receipt.webp',
  publicId: 'r',
  provider: 'local',
};
const issuedInvoice = {
  url: '/uploads/Invoice/RUH-8-2026-0042.pdf',
  publicId: 'i',
  provider: 'local',
};
const manualPdf = {
  url: '/uploads/Order/manual.pdf',
  publicId: 'm',
  provider: 'local',
};

const createService = (
  current: Record<string, unknown>,
  issued = issuedInvoice,
  updated: Record<string, unknown> = {},
) => {
  const OrderModel = {
    findById: jest.fn(() => query({ status: 'processing', ...current })),
    findByIdAndUpdate: jest.fn(() =>
      Promise.resolve({ _id: id, user: 'u1', ...updated }),
    ),
    findOneAndDelete: jest.fn(() => query({ ...current })),
  };
  const fileUploadService = {
    deleteFile: jest.fn(() => Promise.resolve()),
    deleteFiles: jest.fn(() => Promise.resolve()),
    updateFile: jest.fn(() => Promise.resolve(manualPdf)),
    saveFileToDisk: jest.fn(() => Promise.resolve(manualPdf)),
  };
  const invoiceService = {
    findIssued: jest.fn(() => Promise.resolve({ status: 'generated' })),
    isIssuedInvoiceFile: jest.fn((_: string, asset?: { url?: string }) =>
      Promise.resolve(!!asset && asset.url === issued.url),
    ),
  };
  const UserModel = {
    findById: jest.fn(() => query({ email: 'a@b.c', name: 'Ali' })),
  };
  const orderEmailService = {
    sendPaymentReceivedEmail: jest.fn(() => Promise.resolve()),
  };
  const service = new OrderService(
    OrderModel as never,
    UserModel as never,
    { translate: (k: string) => k } as never,
    fileUploadService as never,
    {} as never,
    orderEmailService as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { emit: jest.fn() } as never,
    {} as never,
    invoiceService as never,
    {} as never,
    {} as never,
  );
  return {
    service,
    OrderModel,
    fileUploadService,
    orderEmailService,
    invoiceService,
  };
};

const noFiles = {} as never;

describe('OrderService.update: order files', () => {
  it('keeps the delivery receipt and the invoice on a status-only update', async () => {
    const { service, fileUploadService } = createService({
      DeliveryReceiptImage: receipt,
      InvoicePdf: issuedInvoice,
    });
    await service.update({ id }, { deliveryName: 'Aramex' }, noFiles);
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
  });

  it('deletes the delivery receipt when it is removed explicitly', async () => {
    const { service, fileUploadService } = createService({
      DeliveryReceiptImage: receipt,
    });
    await service.update(
      { id },
      { DeliveryReceiptImage: '' } as never,
      noFiles,
    );
    expect(fileUploadService.deleteFile).toHaveBeenCalledWith(receipt);
  });

  it('deletes a manually uploaded invoice when it is removed explicitly', async () => {
    const { service, fileUploadService } = createService({
      InvoicePdf: manualPdf,
    });
    await service.update({ id }, { InvoicePdf: null } as never, noFiles);
    expect(fileUploadService.deleteFile).toHaveBeenCalledWith(manualPdf);
  });

  it('never deletes the issued invoice file, only unlinks it', async () => {
    const { service, fileUploadService } = createService({
      InvoicePdf: issuedInvoice,
    });
    await service.update({ id }, { InvoicePdf: '' } as never, noFiles);
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
  });

  it('replaces the issued invoice on the order without deleting its file', async () => {
    const { service, fileUploadService, OrderModel } = createService({
      InvoicePdf: issuedInvoice,
    });
    const upload = { originalname: 'new.pdf', buffer: Buffer.from('%PDF-') };
    await service.update({ id }, {}, {
      InvoicePdf: [upload],
    } as never);
    expect(fileUploadService.saveFileToDisk).toHaveBeenCalledWith(
      upload,
      'Order',
    );
    expect(fileUploadService.updateFile).not.toHaveBeenCalled();
    expect(fileUploadService.deleteFile).not.toHaveBeenCalled();
    expect(OrderModel.findByIdAndUpdate).toHaveBeenCalledWith(
      { _id: id },
      { $set: expect.objectContaining({ InvoicePdf: manualPdf }) as unknown },
      expect.anything(),
    );
  });
});

describe('OrderService.remove: order files', () => {
  it('deletes the order files but keeps the issued invoice', async () => {
    const { service, fileUploadService } = createService({
      DeliveryReceiptImage: receipt,
      InvoicePdf: issuedInvoice,
    });
    await service.remove({ id });
    expect(fileUploadService.deleteFiles).toHaveBeenCalledWith([receipt]);
  });
});

describe('OrderService.update: payment', () => {
  it('emails the invoice when an admin marks the order paid', async () => {
    const { service, orderEmailService } = createService(
      { paymentStatus: 'PENDING' },
      issuedInvoice,
      { paymentStatus: 'PAID' },
    );
    await service.update({ id }, { paymentStatus: 'PAID' } as never, noFiles);
    expect(orderEmailService.sendPaymentReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'PAID' }),
      { email: 'a@b.c', name: 'Ali' },
    );
  });

  it('emails nothing when it was paid already, or only the status changes', async () => {
    const paid = createService({ paymentStatus: 'PAID' }, issuedInvoice, {
      paymentStatus: 'PAID',
    });
    await paid.service.update(
      { id },
      { paymentStatus: 'PAID' } as never,
      noFiles,
    );
    expect(
      paid.orderEmailService.sendPaymentReceivedEmail,
    ).not.toHaveBeenCalled();

    const shipped = createService({ paymentStatus: 'PENDING' }, issuedInvoice, {
      paymentStatus: 'PENDING',
    });
    await shipped.service.update({ id }, { deliveryName: 'Aramex' }, noFiles);
    expect(
      shipped.orderEmailService.sendPaymentReceivedEmail,
    ).not.toHaveBeenCalled();
  });
});

describe('OrderService.resendInvoiceEmail', () => {
  it('emails the issued invoice again, past the once-only rule', async () => {
    const { service, orderEmailService } = createService({ user: 'u1' });
    await service.resendInvoiceEmail(id);
    expect(orderEmailService.sendPaymentReceivedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'u1' }),
      { email: 'a@b.c', name: 'Ali' },
      { resend: true },
    );
  });

  it('refuses an order whose invoice is not issued', async () => {
    const { service, orderEmailService, invoiceService } = createService({});
    invoiceService.findIssued.mockResolvedValueOnce(null as never);
    await expect(service.resendInvoiceEmail(id)).rejects.toThrow(
      'No issued invoice for this order',
    );
    expect(orderEmailService.sendPaymentReceivedEmail).not.toHaveBeenCalled();
  });
});
