import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditService } from './audit.service';
import { REDACTED, redactSensitive } from './shared/audit.constants';

interface QueryMock {
  select: jest.Mock<QueryMock>;
  sort: jest.Mock<QueryMock>;
  skip: jest.Mock<QueryMock>;
  limit: jest.Mock<QueryMock>;
  lean: jest.Mock<Promise<unknown>>;
}

function chain(result: unknown): QueryMock {
  const q = {} as QueryMock;
  q.select = jest.fn<QueryMock, []>(() => q);
  q.sort = jest.fn<QueryMock, []>(() => q);
  q.skip = jest.fn<QueryMock, []>(() => q);
  q.limit = jest.fn<QueryMock, []>(() => q);
  q.lean = jest.fn(() => Promise.resolve(result));
  return q;
}

function setup() {
  const model = {
    create: jest.fn((docs: unknown[]) => Promise.resolve(docs)),
    countDocuments: jest.fn(() => Promise.resolve(45)),
    find: jest.fn(() => chain([{ _id: 'a' }])),
    findById: jest.fn(() => chain(null)),
    distinct: jest.fn((field: string) =>
      Promise.resolve(field === 'module' ? ['users', 'order'] : ['UPDATE']),
    ),
  };
  return { model, service: new AuditService(model as never) };
}

describe('redactSensitive', () => {
  it('replaces sensitive keys at any depth and keeps the rest', () => {
    const id = new Types.ObjectId();
    const date = new Date();
    expect(
      redactSensitive({
        password: 'x',
        nested: { accessToken: 't', apiKey: 'k', name: 'n', id, date },
        list: [{ client_secret: 's', amount: 5 }],
      }),
    ).toEqual({
      password: REDACTED,
      nested: { accessToken: REDACTED, apiKey: REDACTED, name: 'n', id, date },
      list: [{ client_secret: REDACTED, amount: 5 }],
    });
  });

  it('passes undefined through', () => {
    expect(redactSensitive(undefined)).toBeUndefined();
  });
});

describe('AuditService', () => {
  it('log lower-cases the module and redacts the data', async () => {
    const { model, service } = setup();
    await service.log({
      action: 'UPDATE',
      module: 'ORDER',
      newData: { password: 'p', status: 'paid' },
    });
    expect(model.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          module: 'order',
          newData: { password: REDACTED, status: 'paid' },
        }),
      ],
      {},
    );
  });

  it('record never throws when the write fails', async () => {
    const { model, service } = setup();
    model.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.record('DELETE', 'users', { userId: 'u1' }),
    ).resolves.toBeUndefined();
  });

  it('findAll filters, hides the before/after data and paginates', async () => {
    const { model, service } = setup();
    const q = chain([{ _id: 'a' }]);
    model.find.mockReturnValueOnce(q);

    const res = await service.findAll({
      page: 2,
      limit: 20,
      module: 'USERS',
      userEmail: 'a.b+',
      from: '2026-01-01',
    });

    const filter = (model.find.mock.calls[0] as unknown[])[0];
    expect(filter).toEqual({
      module: 'users',
      userEmail: { $regex: '^a\\.b\\+', $options: 'i' },
      createdAt: { $gte: new Date('2026-01-01') },
    });
    expect(q.select).toHaveBeenCalledWith('-previousData -newData');
    expect(q.skip).toHaveBeenCalledWith(20);
    expect(res.pagination).toEqual({
      currentPage: 2,
      limit: 20,
      numberOfPages: 3,
      totalResults: 45,
      nextPage: 3,
      prevPage: 1,
    });
  });

  it('findOne 404s on unknown or malformed ids', async () => {
    const { service } = setup();
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.findOne(new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne redacts entries written before redaction existed', async () => {
    const { model, service } = setup();
    model.findById.mockReturnValueOnce(
      chain({ _id: 'x', newData: { token: 't', ok: 1 } }),
    );
    const entry = await service.findOne(new Types.ObjectId().toString());
    expect(entry.newData).toEqual({ token: REDACTED, ok: 1 });
  });

  it('getFilterOptions returns sorted distinct values', async () => {
    const { service } = setup();
    await expect(service.getFilterOptions()).resolves.toEqual({
      modules: ['order', 'users'],
      actions: ['UPDATE'],
    });
  });
});
