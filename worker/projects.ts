import { Hono } from 'hono';
import { requireActor, requireOwner } from './auth';
import {
  ApiError,
  type App,
  type Ctx,
  type Project,
  body,
  bumpRev,
  hueFor,
  integer,
  invalid,
  loadProject,
  notFound,
  now,
  positionAfter,
  text,
} from './util';
import { listCards } from './cards';

const DEFAULT_STATUSES: [string, string][] = [
  ['待规划', 'backlog'],
  ['计划中', 'backlog'],
  ['进行中', 'active'],
  ['已完成', 'done'],
  ['不做', 'canceled'],
];
const CATEGORIES = ['backlog', 'active', 'done', 'canceled'];

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const KEY = /^[A-Z][A-Z0-9]{0,5}$/;

function publicProject(p: Project) {
  const { next_number, position, ...rest } = p;
  return rest;
}

function deriveKey(slug: string) {
  const letters = slug.replace(/[^a-z0-9]/g, '').toUpperCase();
  return /^[A-Z]/.test(letters) ? letters.slice(0, 4) : `P${letters.slice(0, 3)}`;
}

export const projects = new Hono<App>();

export async function listProjects(c: Ctx) {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*,
       (SELECT count(*) FROM cards c JOIN statuses s ON s.id = c.status_id
         WHERE c.project_id = p.id AND c.deleted_at IS NULL AND s.category IN ('backlog','active')) AS open_cards,
       (SELECT count(*) FROM feedback f
         WHERE f.project_id = p.id AND f.card_id IS NULL AND f.dismissed_at IS NULL) AS inbox
     FROM projects p ORDER BY p.position, p.id`,
  ).all<Project & { open_cards: number; inbox: number }>();
  return results.map(publicProject);
}

projects.get('/', async (c) => {
  requireActor(c);
  return c.json({ projects: await listProjects(c) });
});

projects.post('/', async (c) => {
  requireActor(c);
  const input = await body(c);
  const name = text(input.name, 'name', 60, 1);
  const slug = text(input.slug, 'slug', 40, 1).toLowerCase();
  if (!SLUG.test(slug)) throw invalid('slug 只能包含小写字母、数字和连字符');
  const key = input.key ? text(input.key, 'key', 6, 1).toUpperCase() : deriveKey(slug);
  if (!KEY.test(key)) throw invalid('key 须以字母开头，只含字母和数字，最多 6 位');
  const hue = input.hue === undefined ? 255 : integer(input.hue, 'hue', 0, 360);
  const t = now();

  const db = c.env.DB;
  const exists = await db.prepare('SELECT 1 FROM projects WHERE slug = ?').bind(slug).first();
  if (exists) throw new ApiError(409, 'slug_taken', '这个 slug 已被使用');

  const project = await db
    .prepare(
      `INSERT INTO projects (slug, key, name, description, icon, hue, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      slug,
      key,
      name,
      input.description ? text(input.description, 'description', 500) : '',
      input.icon ? text(input.icon, 'icon', 8) : '',
      hue,
      t,
      t,
      t,
    )
    .first<Project>();

  await db.batch(
    DEFAULT_STATUSES.map(([statusName, category], i) =>
      db
        .prepare('INSERT INTO statuses (project_id, name, category, position) VALUES (?, ?, ?, ?)')
        .bind(project!.id, statusName, category, (i + 1) * 1024),
    ),
  );
  return c.json({ project: publicProject(project!) }, 201);
});

async function boardPayload(c: Ctx, project: Project) {
  const db = c.env.DB;
  const editable = !!c.get('actor');
  const [statuses, labels, releases, cards] = await Promise.all([
    db
      .prepare(
        `SELECT id, name, category, position FROM statuses
         WHERE project_id = ? ${editable ? '' : "AND category != 'canceled'"} ORDER BY position, id`,
      )
      .bind(project.id)
      .all(),
    db.prepare('SELECT id, name, hue FROM labels WHERE project_id = ? ORDER BY name').bind(project.id).all(),
    db
      .prepare(
        `SELECT id, name, body, status, published_at, created_at FROM releases
         WHERE project_id = ? ${editable ? '' : "AND status = 'published'"}
         ORDER BY coalesce(published_at, created_at) DESC`,
      )
      .bind(project.id)
      .all(),
    listCards(c, project),
  ]);
  return {
    project: publicProject(project),
    viewer: { editable },
    statuses: statuses.results,
    labels: labels.results,
    releases: releases.results,
    cards,
  };
}

// Visitors share one copy per edge location, so a busy public board stays off the database.
const VISITOR_CACHE_SECONDS = 300;

// The board is polled, so a cheap revision check lets unchanged polls skip every query.
projects.get('/:slug', async (c) => {
  const cache = c.get('actor') || import.meta.env.DEV ? null : await caches.open('boards');
  // Keyed on the slug alone, so varying the URL cannot force a fresh read.
  const key = new Request(new URL(`/api/projects/${c.req.param('slug')}`, c.req.url));
  const sent = c.req.header('if-none-match');
  const cached = await cache?.match(key);
  if (cached) return sent === cached.headers.get('etag') ? c.body(null, 304) : cached;

  const project = await loadProject(c);
  const etag = `W/"${project.rev}-${c.get('actor') ? 'e' : 'v'}"`;
  const headers = { ETag: etag, 'Cache-Control': cache ? `public, max-age=${VISITOR_CACHE_SECONDS}` : 'private, no-cache' };
  if (sent === etag) return c.body(null, 304, headers);
  const response = c.json(await boardPayload(c, project), 200, headers);
  if (cache) c.executionCtx.waitUntil(cache.put(key, response.clone()));
  return response;
});

projects.patch('/:slug', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const sets: string[] = [];
  const binds: unknown[] = [];
  const put = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    binds.push(value);
  };
  if (input.name !== undefined) put('name', text(input.name, 'name', 60, 1));
  if (input.description !== undefined) put('description', text(input.description, 'description', 500));
  if (input.icon !== undefined) put('icon', text(input.icon, 'icon', 8));
  if (input.hue !== undefined) put('hue', integer(input.hue, 'hue', 0, 360));
  if (input.key !== undefined) {
    const key = text(input.key, 'key', 6, 1).toUpperCase();
    if (!KEY.test(key)) throw invalid('key 须以字母开头，只含字母和数字，最多 6 位');
    put('key', key);
  }
  if (input.visibility !== undefined) {
    // Making a board public is outward-facing, so a leaked agent token must not be able to.
    requireOwner(c);
    if (input.visibility !== 'private' && input.visibility !== 'public') throw invalid('visibility 无效');
    put('visibility', input.visibility);
  }
  if (input.allow_submissions !== undefined || input.collect_enabled !== undefined) requireOwner(c);
  if (input.allow_submissions !== undefined) put('allow_submissions', input.allow_submissions ? 1 : 0);
  if (input.collect_enabled !== undefined) put('collect_enabled', input.collect_enabled ? 1 : 0);
  if (!sets.length) throw invalid('没有可更新的字段');

  put('rev', project.rev + 1);
  put('updated_at', now());
  const updated = await c.env.DB.prepare(`UPDATE projects SET ${sets.join(', ')} WHERE id = ? RETURNING *`)
    .bind(...binds, project.id)
    .first<Project>();
  return c.json({ project: publicProject(updated!) });
});

projects.delete('/:slug', async (c) => {
  requireOwner(c);
  const project = await loadProject(c, 'write');
  if ((await body(c)).confirm !== project.slug) throw invalid('请输入项目 slug 以确认删除');
  const db = c.env.DB;
  // cards reference statuses without cascade, so they have to go first.
  await db.batch([
    db.prepare('UPDATE cards SET merged_into = NULL WHERE project_id = ?').bind(project.id),
    db.prepare('DELETE FROM cards WHERE project_id = ?').bind(project.id),
    db.prepare('DELETE FROM projects WHERE id = ?').bind(project.id),
  ]);
  return c.json({ ok: true });
});

// Statuses

projects.post('/:slug/statuses', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const name = text(input.name, 'name', 30, 1);
  const category = input.category ?? 'backlog';
  if (!CATEGORIES.includes(category)) throw invalid('category 无效');
  const position = await positionAfter(
    c,
    'statuses',
    'project_id = ?',
    [project.id],
    input.after ?? (await lastStatusId(c, project.id)),
  );
  const db = c.env.DB;
  const [inserted] = await db.batch([
    db
      .prepare('INSERT INTO statuses (project_id, name, category, position) VALUES (?, ?, ?, ?) RETURNING id, name, category, position')
      .bind(project.id, name, category, position),
    bumpRev(c, project.id),
  ]);
  return c.json({ status: inserted.results[0] }, 201);
});

async function lastStatusId(c: Ctx, projectId: number) {
  const row = await c.env.DB.prepare('SELECT id FROM statuses WHERE project_id = ? ORDER BY position DESC, id DESC LIMIT 1')
    .bind(projectId)
    .first<{ id: number }>();
  return row?.id ?? null;
}

projects.patch('/:slug/statuses/:id', async (c) => {
  const project = await loadProject(c, 'write');
  const id = Number(c.req.param('id'));
  const current = await c.env.DB.prepare('SELECT * FROM statuses WHERE id = ? AND project_id = ?')
    .bind(id, project.id)
    .first();
  if (!current) throw notFound('状态');
  const input = await body(c);
  const db = c.env.DB;
  const name = input.name !== undefined ? text(input.name, 'name', 30, 1) : current.name;
  const category = input.category ?? current.category;
  if (!CATEGORIES.includes(category as string)) throw invalid('category 无效');
  let position = current.position;
  if (input.after !== undefined) {
    position = await positionAfter(c, 'statuses', 'project_id = ?', [project.id], input.after, id);
  }
  const statements = [
    db.prepare('UPDATE statuses SET name = ?, category = ?, position = ? WHERE id = ?').bind(name, category, position, id),
    bumpRev(c, project.id),
  ];
  // Completion is derived from the category, so re-categorising must restamp its cards.
  if (category !== current.category) {
    statements.push(
      db
        .prepare(
          `UPDATE cards SET completed_at = CASE WHEN ?1 = 'done' THEN coalesce(completed_at, ?2) ELSE NULL END
           WHERE status_id = ?3`,
        )
        .bind(category, now(), id),
    );
  }
  await db.batch(statements);
  return c.json({ status: { id, name, category, position } });
});

projects.delete('/:slug/statuses/:id', async (c) => {
  const project = await loadProject(c, 'write');
  const id = Number(c.req.param('id'));
  const moveTo = Number(c.req.query('move_to'));
  const db = c.env.DB;
  const { results } = await db.prepare('SELECT id, category FROM statuses WHERE project_id = ?').bind(project.id).all<{ id: number; category: string }>();
  if (!results.some((s) => s.id === id)) throw notFound('状态');
  if (results.length === 1) throw invalid('至少需要保留一个状态');
  const target = results.find((s) => s.id === moveTo && s.id !== id);
  // Soft-deleted cards still reference the status, so they move too.
  const { count } = (await db.prepare('SELECT count(*) AS count FROM cards WHERE status_id = ?').bind(id).first<{ count: number }>())!;
  if (count && !target) throw invalid('该状态下还有卡片，请通过 move_to 指定迁移目标');
  const statements = [];
  if (target) {
    statements.push(
      db
        .prepare(
          `UPDATE cards SET status_id = ?1,
             completed_at = CASE WHEN ?2 = 'done' THEN coalesce(completed_at, ?3) ELSE NULL END
           WHERE status_id = ?4`,
        )
        .bind(target.id, target.category, now(), id),
    );
  }
  statements.push(db.prepare('DELETE FROM statuses WHERE id = ?').bind(id), bumpRev(c, project.id));
  await db.batch(statements);
  return c.json({ ok: true });
});

// Labels

projects.post('/:slug/labels', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const name = text(input.name, 'name', 30, 1);
  const hue = input.hue === undefined ? hueFor(name) : integer(input.hue, 'hue', 0, 360);
  const db = c.env.DB;
  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO labels (project_id, name, hue) VALUES (?, ?, ?)
         ON CONFLICT (project_id, name) DO UPDATE SET name = excluded.name
         RETURNING id, name, hue`,
      )
      .bind(project.id, name, hue),
    bumpRev(c, project.id),
  ]);
  return c.json({ label: inserted.results[0] }, 201);
});

projects.patch('/:slug/labels/:id', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const db = c.env.DB;
  const current = await db.prepare('SELECT * FROM labels WHERE id = ? AND project_id = ?')
    .bind(Number(c.req.param('id')), project.id)
    .first<{ id: number; name: string; hue: number }>();
  if (!current) throw notFound('标签');
  const name = input.name !== undefined ? text(input.name, 'name', 30, 1) : current.name;
  const hue = input.hue !== undefined ? integer(input.hue, 'hue', 0, 360) : current.hue;
  const clash = await db.prepare('SELECT 1 FROM labels WHERE project_id = ? AND name = ? AND id != ?').bind(project.id, name, current.id).first();
  if (clash) throw new ApiError(409, 'name_taken', '已有同名标签');
  await db.batch([
    db.prepare('UPDATE labels SET name = ?, hue = ? WHERE id = ?').bind(name, hue, current.id),
    bumpRev(c, project.id),
  ]);
  return c.json({ label: { id: current.id, name, hue } });
});

projects.delete('/:slug/labels/:id', async (c) => {
  const project = await loadProject(c, 'write');
  const db = c.env.DB;
  const [deleted] = await db.batch([
    db.prepare('DELETE FROM labels WHERE id = ? AND project_id = ?').bind(Number(c.req.param('id')), project.id),
    bumpRev(c, project.id),
  ]);
  if (!deleted.meta.changes) throw notFound('标签');
  return c.json({ ok: true });
});

// Releases

projects.post('/:slug/releases', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const db = c.env.DB;
  const [inserted] = await db.batch([
    db
      .prepare(
        `INSERT INTO releases (project_id, name, body, created_at) VALUES (?, ?, ?, ?)
         RETURNING id, name, body, status, published_at, created_at`,
      )
      .bind(project.id, text(input.name, 'name', 80, 1), input.body ? text(input.body, 'body', 20000) : '', now()),
    bumpRev(c, project.id),
  ]);
  return c.json({ release: inserted.results[0] }, 201);
});

projects.patch('/:slug/releases/:id', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const db = c.env.DB;
  const current = await db.prepare('SELECT * FROM releases WHERE id = ? AND project_id = ?')
    .bind(Number(c.req.param('id')), project.id)
    .first<{ id: number; name: string; body: string; status: string; published_at: number | null; created_at: number }>();
  if (!current) throw notFound('版本');
  // A published release is public text.
  if (current.status === 'published') requireOwner(c);
  const name = input.name !== undefined ? text(input.name, 'name', 80, 1) : current.name;
  const releaseBody = input.body !== undefined ? text(input.body, 'body', 20000) : current.body;
  let status = current.status;
  let publishedAt = current.published_at;
  if (input.status !== undefined && input.status !== current.status) {
    // Publishing goes out to the public changelog, so it stays a human decision.
    requireOwner(c);
    if (input.status !== 'draft' && input.status !== 'published') throw invalid('status 无效');
    status = input.status;
    publishedAt = status === 'published' ? now() : null;
  }
  await db.batch([
    db.prepare('UPDATE releases SET name = ?, body = ?, status = ?, published_at = ? WHERE id = ?').bind(name, releaseBody, status, publishedAt, current.id),
    bumpRev(c, project.id),
  ]);
  return c.json({ release: { ...current, name, body: releaseBody, status, published_at: publishedAt } });
});

projects.delete('/:slug/releases/:id', async (c) => {
  requireOwner(c);
  const project = await loadProject(c, 'write');
  const db = c.env.DB;
  const [deleted] = await db.batch([
    db.prepare('DELETE FROM releases WHERE id = ? AND project_id = ?').bind(Number(c.req.param('id')), project.id),
    bumpRev(c, project.id),
  ]);
  if (!deleted.meta.changes) throw notFound('版本');
  return c.json({ ok: true });
});
