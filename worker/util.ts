import type { Context } from 'hono';

export type Env = { DB: D1Database; ADMIN_PASSWORD: string };
export type Actor = { type: 'owner' | 'agent'; name: string } | null;
export type App = { Bindings: Env; Variables: { actor: Actor } };
export type Ctx = Context<App>;

export type Project = {
  id: number;
  slug: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  hue: number;
  visibility: 'private' | 'public';
  allow_submissions: number;
  collect_enabled: number;
  next_number: number;
  rev: number;
  position: number;
  created_at: number;
  updated_at: number;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what = '资源') => new ApiError(404, 'not_found', `${what}不存在`);
export const invalid = (message: string) => new ApiError(400, 'invalid', message);

export const now = () => Date.now();

const encoder = new TextEncoder();

export async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function body<T = Record<string, any>>(c: Ctx): Promise<T> {
  try {
    const parsed = await c.req.json();
    if (parsed && typeof parsed === 'object') return parsed as T;
  } catch {
    // Fall through to the error below.
  }
  throw invalid('请求体必须是 JSON 对象');
}

export function text(value: unknown, field: string, max: number, min = 0): string {
  if (typeof value !== 'string') throw invalid(`${field} 必须是字符串`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw invalid(`${field} 不能为空`);
  if (trimmed.length > max) throw invalid(`${field} 不能超过 ${max} 个字符`);
  return trimmed;
}

export function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(`${field} 必须是 ${min} 到 ${max} 之间的整数`);
  }
  return value;
}

export function httpUrl(value: unknown, field: string): string {
  const raw = text(value, field, 2000);
  if (!raw) return '';
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw invalid(`${field} 不是有效链接`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw invalid(`${field} 只支持 http 或 https 链接`);
  }
  return raw;
}

export function clientIp(c: Ctx): string {
  return c.req.header('cf-connecting-ip') ?? 'local';
}

/** Fixed-window limiter backed by D1. Returns false once the window is spent. */
export async function rateLimit(c: Ctx, key: string, limit: number, windowMs: number) {
  const t = now();
  const row = await c.env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN reset_at < ?3 THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at < ?3 THEN ?2 ELSE reset_at END
     RETURNING count`,
  )
    .bind(key, t + windowMs, t)
    .first<{ count: number }>();
  // Every visitor leaves a counter behind, so expired ones are swept now and then.
  if (Math.random() < 0.01) c.executionCtx.waitUntil(c.env.DB.prepare('DELETE FROM rate_limits WHERE reset_at < ?').bind(t).run());
  return (row?.count ?? 0) <= limit;
}

/** Stable hue from a label name so agent-created labels get consistent colors. */
export function hueFor(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  return hash;
}

export function bumpRev(c: Ctx, projectId: number) {
  return c.env.DB.prepare('UPDATE projects SET rev = rev + 1, updated_at = ? WHERE id = ?').bind(
    now(),
    projectId,
  );
}

export function logActivity(
  c: Ctx,
  projectId: number,
  cardId: number | null,
  kind: string,
  data: Record<string, unknown> = {},
) {
  return c.env.DB.prepare(
    'INSERT INTO activity (project_id, card_id, actor, kind, data, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(projectId, cardId, c.get('actor')!.name, kind, JSON.stringify(data), now());
}

/** Loads a project and enforces visibility. Private projects read as missing to visitors. */
export async function loadProject(c: Ctx, access: 'read' | 'write' = 'read'): Promise<Project> {
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE slug = ?')
    .bind(c.req.param('slug'))
    .first<Project>();
  const actor = c.get('actor');
  if (!project || (!actor && project.visibility !== 'public')) throw notFound('项目');
  if (access === 'write' && !actor) throw new ApiError(401, 'unauthorized', '需要登录');
  return project;
}

/**
 * Computes a sort position that places an item directly after `afterId`
 * (or first when null), re-spacing the sequence if floats get too close.
 */
export async function positionAfter(
  c: Ctx,
  table: 'cards' | 'statuses' | 'checklist_items',
  where: string,
  binds: unknown[],
  afterId: number | null,
  selfId?: number,
): Promise<number> {
  const { results } = await c.env.DB.prepare(
    `SELECT id, position FROM ${table} WHERE ${where} ORDER BY position, id`,
  )
    .bind(...binds)
    .all<{ id: number; position: number }>();
  const items = results.filter((r) => r.id !== selfId);
  let index = 0;
  if (afterId !== null) {
    const found = items.findIndex((r) => r.id === afterId);
    if (found < 0) throw invalid('after 指向的条目不在目标位置');
    index = found + 1;
  }
  const prev = items[index - 1]?.position;
  const next = items[index]?.position;
  if (prev === undefined && next === undefined) return 1024;
  if (prev === undefined) return next! - 1024;
  if (next === undefined) return prev + 1024;
  if (next - prev > 1e-6) return (prev + next) / 2;

  // Gap exhausted: rewrite the whole sequence with room around the slot.
  const statements = items.map((item, i) =>
    c.env.DB.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`).bind(
      (i < index ? i : i + 1) * 1024,
      item.id,
    ),
  );
  await c.env.DB.batch(statements);
  return index * 1024;
}
