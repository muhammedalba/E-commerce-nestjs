import {
  findSecretLikePaths,
  maskSecretConfig,
  mergeSecretConfig,
} from './secret-config.util';

describe('maskSecretConfig', () => {
  it('masks every string, keeping the last 4 characters of long values', () => {
    expect(
      maskSecretConfig({
        MOYASAR_SECRET_KEY: 'sk_live_abcdefgh1234',
        SHORT: 'abc',
        EMPTY: '',
        nested: { token: 'tok_0123456789' },
        retries: 3,
      }),
    ).toEqual({
      MOYASAR_SECRET_KEY: '••••••••1234',
      SHORT: '••••••••',
      EMPTY: '',
      nested: { token: '••••••••6789' },
      retries: 3,
    });
  });
});

describe('mergeSecretConfig', () => {
  const existing = {
    MOYASAR_SECRET_KEY: 'sk_live_old',
    MOYASAR_WEBHOOK_SECRET: 'whsec_old',
  };

  it('keeps keys that were not sent (a partial update wipes nothing)', () => {
    expect(
      mergeSecretConfig(existing, { MOYASAR_SECRET_KEY: 'sk_live_new' }),
    ).toEqual({
      MOYASAR_SECRET_KEY: 'sk_live_new',
      MOYASAR_WEBHOOK_SECRET: 'whsec_old',
    });
  });

  it('treats masked values sent back by the admin form as unchanged', () => {
    expect(
      mergeSecretConfig(existing, {
        MOYASAR_SECRET_KEY: '••••••••_old',
        MOYASAR_WEBHOOK_SECRET: 'whsec_new',
      }),
    ).toEqual({
      MOYASAR_SECRET_KEY: 'sk_live_old',
      MOYASAR_WEBHOOK_SECRET: 'whsec_new',
    });
  });

  it('removes a key set to null', () => {
    expect(
      mergeSecretConfig(existing, { MOYASAR_WEBHOOK_SECRET: null }),
    ).toEqual({ MOYASAR_SECRET_KEY: 'sk_live_old' });
  });

  it('never stores a mask for a key that did not exist', () => {
    expect(mergeSecretConfig({}, { NEW_KEY: '••••••••' })).toEqual({});
  });

  it('merges nested objects the same way', () => {
    expect(
      mergeSecretConfig(
        { nested: { a: 'keep', b: 'old' } },
        { nested: { b: 'new', a: '••••••••' } },
      ),
    ).toEqual({ nested: { a: 'keep', b: 'new' } });
  });
});

describe('findSecretLikePaths', () => {
  it('flags secret-looking key names and sk_ values, however nested', () => {
    expect(
      findSecretLikePaths({
        publishableKey: 'pk_live_abc',
        MOYASAR_SECRET_KEY: 'x',
        nested: { apiKey: 'sk_live_123', privateToken: 'y' },
        list: ['sk_test_9'],
      }),
    ).toEqual([
      'MOYASAR_SECRET_KEY',
      'nested.apiKey',
      'nested.privateToken',
      'list[0]',
    ]);
  });

  it('allows what the storefront uses (publishable keys, bank details)', () => {
    expect(
      findSecretLikePaths({
        publishableKey: 'pk_test_abc',
        iban: 'SA0380000000608010167519',
        bankName: 'Al Rajhi',
      }),
    ).toEqual([]);
  });
});
