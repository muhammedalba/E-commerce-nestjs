import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { generateKeyPairSync } from 'crypto';
import { resetInternalKey } from 'src/shared/utils/internal-key.util';
import { resetAppCheckKeys } from './app-check.verifier';
import { ClientAccessGuard } from './client-access.guard';

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
const INTERNAL_KEY = 'k'.repeat(40);

function appCheckToken(key = firebaseKeyPair) {
  return signer.signAsync(
    { sub: '1:123456789:android:abc' },
    {
      privateKey: key.privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      }),
      algorithm: 'RS256',
      keyid: 'fb-kid',
      audience: [`projects/${PROJECT}`],
      issuer: `https://firebaseappcheck.googleapis.com/${PROJECT}`,
      expiresIn: '5m',
    },
  );
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

function contextFor(headers: Record<string, string> = {}) {
  const req = { headers, method: 'GET', url: '/api/v1/products', ip: '1.2.3.4' };
  return {
    getType: () => 'http',
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function guardFor(exempt = false) {
  const reflector = { getAllAndOverride: () => exempt } as unknown as Reflector;
  return new ClientAccessGuard(reflector);
}

describe('ClientAccessGuard', () => {
  const env = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.CLIENT_ACCESS_MODE = 'enforce';
    process.env.NODE_ENV = 'production';
    process.env.INTERNAL_API_KEY = INTERNAL_KEY;
    process.env.FIREBASE_PROJECT_NUMBER = PROJECT;
    process.env.CLIENT_URL = 'https://site.com';
    delete process.env.FIREBASE_APP_IDS;
    resetInternalKey();
    resetAppCheckKeys();
    fetchMock = jest.fn().mockResolvedValue(jsonResponse(jwks));
    global.fetch = fetchMock;
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => {
    process.env = env;
  });

  it('accepts the website server (valid x-internal-key)', async () => {
    const context = contextFor({ 'x-internal-key': INTERNAL_KEY });
    await expect(guardFor().canActivate(context)).resolves.toBe(true);
  });

  it('rejects a wrong x-internal-key', async () => {
    const context = contextFor({ 'x-internal-key': 'x'.repeat(40) });
    await expect(guardFor().canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects any key when INTERNAL_API_KEY is not set', async () => {
    delete process.env.INTERNAL_API_KEY;
    resetInternalKey();
    const context = contextFor({ 'x-internal-key': '' });
    await expect(guardFor().canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('accepts the mobile app (valid App Check token)', async () => {
    const context = contextFor({ 'x-firebase-appcheck': await appCheckToken() });
    await expect(guardFor().canActivate(context)).resolves.toBe(true);
  });

  it('rejects an App Check token signed by another key', async () => {
    const context = contextFor({
      'x-firebase-appcheck': await appCheckToken(otherKeyPair),
    });
    await expect(guardFor().canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('accepts an App Check token when Firebase is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const context = contextFor({ 'x-firebase-appcheck': await appCheckToken() });
    await expect(guardFor().canActivate(context)).resolves.toBe(true);
  });

  it('rejects an unknown client (no key, no App Check)', async () => {
    await expect(guardFor().canActivate(contextFor())).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('ignores an allowed Origin in production (it can be spoofed)', async () => {
    const context = contextFor({ origin: 'https://site.com' });
    await expect(guardFor().canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  describe('development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('accepts a browser from an allowed origin', async () => {
      const context = contextFor({ origin: 'http://localhost:3000' });
      await expect(guardFor().canActivate(context)).resolves.toBe(true);
    });

    it('rejects an origin that only starts with an allowed one', async () => {
      const context = contextFor({ origin: 'https://site.com.evil.com' });
      await expect(guardFor().canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  it('skips routes marked @AllowAnyClient()', async () => {
    await expect(guardFor(true).canActivate(contextFor())).resolves.toBe(true);
  });

  it('report mode logs an unknown client but lets it through', async () => {
    process.env.CLIENT_ACCESS_MODE = 'report';
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    await expect(guardFor().canActivate(contextFor())).resolves.toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Would block'));
  });

  it('defaults to report mode when CLIENT_ACCESS_MODE is unset', async () => {
    delete process.env.CLIENT_ACCESS_MODE;
    await expect(guardFor().canActivate(contextFor())).resolves.toBe(true);
  });

  it('off mode checks nothing', async () => {
    process.env.CLIENT_ACCESS_MODE = 'off';
    await expect(guardFor().canActivate(contextFor())).resolves.toBe(true);
  });
});
