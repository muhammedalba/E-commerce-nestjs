import { Injectable, Logger } from '@nestjs/common';
import { JWT } from 'google-auth-library';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const SEND_TIMEOUT_MS = 10_000;
const MAX_RETRY_DELAY_MS = 10_000;

/** Who receives a push: one device, or every install subscribed to a topic. */
export type FcmTarget =
  { token: string; topic?: never } | { topic: string; token?: never };

/** One push to one device or topic. `data` values must be strings (FCM rule). */
export type FcmMessage = FcmTarget & {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Newer pushes with the same key replace older ones in the tray. */
  collapseKey?: string;
};

/**
 * - `sent`: FCM accepted it.
 * - `invalid-token`: the token is dead (app uninstalled, other project); drop it.
 * - `failed`: anything else (outage, quota, bad config); the token stays.
 */
export type FcmSendResult = 'sent' | 'invalid-token' | 'failed';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface FcmErrorBody {
  error?: {
    status?: string;
    message?: string;
    details?: { '@type'?: string; errorCode?: string }[];
  };
}

/**
 * Thin client for the FCM HTTP v1 API — the only class that talks to Google.
 *
 * Credentials come from FIREBASE_SERVICE_ACCOUNT: the service-account JSON
 * key (raw or base64). Unset = push disabled, and {@link send} is never
 * expected to be called (check {@link isEnabled}).
 */
@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);
  private readonly account = this.loadServiceAccount();
  // Caches the OAuth access token and renews it before it expires.
  private readonly auth = this.account
    ? new JWT({
        email: this.account.client_email,
        key: this.account.private_key,
        scopes: [FCM_SCOPE],
      })
    : null;

  isEnabled(): boolean {
    return !!this.auth;
  }

  /** Sends one push. Never throws: failures are reported as a result. */
  async send(message: FcmMessage): Promise<FcmSendResult> {
    if (!this.auth || !this.account) return 'failed';
    try {
      let res = await this.post(message);
      if (res.status === 429 || res.status >= 500) {
        // Transient: retry once, honouring Retry-After (capped).
        await sleep(retryDelay(res.headers.get('retry-after')));
        res = await this.post(message);
      }
      if (res.ok) return 'sent';
      return this.classifyError(res.status, await readJson(res));
    } catch (err) {
      this.logger.error(`FCM send failed: ${String(err)}`);
      return 'failed';
    }
  }

  private async post(message: FcmMessage): Promise<Response> {
    const { token } = await this.auth!.getAccessToken();
    return fetch(
      `https://fcm.googleapis.com/v1/projects/${this.account!.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: toFcmPayload(message) }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      },
    );
  }

  /** Maps an FCM error response; only token errors make the token droppable. */
  private classifyError(status: number, body: FcmErrorBody): FcmSendResult {
    const fcmCode = body.error?.details?.find((d) =>
      d['@type']?.endsWith('google.firebase.fcm.v1.FcmError'),
    )?.errorCode;
    const code = fcmCode ?? body.error?.status;
    const text = body.error?.message ?? '';

    if (
      code === 'UNREGISTERED' ||
      code === 'SENDER_ID_MISMATCH' ||
      // INVALID_ARGUMENT also covers a malformed message — only a bad token
      // may cost the device its registration.
      (code === 'INVALID_ARGUMENT' && /registration token/i.test(text))
    ) {
      return 'invalid-token';
    }
    this.logger.error(`FCM rejected a push: ${status} ${code} ${text}`);
    return 'failed';
  }

  private loadServiceAccount(): ServiceAccount | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
    if (!raw) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT is not set — push disabled');
      return null;
    }
    try {
      const json = raw.startsWith('{')
        ? raw
        : Buffer.from(raw, 'base64').toString('utf8');
      const account = JSON.parse(json) as Partial<ServiceAccount>;
      if (
        !account.project_id ||
        !account.client_email ||
        !account.private_key
      ) {
        throw new Error('missing project_id, client_email or private_key');
      }
      return account as ServiceAccount;
    } catch (err) {
      this.logger.error(
        `FIREBASE_SERVICE_ACCOUNT is invalid — push disabled: ${String(err)}`,
      );
      return null;
    }
  }
}

function toFcmPayload(message: FcmMessage) {
  const { token, topic, title, body, data, collapseKey } = message;
  return {
    ...(token ? { token } : { topic }),
    notification: { title, body },
    data: data ?? {},
    android: {
      priority: 'HIGH',
      notification: {
        sound: 'default',
        ...(collapseKey && { tag: collapseKey }),
      },
    },
    apns: {
      ...(collapseKey && { headers: { 'apns-collapse-id': collapseKey } }),
      payload: { aps: { sound: 'default' } },
    },
  };
}

function retryDelay(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, MAX_RETRY_DELAY_MS)
    : 1000;
}

async function readJson(res: Response): Promise<FcmErrorBody> {
  try {
    return (await res.json()) as FcmErrorBody;
  } catch {
    return {};
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
