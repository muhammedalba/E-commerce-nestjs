import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MobileOAuthService } from './mobile-oauth.service';
import { GoogleService } from './google.service';
import { FacebookService } from './facebook.service';
import { CustomI18nService } from 'src/shared/utils/i18n/custom-i18n.service';

// The real services pull in the ESM-only `uuid` package; only their
// issueTokens is used here, and it is stubbed below.
jest.mock('./google.service', () => ({ GoogleService: class {} }));
jest.mock('./facebook.service', () => ({ FacebookService: class {} }));

const tokens = { access_token: 'acc', refresh_Token: 'ref' };

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

describe('MobileOAuthService', () => {
  let service: MobileOAuthService;
  let googleService: { issueTokens: jest.Mock };
  let facebookService: { issueTokens: jest.Mock };
  let verifyIdToken: jest.Mock;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'web-client';
    process.env.GOOGLE_MOBILE_CLIENT_IDS = 'ios-client, android-client';
    process.env.FACEBOOK_CLIENT_ID = 'fb-app';
    process.env.FACEBOOK_CLIENT_SECRET = 'fb-secret';

    googleService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    facebookService = { issueTokens: jest.fn().mockResolvedValue(tokens) };
    const i18n = { translate: (key: string) => key };
    service = new MobileOAuthService(
      googleService as unknown as GoogleService,
      facebookService as unknown as FacebookService,
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
});
