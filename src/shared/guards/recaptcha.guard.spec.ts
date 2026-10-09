import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { generateKeyPairSync } from 'crypto';
import { resetAppCheckKeys } from './app-check.verifier';
import { RecaptchaGuard } from './recaptcha.guard';

// A stand-in for Firebase's signing key: tokens are really signed and verified.
const firebaseKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = {
  keys: [
    { ...firebaseKeyPair.publicKey.export({ format: 'jwk' }), kid: 'fb-kid' },
  ],
};
const signer = new JwtService({});
const PROJECT = '123456789';
const ANDROID_APP = '1:123456789:android:abc';

function appCheckToken(
  options: {
    project?: string;
    appId?: string;
    key?: typeof firebaseKeyPair;
  } = {},
) {
  const project = options.project ?? PROJECT;
  return signer.signAsync(
    { sub: options.appId ?? ANDROID_APP },
    {
      privateKey: (options.key ?? firebaseKeyPair).privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      }) as string,
      algorithm: 'RS256',
      keyid: 'fb-kid',
      audience: [`projects/${project}`, 'projects/skygalaxy'],
      issuer: `https://firebaseappcheck.googleapis.com/${project}`,
      expiresIn: '5m',
    },
  );
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function contextFor(headers: Record<string, string>) {
  const req: {
    headers: Record<string, string>;
    recaptchaUnverified?: boolean;
  } = { headers };
  const context = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { req, context };
}

describe('RecaptchaGuard', () => {
  const guard = new RecaptchaGuard('contact');
  const env = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.RECAPTCHA_SECRET_KEY = 'recaptcha-secret';
    process.env.FIREBASE_PROJECT_NUMBER = PROJECT;
    delete process.env.FIREBASE_APP_IDS;
    resetAppCheckKeys();
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(jwks));
    global.fetch = fetchMock;
  });

  afterAll(() => {
    process.env = env;
  });

  describe('mobile app (App Check)', () => {
    it('accepts a valid App Check token without a reCAPTCHA token', async () => {
      const { req, context } = contextFor({
        'x-firebase-appcheck': await appCheckToken(),
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(req.recaptchaUnverified).toBeUndefined();
      expect(String((fetchMock.mock.calls as unknown[][])[0][0])).toBe(
        'https://firebaseappcheck.googleapis.com/v1/jwks',
      );
    });

    it('caches the Firebase keys between requests', async () => {
      for (let i = 0; i < 2; i++) {
        const { context } = contextFor({
          'x-firebase-appcheck': await appCheckToken(),
        });
        await guard.canActivate(context);
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a token issued for another Firebase project', async () => {
      const { context } = contextFor({
        'x-firebase-appcheck': await appCheckToken({ project: '999' }),
      });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects a token not signed by Firebase', async () => {
      const { context } = contextFor({
        'x-firebase-appcheck': await appCheckToken({ key: otherKeyPair }),
      });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects garbage', async () => {
      const { context } = contextFor({ 'x-firebase-appcheck': 'not-a-jwt' });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects an app outside FIREBASE_APP_IDS', async () => {
      process.env.FIREBASE_APP_IDS = '1:123456789:ios:def';
      const { context } = contextFor({
        'x-firebase-appcheck': await appCheckToken(),
      });
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('accepts an app listed in FIREBASE_APP_IDS', async () => {
      process.env.FIREBASE_APP_IDS = `1:123456789:ios:def, ${ANDROID_APP}`;
      const { context } = contextFor({
        'x-firebase-appcheck': await appCheckToken(),
      });
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('accepts but flags the request when Firebase keys are unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      const { req, context } = contextFor({
        'x-firebase-appcheck': await appCheckToken(),
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(req.recaptchaUnverified).toBe(true);
    });

    it('falls back to reCAPTCHA when App Check is not configured', async () => {
      delete process.env.FIREBASE_PROJECT_NUMBER;
      const { context } = contextFor({
        'x-firebase-appcheck': await appCheckToken(),
      });

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('website (reCAPTCHA)', () => {
    it('still requires a reCAPTCHA token without an App Check header', async () => {
      const { context } = contextFor({});
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('accepts a reCAPTCHA token that Google approves', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ success: true, score: 0.9, action: 'contact' }),
      );
      const { context } = contextFor({ 'x-recaptcha-token': 'tok' });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(String((fetchMock.mock.calls as unknown[][])[0][0])).toContain(
        'recaptcha/api/siteverify',
      );
    });
  });
});
