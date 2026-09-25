import { BlockList, isIP } from 'net';

/**
 * Trusted reverse proxies / CDNs, configured with TRUSTED_PROXIES
 * (comma-separated presets, IPs and CIDR ranges). Loopback is always trusted:
 * the reverse proxy in front of this app runs on the same host.
 *
 *   TRUSTED_PROXIES=cloudflare                    # behind Cloudflare
 *   TRUSTED_PROXIES=151.101.0.0/16,2a04:4e40::/32 # any other CDN's published ranges
 *
 * Keep in sync with cleint/lib/trusted-proxies.ts (same logic on the Next side).
 */

// Published at https://www.cloudflare.com/ips/ (fetched 2026-09-25).
// These change rarely; update this list if Cloudflare announces new ranges.
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const PRESETS: Record<string, string[]> = {
  loopback: ['127.0.0.0/8', '::1/128'],
  private: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', 'fc00::/7'],
  cloudflare: CLOUDFLARE_RANGES,
};

/** Strips brackets and unwraps IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4). */
export function normalizeIp(value: string): string {
  const ip = value.trim().replace(/^\[|\]$/g, '');
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

export interface TrustedProxies {
  isTrusted(ip: string): boolean;
}

export function createTrustedProxies(
  spec: string | undefined,
  onInvalid: (entry: string) => void,
): TrustedProxies {
  const list = new BlockList();

  const add = (entry: string) => {
    const [address, prefix] = entry.split('/');
    const type = isIP(address);
    if (!type) return onInvalid(entry);
    const family = type === 4 ? 'ipv4' : 'ipv6';
    if (prefix === undefined) return list.addAddress(address, family);

    const bits = Number(prefix);
    if (!Number.isInteger(bits) || bits < 0 || bits > (type === 4 ? 32 : 128)) {
      return onInvalid(entry);
    }
    list.addSubnet(address, bits, family);
  };

  const entries = ['loopback', ...(spec ?? '').split(',')]
    .map((e) => e.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const preset = PRESETS[entry.toLowerCase()];
    if (preset) preset.forEach(add);
    else add(entry);
  }

  return {
    isTrusted(ip: string) {
      const address = normalizeIp(ip);
      const type = isIP(address);
      return !!type && list.check(address, type === 4 ? 'ipv4' : 'ipv6');
    },
  };
}

let instance: TrustedProxies | null = null;

/** App-wide instance from TRUSTED_PROXIES; throws on invalid entries (fail fast at startup). */
export function getTrustedProxies(): TrustedProxies {
  instance ??= createTrustedProxies(process.env.TRUSTED_PROXIES, (entry) => {
    throw new Error(
      `Invalid TRUSTED_PROXIES entry "${entry}" — expected a preset (loopback, private, cloudflare), an IP, or a CIDR range`,
    );
  });
  return instance;
}
