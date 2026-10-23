import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import { Cache } from 'cache-manager';
import * as crypto from 'crypto';
import { PasswordResetService } from './password-reset.service';
import { TokenService } from './token.service';
import { User } from '../schema/user.schema';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

// Pulls in ESM-only / native dependencies; only a stub is used here.
jest.mock('./token.service', () => ({ TokenService: class {} }));

const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

describe('PasswordResetService (SEC-04: no user enumeration)', () => {
  let service: PasswordResetService;
  let userModel: { findOne: jest.Mock };
  let mailAdd: jest.Mock;

  /** The user `findOne(...).select().exec()` returns (forgotPassword). */
  const withUser = (user: unknown) =>
    userModel.findOne.mockReturnValue({
      select: () => ({ exec: () => Promise.resolve(user) }),
    });

  /** The user `findOne(...).select().populate().exec()` returns (resetPassword). */
  const withPopulatedUser = (user: unknown) =>
    userModel.findOne.mockReturnValue({
      select: () => ({
        populate: () => ({ exec: () => Promise.resolve(user) }),
      }),
    });

  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    email: 'known@example.com',
    name: 'Known',
    isActive: true,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    userModel = { findOne: jest.fn() };
    mailAdd = jest.fn().mockResolvedValue(undefined);
    const cache = new Map<string, unknown>();
    service = new PasswordResetService(
      userModel as unknown as Model<User>,
      { add: mailAdd } as unknown as Queue,
      {} as TokenService,
      {
        translate: (key: string) => key,
        getLang: () => 'en',
      } as unknown as CustomI18nService,
      {
        get: (key: string) => Promise.resolve(cache.get(key)),
        set: (key: string, value: unknown) => {
          cache.set(key, value);
          return Promise.resolve(value);
        },
        del: (key: string) => Promise.resolve(cache.delete(key)),
      } as unknown as Cache,
    );
  });

  describe('forgotPassword', () => {
    const dto = { email: 'someone@example.com' };
    const generic = { status: 'success', message: 'success.RESET_CODE_SENDED' };

    it('sends a code and returns the generic response for an active user', async () => {
      const user = makeUser();
      withUser(user);

      await expect(service.forgotPassword(dto)).resolves.toEqual(generic);
      expect(mailAdd).toHaveBeenCalledWith(
        'send-random-code',
        expect.objectContaining({ email: user.email }),
      );
    });

    it('returns the same response for an unknown email without sending', async () => {
      withUser(null);

      await expect(service.forgotPassword(dto)).resolves.toEqual(generic);
      expect(mailAdd).not.toHaveBeenCalled();
    });

    it('returns the same response for a blocked account without sending', async () => {
      const user = makeUser({ isActive: false });
      withUser(user);

      await expect(service.forgotPassword(dto)).resolves.toEqual(generic);
      expect(mailAdd).not.toHaveBeenCalled();
      expect(user.save).not.toHaveBeenCalled();
    });

    const expectCooldown = async (email: string) => {
      const error = await service
        .forgotPassword({ email })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'exception.TOO_MANY_Attempts',
      );
    };

    it('shows the cooldown on a second request for a registered email', async () => {
      withUser(makeUser());
      await service.forgotPassword(dto);
      mailAdd.mockClear();

      await expectCooldown(dto.email);
      expect(mailAdd).not.toHaveBeenCalled();
    });

    it('shows the same cooldown on a second request for an unknown email', async () => {
      withUser(null);
      await service.forgotPassword(dto);

      await expectCooldown(dto.email);
    });

    it('applies the cooldown regardless of email letter case', async () => {
      withUser(null);
      await service.forgotPassword({ email: 'Someone@Example.com' });

      await expectCooldown('someone@example.com');
    });

    it('does not share the cooldown between different emails', async () => {
      withUser(null);
      await service.forgotPassword(dto);

      await expect(
        service.forgotPassword({ email: 'other@example.com' }),
      ).resolves.toEqual(generic);
    });

    it('clears the cooldown when the email cannot be queued', async () => {
      withUser(makeUser());
      mailAdd.mockRejectedValueOnce(new Error('redis down'));
      await expect(service.forgotPassword(dto)).rejects.toBeInstanceOf(
        BadGatewayException,
      );

      await expect(service.forgotPassword(dto)).resolves.toEqual(generic);
    });
  });

  describe('resetPassword', () => {
    const dto = {
      email: 'someone@example.com',
      password: 'N3w-Passw0rd!',
      passwordResetCode: '123456',
    };

    const expectCodeIncorrect = async () => {
      const error = await service.resetPassword(dto).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).message).toBe(
        'exception.CODE_INCORRECT',
      );
    };

    it('rejects an unknown email with the generic code error', async () => {
      withPopulatedUser(null);
      await expectCodeIncorrect();
    });

    it('rejects an unverified reset with the same error', async () => {
      withPopulatedUser(
        makeUser({
          verificationCode: false,
          passwordResetCode: sha256('123456'),
          passwordResetExpires: Date.now() + 60_000,
        }),
      );
      await expectCodeIncorrect();
    });

    it('rejects an expired reset with the same error', async () => {
      withPopulatedUser(
        makeUser({
          verificationCode: true,
          passwordResetCode: sha256('123456'),
          passwordResetExpires: Date.now() - 1,
        }),
      );
      await expectCodeIncorrect();
    });

    it('rejects a wrong code with the same error', async () => {
      withPopulatedUser(
        makeUser({
          verificationCode: true,
          passwordResetCode: sha256('654321'),
          passwordResetExpires: Date.now() + 60_000,
        }),
      );
      await expectCodeIncorrect();
    });
  });
});
