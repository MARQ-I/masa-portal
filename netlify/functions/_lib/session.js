import crypto from 'node:crypto';

const COOKIE_NAME = 'mp_session';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sign(secret, expiresAt) {
  return crypto.createHmac('sha256', secret).update(String(expiresAt)).digest('hex');
}

export function buildSessionCookie(secret) {
  const expiresAt = Date.now() + TTL_MS;
  const value = `${expiresAt}.${sign(secret, expiresAt)}`;
  return [
    `${COOKIE_NAME}=${value}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(TTL_MS / 1000)}`,
  ].join('; ');
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function verifyRequest(req, secret) {
  if (!secret) return false;
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)mp_session=([^;]+)/);
  if (!m) return false;
  const [expStr, hmac] = m[1].split('.');
  if (!expStr || !hmac) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = sign(secret, exp);
  try {
    const a = Buffer.from(hmac, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
