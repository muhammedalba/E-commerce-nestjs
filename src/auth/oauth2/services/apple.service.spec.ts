import { BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import { AppleService } from './apple.service';
import { TokenService } from 'src/auth/shared/services/token.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { User } from 'src/auth/shared/schema/user.schema';
import { Role } from 'src/roles/shared/schemas/role.schema';

// TokenService pulls in the ESM-only `uuid` package; it is stubbed below.
jest.mock('src/auth/shared/services/token.service', () => ({
  TokenService: class {},
}));

const tokens = { access_token: 'acc', refresh_Token: 'ref' };
const customerRole = {
  _id: 'role-user',
  name: 'User',
  level: 1,
  permissions: [],
};

/** Mimics `.select().populate().lean()` resolving to `result`. */
const query = (result: unknown) => ({
  select: () => ({ populate: () => ({ lean: () => Promise.resolve(result) }) }),
});

describe('AppleService', () => {
  let service: AppleService;
  let userModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    create: jest.Mock;
    findByIdAndUpdate: jest.Mock;
  };
  let generateTokens: jest.Mock;

  beforeEach(() => {
    userModel = {
      findOne: jest.fn().mockReturnValue(query(null)),
      findOneAndUpdate: jest.fn().mockReturnValue(query(null)),
      create: jest.fn((doc: { email: string }) =>
        Promise.resolve({ _id: 'new-user', email: doc.email }),
      ),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    };
    const roleModel = { findOne: jest.fn().mockResolvedValue(customerRole) };
    generateTokens = jest.fn().mockResolvedValue(tokens);
    service = new AppleService(
      userModel as unknown as Model<User>,
      roleModel as unknown as Model<Role>,
      { translate: (key: string) => key } as unknown as CustomI18nService,
      { generate_Tokens: generateTokens } as unknown as TokenService,
    );
  });

  it('signs a returning Apple user in by appleId', async () => {
    userModel.findOne.mockReturnValue(
      query({
        _id: 'u1',
        email: 'a@b.com',
        isActive: true,
        role: customerRole,
      }),
    );

    await expect(
      service.issueTokens({ appleId: 'sub-1', emailVerified: true }),
    ).resolves.toBe(tokens);
    expect(userModel.findOne).toHaveBeenCalledWith({ appleId: 'sub-1' });
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(userModel.create).not.toHaveBeenCalled();
    expect(generateTokens).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', role: 'User' }),
    );
  });

  it('links an existing account with the same verified email', async () => {
    userModel.findOneAndUpdate.mockReturnValue(
      query({
        _id: 'u2',
        email: 'a@b.com',
        isActive: true,
        role: customerRole,
      }),
    );

    await service.issueTokens({
      appleId: 'sub-2',
      email: 'a@b.com',
      emailVerified: true,
    });
    expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
      { email: 'a@b.com' },
      { $set: { appleId: 'sub-2' } },
      { new: true },
    );
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('never links by an unverified email', async () => {
    await service.issueTokens({
      appleId: 'sub-3',
      email: 'a@b.com',
      emailVerified: false,
    });
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(userModel.create).toHaveBeenCalled();
  });

  it('creates an Apple account with the name from the app', async () => {
    await service.issueTokens({
      appleId: 'sub-4',
      email: 'new@b.com',
      emailVerified: true,
      name: '  Ahmed Ali  ',
    });
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@b.com',
        name: 'Ahmed Ali',
        provider: 'apple',
        appleId: 'sub-4',
        role: 'role-user',
      }),
    );
  });

  it('uses a placeholder name for a short name and a private relay email', async () => {
    await service.issueTokens({
      appleId: 'sub-5',
      email: 'x7k2abcd@privaterelay.appleid.com',
      emailVerified: true,
      name: 'Al',
    });
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Apple User' }),
    );
  });

  it('falls back to the real email local part when no name was sent', async () => {
    await service.issueTokens({
      appleId: 'sub-6',
      email: 'ahmed.ali@b.com',
      emailVerified: true,
    });
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ahmed.ali' }),
    );
  });

  it('refuses a new account without an email', async () => {
    await expect(
      service.issueTokens({ appleId: 'sub-7', emailVerified: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('refuses a blocked account', async () => {
    userModel.findOne.mockReturnValue(
      query({
        _id: 'u8',
        email: 'a@b.com',
        isActive: false,
        role: customerRole,
      }),
    );
    await expect(
      service.issueTokens({ appleId: 'sub-8', emailVerified: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(generateTokens).not.toHaveBeenCalled();
  });
});
