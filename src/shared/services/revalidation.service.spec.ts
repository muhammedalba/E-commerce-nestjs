import { ConfigService } from '@nestjs/config';
import { RevalidationService } from './revalidation.service';

describe('RevalidationService', () => {
  const config = (values: Record<string, string | undefined>) =>
    ({ get: (key: string) => values[key] }) as unknown as ConfigService;

  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
  });

  afterEach(() => jest.restoreAllMocks());

  const service = () =>
    new RevalidationService(
      config({
        FRONTEND_ORIGIN: 'http://front',
        REVALIDATE_SECRET: 's3cret',
      }),
    );

  it('posts deduplicated, URL-encoded tags with the bearer secret', async () => {
    await service().revalidate(['products', 'product-هاتف', 'products']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe(
      `http://front/api/revalidate?tag=${encodeURIComponent('products,product-هاتف')}`,
    );
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer s3cret');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('skips the request when there are no tags', async () => {
    await service().revalidate([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('skips the request when config is missing', async () => {
    await new RevalidationService(config({})).revalidate(['products']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws on network errors or non-2xx responses', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(service().revalidate(['products'])).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });
    await expect(service().revalidate(['products'])).resolves.toBeUndefined();
  });
});
