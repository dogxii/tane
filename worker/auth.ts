import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';
import {
  ApiError,
  type App,
  type Ctx,
  body,
  clientIp,
  hmac,
  notFound,
  now,
  rateLimit,
  safeEqual,
  sha256,
  text,
} from './util';

const COOKIE = 'tane_session';
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const sessionSecret = (c: Ctx) => sha256(`session:${c.env.ADMIN_PASSWORD}`);

async function signSession(c: Ctx, expires: number) {
  return `${expires}.${await hmac(await sessionSecret(c), String(expires))}`;
}

async function validSession(c: Ctx, value: string | undefined) {
  if (!value) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < now()) return false;
  return safeEqual(signature, await hmac(await sessionSecret(c), expires));
}

export const resolveActor: MiddlewareHandler<App> = async (c, next) => {
  c.set('actor', null);
  const header = c.req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const hash = await sha256(header.slice(7).trim());
    const token = await c.env.DB.prepare('SELECT id, name FROM tokens WHERE hash = ?')
      .bind(hash)
      .first<{ id: number; name: string }>();
    if (!token) throw new ApiError(401, 'invalid_token', 'Token 无效或已撤销');
    c.set('actor', { type: 'agent', name: token.name });
    // Agents make many calls in a row, and a timestamp a minute off is not worth a write each.
    const t = now();
    c.executionCtx.waitUntil(
      c.env.DB.prepare('UPDATE tokens SET last_used_at = ? WHERE id = ? AND (last_used_at IS NULL OR last_used_at < ?)')
        .bind(t, token.id, t - 60_000)
        .run(),
    );
  } else if (await validSession(c, getCookie(c, COOKIE))) {
    // Cookie sessions are the only ambient credential, so only they need an origin check.
    const origin = c.req.header('origin');
    if (origin && c.req.method !== 'GET' && new URL(origin).host !== new URL(c.req.url).host) {
      throw new ApiError(403, 'bad_origin', '跨站请求被拒绝');
    }
    c.set('actor', { type: 'owner', name: 'owner' });
  }
  await next();
};

export function requireActor(c: Ctx) {
  const actor = c.get('actor');
  if (!actor) throw new ApiError(401, 'unauthorized', '需要登录');
  return actor;
}

export function requireOwner(c: Ctx) {
  const actor = requireActor(c);
  if (actor.type !== 'owner') throw new ApiError(403, 'owner_only', '此操作只能在网页上由所有者完成');
  return actor;
}

export const auth = new Hono<App>();

auth.post('/login', async (c) => {
  if (!c.env.ADMIN_PASSWORD) throw new ApiError(500, 'not_configured', '服务端未设置 ADMIN_PASSWORD');
  const key = `login:${await sha256(clientIp(c))}`;
  if (!(await rateLimit(c, key, 8, 10 * 60 * 1000))) {
    throw new ApiError(429, 'rate_limited', '尝试次数过多，请 10 分钟后再试');
  }
  const { password } = await body(c);
  const [given, expected] = await Promise.all([
    sha256(String(password ?? '')),
    sha256(c.env.ADMIN_PASSWORD),
  ]);
  if (!safeEqual(given, expected)) throw new ApiError(401, 'wrong_password', '密码不正确');

  const expires = now() + SESSION_MS;
  setCookie(c, COOKIE, await signSession(c, expires), {
    httpOnly: true,
    sameSite: 'Lax',
    secure: new URL(c.req.url).protocol === 'https:',
    path: '/',
    expires: new Date(expires),
  });
  return c.json({ ok: true });
});

auth.post('/logout', (c) => {
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

auth.get('/tokens', async (c) => {
  requireOwner(c);
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, prefix, last_used_at, created_at FROM tokens ORDER BY id DESC',
  ).all();
  return c.json({ tokens: results });
});

auth.post('/tokens', async (c) => {
  requireOwner(c);
  const name = text((await body(c)).name, 'name', 40, 1);
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const secret = `tane_${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const row = await c.env.DB.prepare(
    `INSERT INTO tokens (name, hash, prefix, created_at) VALUES (?, ?, ?, ?)
     RETURNING id, name, prefix, last_used_at, created_at`,
  )
    .bind(name, await sha256(secret), secret.slice(0, 10), now())
    .first();
  return c.json({ token: row, secret }, 201);
});

auth.delete('/tokens/:id', async (c) => {
  requireOwner(c);
  const { meta } = await c.env.DB.prepare('DELETE FROM tokens WHERE id = ?')
    .bind(Number(c.req.param('id')))
    .run();
  if (!meta.changes) throw notFound('Token');
  return c.json({ ok: true });
});
