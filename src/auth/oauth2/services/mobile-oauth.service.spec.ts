import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, generateKeyPairSync } from 'crypto';
import { MobileOAuthService } from './mobile-oauth.service';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { AppleService } from './apple.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

// The real services pull in the ESM-only `uuid` package; only their
// issueTokens is used here, and it is stubbed below.
jest.mock('./google.service', () => ({ GoogleService: class {} }));
jest.mock('./facebook.service', () => ({ FacebookService: class {} }));
jest.mock('./apple.service', () => ({ AppleService: class {} }));

// A stand-in for Apple's signing key: tokens are really signed and verified.
const appleKeyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const appleJwks = {
  keys: [
    { ...appleKeyPair.publicKey.export({ format: 'jwk' }), kid: 'apple-kid' },
  ],
};
const signer = new JwtService({});

function appleToken(
  claims: Record<string, unknown>,
  options: { kid?: string; audience?: string; issuer?: string } = {},
) {
  return signer.signAsync(
    { sub: 'apple-sub-1', ...claims },
    {
      privateKey: appleKeyPair.privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      }) as string,
      algorithm: 'RS256',
      keyid: options.kid ?? 'apple-kid',
      audience: options.audience ?? 'shop.skygalaxy.app',
      issuer: options.issuer ?? 'https://appleid.apple.com',
      expiresIn: '5m',
    },
  );
}

const rawNonce = 'a-random-nonce-of-32-characters!';
const hashedNonce = createHash('sha256').update(rawNonce).digest('hex');

const tokens = { access_token: 'acc', refresh_Token: 'ref' };

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

describe('MobileOAuthService', () => {
  let service: MobileOAuthService;
  let googleService: { issueTokens: jest.Mock };
  let facebookService: { issueTokens: jest.Mock };
  let appleService: { issueTokens: jest.Mock };
  let verifyIdToken: jest.Mock;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'web-client';
    process.env.GOOGLE_MOBILE_CLIENT_IDS = 'ios-client, android-client';
    process.env.FACEBOOK_CLIENT_ID = 'fb-app';
    process.env.FACEBOOK_CLIENT_SECRET = 'fb-secret';
    process.env.APPLE_BUNDLE_IDS = 'shop.skygalaxy.app';

    googleService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    facebookService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    appleService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    const i18n = { translate: (key: string) => key };
    service = new MobileOAuthService(
      googleService as unknown as GoogleService,
      facebookService as unknown as FacebookService,
      appleService as unknown as AppleService,
      // Configured like the app's JwtModule (ES256 by default), to prove the
      // Apple path overrides it with RS256 and Apple's key.
      new JwtService({ verifyOptions: { algorithms: ['ES256'] } }),
      i18n as unknown as CustomI18nService,
    );
    verifyIdToken = jest.fn();
    (
      service as unknown as { googleClient: { verifyIdToken: jest.Mock } }
    ).googleClient = { verifyIdToken };
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  describe('googleLogin', () => {
    it('verifies against all configured client IDs and returns both tokens', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          email: 'a@b.com',
          email_verified: true,
          name: 'A',
          picture: 'p',
        }),
      });

      await expect(service.googleLogin('id-token')).resolves.toEqual({
        access_token: 'acc',
        refresh_token: 'ref',
      });
      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: 'id-token',
        audience: ['web-client', 'ios-client', 'android-client'],
      });
      expect(googleService.issueTokens).toHaveBeenCalledWith({
        email: 'a@b.com',
        name: 'A',
        picture: 'p',
      });
    });

    it('rejects a token that fails verification', async () => {
      verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));
      await expect(service.googleLogin('x')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(googleService.issueTokens).not.toHaveBeenCalled();
    });

    it('rejects an unverified email', async () => {
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({ email: 'a@b.com', email_verified: false }),
      });
      await expect(service.googleLogin('x')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(googleService.issueTokens).not.toHaveBeenCalled();
    });
  });

  describe('facebookLogin', () => {
    it('signs in when the token belongs to this app', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ data: { is_valid: true, app_id: 'fb-app' } }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: '1',
            name: 'F',
            email: 'f@b.com',
            picture: { data: { url: 'u' } },
          }),
        );

      await expect(service.facebookLogin('fb-token')).resolves.toEqual({
        access_token: 'acc',
        refresh_token: 'ref',
      });
      expect(facebookService.issueTokens).toHaveBeenCalledWith({
        email: 'f@b.com',
        name: 'F',
        picture: 'u',
      });
      const meUrl = String((fetchMock.mock.calls as unknown[][])[1][0]);
      expect(meUrl).toContain('appsecret_proof=');
    });

    it('rejects a token issued for another app', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { is_valid: true, app_id: 'other-app' } }),
      );
      await expect(service.facebookLogin('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(facebookService.issueTokens).not.toHaveBeenCalled();
    });

    it('rejects a profile without email', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ data: { is_valid: true, app_id: 'fb-app' } }),
        )
        .mockResolvedValueOnce(jsonResponse({ id: '1', name: 'F' }));
      await expect(service.facebookLogin('t')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('maps a Graph 4xx to an invalid token', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}, 400));
      await expect(service.facebookLogin('t')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('appleLogin', () => {
    it('verifies a genuine token and passes the identity on', async () => {
      fetchMock.mockResolvedValue(jsonResponse(appleJwks));
      const token = await appleToken({
        nonce: hashedNonce,
        email: 'A@B.com',
        email_verified: 'true',
      });

      await expect(
        service.appleLogin(token, rawNonce, 'Ahmed Ali'),
      ).resolves.toEqual({ access_token: 'acc', refresh_token: 'ref' });
      expect(appleService.issueTokens).toHaveBeenCalledWith({
        appleId: 'apple-sub-1',
        email: 'a@b.com',
        emailVerified: true,
        name: 'Ahmed Ali',
      });
    });

    it('caches Apple keys between sign-ins', async () => {
      fetchMock.mockResolvedValue(jsonResponse(appleJwks));
      const token = await appleToken({ nonce: hashedNonce });
      await service.appleLogin(token, rawNonce);
      await service.appleLogin(token, rawNonce);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects a token issued for another app', async () => {
      fetchMock.mockResolvedValue(jsonResponse(appleJwks));
      const token = await appleToken(
        { nonce: hashedNonce },
        { audience: 'com.other.app' },
      );
      await expect(service.appleLogin(token, rawNonce)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(appleService.issueTokens).not.toHaveBeenCalled();
    });

    it('rejects a token not issued by Apple', async () => {
      fetchMock.mockResolvedValue(jsonResponse(appleJwks));
      const token = await appleToken(
        { nonce: hashedNonce },
        { issuer: 'https://evil.example' },
      );
      await expect(service.appleLogin(token, rawNonce)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a token signed with an unknown key', async () => {
      fetchMock.mockResolvedValue(jsonResponse(appleJwks));
      const token = await appleToken(
        { nonce: hashedNonce },
        { kid: 'unknown-kid' },
      );
      await expect(service.appleLogin(token, rawNonce)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a replayed token (nonce does not match)', async () => {
      fetchMock.mockResolvedValue(jsonResponse(appleJwks));
      const token = await appleToken({ nonce: hashedNonce });
      // An attacker holding the token only knows the hashed nonce
      await expect(
        service.appleLogin(token, hashedNonce),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(appleService.issueTokens).not.toHaveBeenCalled();
    });

    it('answers 503 when Apple keys cannot be fetched', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      const token = await appleToken({ nonce: hashedNonce });
      await expect(service.appleLogin(token, rawNonce)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('is disabled when APPLE_BUNDLE_IDS is not set', async () => {
      delete process.env.APPLE_BUNDLE_IDS;
      const token = await appleToken({ nonce: hashedNonce });
      await expect(service.appleLogin(token, rawNonce)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
