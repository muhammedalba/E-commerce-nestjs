/**
 * One-time Google OAuth consent to obtain GDRIVE_REFRESH_TOKEN for backups.
 * Run it on your own computer (it opens a local callback on 127.0.0.1):
 *
 *   npm run backup:auth
 *
 * Needs GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET (env or server/.env) from an
 * OAuth client of type "Desktop app". Requests only the `drive.file` scope:
 * the app can see and manage only the files it creates.
 *
 * The refresh token is printed once and never written to disk. If the OAuth
 * consent screen is in "Testing" status, Google expires the token after 7
 * days — publish the app ("In production") first. See docs/BACKUP.md.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const clientId = process.env.GDRIVE_CLIENT_ID;
const clientSecret = process.env.GDRIVE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    'Set GDRIVE_CLIENT_ID and GDRIVE_CLIENT_SECRET (in server/.env or the environment) first.',
  );
  process.exit(1);
}

const state = randomBytes(16).toString('hex');

const server = createServer();
server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const client = new OAuth2Client({ clientId, clientSecret, redirectUri });
  const { codeVerifier, codeChallenge } =
    await client.generateCodeVerifierAsync();

  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always return a refresh token
    scope: [SCOPE],
    state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: codeChallenge,
  });

  console.log('\nOpen this URL in a browser and approve access:\n');
  console.log(url);
  console.log('\nWaiting for Google to redirect back…');

  const timeout = setTimeout(() => {
    console.error('Timed out after 5 minutes.');
    server.close();
    process.exit(1);
  }, 5 * 60_000);

  server.on('request', async (req, res) => {
    const reqUrl = new URL(req.url ?? '/', redirectUri);
    if (reqUrl.pathname !== '/oauth2callback') {
      res.writeHead(404).end();
      return;
    }
    const finish = (status, message) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
      clearTimeout(timeout);
      server.close();
    };
    if (reqUrl.searchParams.get('state') !== state) {
      finish(400, 'State mismatch — start again.');
      console.error('State mismatch; aborting.');
      process.exitCode = 1;
      return;
    }
    const error = reqUrl.searchParams.get('error');
    const code = reqUrl.searchParams.get('code');
    if (error || !code) {
      finish(400, `Authorization failed: ${error ?? 'no code'}`);
      console.error(`Authorization failed: ${error ?? 'no code'}`);
      process.exitCode = 1;
      return;
    }
    try {
      const { tokens } = await client.getToken({ code, codeVerifier });
      if (!tokens.refresh_token) {
        throw new Error(
          'Google returned no refresh token. Remove the app at https://myaccount.google.com/permissions and run again.',
        );
      }
      finish(200, 'Done. You can close this tab and return to the terminal.');
      console.log(`
# ── server/.env (API) ─────────────────────────────────────────
GDRIVE_REFRESH_TOKEN=${tokens.refresh_token}

# Granted scope: ${tokens.scope ?? SCOPE}
# Treat this like a password. Restart the API after updating.
`);
    } catch (err) {
      finish(500, 'Token exchange failed — see the terminal.');
      console.error(`Token exchange failed: ${err.message}`);
      process.exitCode = 1;
    }
  });
});
