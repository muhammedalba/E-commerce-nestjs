type EncryptionUtil = typeof import('./encryption.util');
type NestCommon = typeof import('@nestjs/common');

/** Collects Logger.error messages from every isolated module copy. */
const errorLog = jest.fn<void, [string]>();

/**
 * Loads a fresh copy of the module (its key is cached per module instance)
 * with the given env applied only while it runs. The isolated registry also
 * has its own @nestjs/common, so the Logger is silenced/spied there.
 */
const withEnv = <T>(
  env: Record<string, string | undefined>,
  run: (util: EncryptionUtil) => T,
): T => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env))
    if (v === undefined) delete process.env[k];
  try {
    let result!: T;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Logger } = require('@nestjs/common') as NestCommon;
      jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation((message: string) => errorLog(message));
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      result = run(require('./encryption.util') as EncryptionUtil);
    });
    return result;
  } finally {
    process.env = saved;
  }
};

describe('encryption.util', () => {
  afterEach(() => {
    errorLog.mockClear();
    jest.restoreAllMocks();
  });

  it('round-trips nested config values', () => {
    withEnv({ PAYMENT_CONFIG_SECRET: 'k1' }, (util) => {
      const config = { MOYASAR_SECRET_KEY: 'sk_test_1', nested: { a: 'b' } };
      const encrypted = util.encryptConfigValues(config) as typeof config;

      expect(encrypted.MOYASAR_SECRET_KEY).not.toBe('sk_test_1');
      expect(util.decryptConfigValues(encrypted)).toEqual(config);
    });
  });

  it('reads the secret on first use, not at import (.env is loaded after import)', () => {
    const encrypted = withEnv({ PAYMENT_CONFIG_SECRET: 'late' }, (util) =>
      util.encryptConfigValues({ v: 'x' }),
    );

    const decrypted = withEnv({ PAYMENT_CONFIG_SECRET: undefined }, (util) => {
      process.env.PAYMENT_CONFIG_SECRET = 'late'; // arrives after import
      return util.decryptConfigValues(encrypted);
    });

    expect(decrypted).toEqual({ v: 'x' });
  });

  it('refuses to run in production without the secret', () => {
    withEnv(
      { PAYMENT_CONFIG_SECRET: undefined, NODE_ENV: 'production' },
      (util) => {
        expect(() => util.encryptConfigValues({ v: 'x' })).toThrow(
          'PAYMENT_CONFIG_SECRET is required in production',
        );
      },
    );
  });

  it('logs (without the value) and returns the input when the key is wrong', () => {
    const encrypted = withEnv({ PAYMENT_CONFIG_SECRET: 'k1' }, (util) =>
      util.encryptConfigValues({ v: 'secret-value' }),
    ) as { v: string };

    withEnv({ PAYMENT_CONFIG_SECRET: 'k2' }, (util) => {
      expect(util.decryptConfigValues(encrypted)).toEqual(encrypted);
    });

    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(errorLog.mock.calls[0][0]).not.toContain('secret-value');
  });

  it('does not log for plaintext that merely contains colons', () => {
    withEnv({ PAYMENT_CONFIG_SECRET: 'k1' }, (util) => {
      const plain = { url: 'https://example.com', note: 'a:b:c' };
      expect(util.decryptConfigValues(plain)).toEqual(plain);
    });

    expect(errorLog).not.toHaveBeenCalled();
  });
});
