import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Response } from 'express';
import { Model } from 'mongoose';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { UserProfileService } from './user-profile.service';
import { CookieService } from './cookie.service';
import { TokenService } from './token.service';
import { User } from '../schema/user.schema';
import { RefreshToken } from '../schema/refresh-token.schema';
import { FileUploadService } from 'src/file-upload/file-upload.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { USER_EVENTS } from 'src/users/shared/events/user.events';

// Both pull in ESM-only / native dependencies; only stubs are used here.
jest.mock('./token.service', () => ({ TokenService: class {} }));
jest.mock('src/file-upload/file-upload.service', () => ({
  FileUploadService: class {},
}));

const uploadedAvatar = {
  url: '/uploads/User/me.webp',
  publicId: 'me',
  provider: 'local',
};

describe('UserProfileService.deleteMe', () => {
  let service: UserProfileService;
  let userModel: { findById: jest.Mock; deleteOne: jest.Mock };
  let refreshTokenModel: { deleteMany: jest.Mock };
  let deleteFile: jest.Mock;
  let emit: jest.Mock;
  let clearCookies: jest.Mock;
  const res = {} as Response;

  /** The user `findById(...).select().populate().lean().exec()` returns. */
  const withUser = (user: unknown) =>
    userModel.findById.mockReturnValue({
      select: () => ({
        populate: () => ({
          lean: () => ({ exec: () => Promise.resolve(user) }),
        }),
      }),
    });

  beforeEach(() => {
    userModel = {
      findById: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    refreshTokenModel = { deleteMany: jest.fn().mockResolvedValue({}) };
    deleteFile = jest.fn().mockResolvedValue(undefined);
    emit = jest.fn();
    clearCookies = jest.fn();
    service = new UserProfileService(
      {} as Queue,
      userModel as unknown as Model<User>,
      refreshTokenModel as unknown as Model<RefreshToken>,
      { translate: (key: string) => key } as unknown as CustomI18nService,
      { deleteFile } as unknown as FileUploadService,
      { clearCookies } as unknown as CookieService,
      {} as TokenService,
      { emit } as unknown as EventEmitter2,
    );
  });

  const expectNothingDeleted = () => {
    expect(userModel.deleteOne).not.toHaveBeenCalled();
    expect(refreshTokenModel.deleteMany).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  };

  it('deletes an email/password account after the right password', async () => {
    withUser({
      _id: 'u1',
      provider: 'auth',
      password: await bcrypt.hash('secret123', 4),
      avatar: uploadedAvatar,
      role: { level: 1 },
    });

    await expect(service.deleteMe('u1', 'secret123', res)).resolves.toEqual({
      message: 'success.ACCOUNT_DELETED',
    });
    expect(userModel.deleteOne).toHaveBeenCalledWith({ _id: 'u1' });
    expect(refreshTokenModel.deleteMany).toHaveBeenCalledWith({ userId: 'u1' });
    expect(deleteFile).toHaveBeenCalledWith(uploadedAvatar);
    expect(emit).toHaveBeenCalledWith(USER_EVENTS.DELETED, { userId: 'u1' });
    expect(clearCookies).toHaveBeenCalledWith(res);
  });

  it('refuses a wrong password', async () => {
    withUser({
      _id: 'u1',
      provider: 'auth',
      password: await bcrypt.hash('secret123', 4),
      role: { level: 1 },
    });
    await expect(service.deleteMe('u1', 'wrong', res)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expectNothingDeleted();
  });

  it('requires the password for email/password accounts', async () => {
    withUser({ _id: 'u1', provider: 'auth', password: 'x', role: null });
    await expect(service.deleteMe('u1', undefined, res)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expectNothingDeleted();
  });

  it('deletes a social account without a password, keeping its avatar URL alone', async () => {
    withUser({
      _id: 'u2',
      provider: 'google',
      avatar: 'https://lh3.googleusercontent.com/a/photo',
      role: { level: 1 },
    });
    await service.deleteMe('u2', undefined, res);
    expect(userModel.deleteOne).toHaveBeenCalledWith({ _id: 'u2' });
    expect(deleteFile).not.toHaveBeenCalled();
  });

  it('refuses staff accounts', async () => {
    withUser({ _id: 'admin', provider: 'auth', role: { level: 50 } });
    await expect(
      service.deleteMe('admin', 'secret123', res),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expectNothingDeleted();
  });
});
