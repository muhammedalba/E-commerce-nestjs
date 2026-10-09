import express, { Response } from 'express';
import request from 'supertest';
import { CookieService } from './cookie.service';

const tokens = { access_token: 'acc', refresh_Token: 'ref' };

/** A real Express app whose route hands out tokens like login does. */
function app() {
  const server = express();
  server.post('/login', (_req, res: Response) => {
    res.json(new CookieService().deliverTokens(res, tokens));
  });
  return server;
}

describe('CookieService.deliverTokens', () => {
  it('sets the auth cookies for browsers and keeps the refresh token out of the body', async () => {
    const res = await request(app()).post('/login');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^access_token=acc;/),
        expect.stringMatching(/^refresh_token=ref;/),
        expect.stringMatching(/^is_logged_in=true;/),
      ]),
    );
    expect(res.body).toEqual({});
  });

  it('returns the refresh token in the body for mobile clients, without cookies', async () => {
    const res = await request(app())
      .post('/login')
      .set('x-client-type', 'mobile');

    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual({ refresh_token: 'ref' });
  });
});
