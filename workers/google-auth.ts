/**
 * google-auth.ts
 * Zero-dependency Google Service Account auth for Cloudflare Workers.
 */

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

const _cache = new Map<string, CachedToken>();

export async function getGoogleToken(
  serviceAccountJSON: string,
  scopes: string[],
): Promise<string> {
  const cacheKey = scopes.join(' ');
  const cached = _cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  const sa = JSON.parse(serviceAccountJSON) as ServiceAccount;
  const token = await _fetchAccessToken(sa, scopes);

  _cache.set(cacheKey, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
  return token;
}

async function _fetchAccessToken(sa: ServiceAccount, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = _b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = _b64url(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    scope: scopes.join(' '),
    iat: now,
    exp: now + 3600,
  }));

  const unsignedJwt = `${header}.${payload}`;

  const cryptoKey = await _importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    cryptoKey,
    new TextEncoder().encode(unsignedJwt),
  );
  const signedJwt = `${unsignedJwt}.${_b64urlFromBuffer(signature)}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google token exchange failed (${resp.status}): ${err}`);
  }

  const { access_token, error, error_description } = await resp.json() as TokenResponse;
  if (error) throw new Error(`Google OAuth error: ${error} — ${error_description}`);
  if (!access_token) throw new Error('No access_token in Google response');
  return access_token;
}

async function _importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const derBuffer = _base64ToBuffer(pemBody);

  return crypto.subtle.importKey(
    'pkcs8',
    derBuffer as unknown as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function _b64url(str: string): string {
  return _b64urlFromBuffer(new TextEncoder().encode(str));
}

function _b64urlFromBuffer(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function _base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new DataView(buffer);
  for (let i = 0; i < binary.length; i++) view.setUint8(i, binary.charCodeAt(i));
  return buffer;
}