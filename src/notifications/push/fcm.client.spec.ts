import { FcmClient } from './fcm.client';

jest.mock('google-auth-library', () => ({
  JWT: jest.fn().mockImplementation(() => ({
    getAccessToken: jest.fn().mockResolvedValue({ token: 'oauth-token' }),
  })),
}));

const account = {
  project_id: 'skygalaxy-app',
  client_email: 'fcm@skygalaxy-app.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
};

function response(status: number, body: unknown = {}, headers = {}) {
  return {
    ok: status < 400,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
  };
}

function fcmError(status: number, code: string, message = '') {
  return response(status, {
    error: {
      status: code === 'UNREGISTERED' ? 'NOT_FOUND' : code,
      message,
      details: [
        {
          '@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError',
          errorCode: code,
        },
      ],
    },
  });
}

const message = { token: 'device-1', title: 'Order update', body: 'Shipped' };

describe('FcmClient', () => {
  const env = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(account);
    fetchMock = jest.fn().mockResolvedValue(response(200, { name: 'm/1' }));
    global.fetch = fetchMock;
  });

  afterAll(() => {
    process.env = env;
  });

  describe('configuration', () => {
    it('is disabled without FIREBASE_SERVICE_ACCOUNT', async () => {
      delete process.env.FIREBASE_SERVICE_ACCOUNT;
      const client = new FcmClient();

      expect(client.isEnabled()).toBe(false);
      await expect(client.send(message)).resolves.toBe('failed');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('is disabled when the key is not valid JSON', () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = '{not json';
      expect(new FcmClient().isEnabled()).toBe(false);
    });

    it('accepts the key as base64', () => {
      process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(
        JSON.stringify(account),
      ).toString('base64');
      expect(new FcmClient().isEnabled()).toBe(true);
    });
  });

  it('posts an HTTP v1 message to the project with the OAuth token', async () => {
    await expect(
      new FcmClient().send({
        ...message,
        data: { action: 'ORDER_SHIPPED', orderId: 'o1' },
        collapseKey: 'order-o1',
      }),
    ).resolves.toBe('sent');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://fcm.googleapis.com/v1/projects/skygalaxy-app/messages:send',
    );
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer oauth-token',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      message: {
        token: 'device-1',
        notification: { title: 'Order update', body: 'Shipped' },
        data: { action: 'ORDER_SHIPPED', orderId: 'o1' },
        android: {
          priority: 'HIGH',
          notification: { sound: 'default', tag: 'order-o1' },
        },
        apns: {
          headers: { 'apns-collapse-id': 'order-o1' },
          payload: { aps: { sound: 'default' } },
        },
      },
    });
  });

  it.each([
    ['UNREGISTERED', 404, ''],
    ['SENDER_ID_MISMATCH', 403, ''],
    [
      'INVALID_ARGUMENT',
      400,
      'The registration token is not a valid FCM registration token',
    ],
  ])('reports %s as an invalid token', async (code, status, text) => {
    fetchMock.mockResolvedValue(fcmError(status, code, text));
    await expect(new FcmClient().send(message)).resolves.toBe('invalid-token');
  });

  it('keeps the token when the message itself is malformed', async () => {
    fetchMock.mockResolvedValue(
      fcmError(400, 'INVALID_ARGUMENT', 'Invalid value at message.data'),
    );
    await expect(new FcmClient().send(message)).resolves.toBe('failed');
  });

  it('retries once after a transient error', async () => {
    fetchMock
      .mockResolvedValueOnce(response(503, {}, { 'retry-after': '0' }))
      .mockResolvedValueOnce(response(200));

    await expect(new FcmClient().send(message)).resolves.toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry fails too', async () => {
    fetchMock.mockResolvedValue(response(503));

    await expect(new FcmClient().send(message)).resolves.toBe('failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never throws on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(new FcmClient().send(message)).resolves.toBe('failed');
  });
});
