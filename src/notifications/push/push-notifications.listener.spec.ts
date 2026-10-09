import { Types } from 'mongoose';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';
import { DeviceTokensService } from './device-tokens.service';
import { FcmClient } from './fcm.client';
import { PushNotificationsListener } from './push-notifications.listener';
import { PushNotificationsService } from './push-notifications.service';

jest.mock('src/shared/utils/i18n/custom-i18n.service', () => ({
  CustomI18nService: class {},
}));

const titles: Record<string, { ar: string; en: string }> = {
  'notification.PUSH_TITLE_ORDER': { ar: 'تحديث الطلب', en: 'Order update' },
  'notification.PUSH_TITLE_REVIEW': { ar: 'تقييمك', en: 'Your review' },
  'notification.PUSH_TITLE_DEFAULT': { ar: 'سكاي جالاكسي', en: 'SkyGalaxy' },
};

describe('PushNotificationsListener', () => {
  let listener: PushNotificationsListener;
  let fcm: { isEnabled: jest.Mock; send: jest.Mock };
  let deviceTokens: {
    activeDevices: jest.Mock;
    remove: jest.Mock;
    removeAllForUser: jest.Mock;
  };

  beforeEach(() => {
    fcm = {
      isEnabled: jest.fn().mockReturnValue(true),
      send: jest.fn().mockResolvedValue('sent'),
    };
    deviceTokens = {
      activeDevices: jest.fn().mockResolvedValue([
        { token: 'ar-phone', lang: 'ar' },
        { token: 'en-phone', lang: 'en' },
      ]),
      remove: jest.fn().mockResolvedValue(undefined),
      removeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    const i18n = { translateAll: (key: string) => titles[key] };
    const push = new PushNotificationsService(
      fcm as unknown as FcmClient,
      deviceTokens as unknown as DeviceTokensService,
    );
    listener = new PushNotificationsListener(
      push,
      deviceTokens as unknown as DeviceTokensService,
      i18n as unknown as CustomI18nService,
    );
  });

  const orderEvent = {
    userId: 'u1',
    action: 'ORDER_SHIPPED',
    message: { ar: 'تم شحن طلبك رقم #1001', en: 'Your order #1001 shipped' },
    payload: { orderId: new Types.ObjectId('64b000000000000000000001') },
  };

  it('pushes to every live device in its own language', async () => {
    await listener.handleUserNotification(orderEvent);

    expect(deviceTokens.activeDevices).toHaveBeenCalledWith('u1');
    expect(fcm.send).toHaveBeenCalledWith({
      token: 'ar-phone',
      title: 'تحديث الطلب',
      body: 'تم شحن طلبك رقم #1001',
      data: { orderId: '64b000000000000000000001', action: 'ORDER_SHIPPED' },
      collapseKey: 'order-64b000000000000000000001',
    });
    expect(fcm.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'en-phone',
        title: 'Order update',
        body: 'Your order #1001 shipped',
      }),
    );
  });

  it('titles review notifications and leaves them uncollapsed', async () => {
    await listener.handleUserNotification({
      userId: 'u1',
      action: 'REVIEW_APPROVED',
      message: { ar: 'تمت الموافقة', en: 'Approved' },
      payload: { reviewId: 'r1', productId: 'p1' },
    });

    expect(fcm.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'en-phone',
        title: 'Your review',
        data: { reviewId: 'r1', productId: 'p1', action: 'REVIEW_APPROVED' },
        collapseKey: undefined,
      }),
    );
  });

  it('accepts a plain-string message from an admin', async () => {
    await listener.handleUserNotification({
      userId: 'u1',
      action: 'ADMIN_ALERT',
      message: 'Hello',
    });

    expect(fcm.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'ar-phone',
        title: 'سكاي جالاكسي',
        body: 'Hello',
        data: { action: 'ADMIN_ALERT' },
      }),
    );
  });

  it.each(['FORCE_LOGOUT', 'REFRESH_PERMISSIONS'])(
    'never pushes the silent %s action',
    async (action) => {
      await listener.handleUserNotification({ ...orderEvent, action });
      expect(deviceTokens.activeDevices).not.toHaveBeenCalled();
    },
  );

  it('does nothing while FCM is not configured', async () => {
    fcm.isEnabled.mockReturnValue(false);
    await listener.handleUserNotification(orderEvent);

    expect(deviceTokens.activeDevices).not.toHaveBeenCalled();
    expect(fcm.send).not.toHaveBeenCalled();
  });

  it('drops the tokens FCM reports as dead, keeping the others', async () => {
    fcm.send.mockImplementation(({ token }: { token: string }) =>
      Promise.resolve(token === 'ar-phone' ? 'invalid-token' : 'failed'),
    );
    await listener.handleUserNotification(orderEvent);

    expect(deviceTokens.remove).toHaveBeenCalledWith(['ar-phone']);
  });

  it('swallows errors so other listeners are unaffected', async () => {
    deviceTokens.activeDevices.mockRejectedValue(new Error('db down'));
    await expect(
      listener.handleUserNotification(orderEvent),
    ).resolves.toBeUndefined();
  });

  it('forgets every device of a deleted account', async () => {
    await listener.handleUserDeleted({ userId: 'u1' });
    expect(deviceTokens.removeAllForUser).toHaveBeenCalledWith('u1');
  });
});
