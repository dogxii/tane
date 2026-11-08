import { Hono } from 'hono';
import {
  ApiError,
  type App,
  type Ctx,
  type Project,
  body,
  bumpRev,
  httpUrl,
  hueFor,
  integer,
  invalid,
  loadProject,
  logActivity,
  notFound,
  now,
  positionAfter,
  sha256,
  text,
  clientIp,
  rateLimit,
} from './util';
import { requireActor, requireOwner } from './auth';

type CardRow = {
  id: number;
  project_id: number;
  number: number;
  status_id: number;
  title: string;
  body: string;
  priority: number;
  position: number;
  is_private: number;
  release_id: number | null;
  keywords: string;
  version: number;
  merged_into: number | null;
  completed_at: number | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
};
type Status = { id: number; name: string; category: string };

// Mentions count distinct people, not rows, and are always derived so nobody can inflate them.
// Bodies can be 50 KB each and a board only needs to know one exists, so they stay out of this list.
const CARD_FIELDS = `c.id, c.number, c.status_id, c.title, c.priority, c.position, c.release_id, c.version,
  c.completed_at, c.created_at, c.updated_at, c.keywords, c.is_private, c.body != '' AS has_body,
  (SELECT count(DISTINCT coalesce(f.author_hash, f.id)) FROM feedback f WHERE f.card_id = c.id) AS mentions,
  (SELECT count(*) FROM checklist_items i WHERE i.card_id = c.id) AS checklist_total,
  (SELECT count(*) FROM checklist_items i WHERE i.card_id = c.id AND i.done = 1) AS checklist_done,
  (SELECT group_concat(l.label_id) FROM card_labels l WHERE l.card_id = c.id) AS label_list`;

function shapeCard(row: any, editable: boolean) {
  const { label_list, has_body, keywords, is_private, ...rest } = row;
  return {
    ...rest,
    label_ids: label_list ? String(label_list).split(',').map(Number) : [],
    has_body: !!has_body,
    ...(editable ? { keywords, is_private: !!is_private } : {}),
  };
}

export async function listCards(c: Ctx, project: Project) {
  const editable = !!c.get('actor');
  const visibility = editable
    ? ''
    : `AND c.is_private = 0 AND c.status_id NOT IN (SELECT id FROM statuses WHERE category = 'canceled' AND project_id = c.project_id)`;
  const { results } = await c.env.DB.prepare(
    `SELECT ${CARD_FIELDS} FROM cards c WHERE c.project_id = ? AND c.deleted_at IS NULL ${visibility} ORDER BY c.position, c.id`,
  )
    .bind(project.id)
    .all();
  return results.map((row) => shapeCard(row, editable));
}

async function findCard(c: Ctx, project: Project, number: number): Promise<CardRow> {
  const row = await c.env.DB.prepare('SELECT * FROM cards WHERE project_id = ? AND number = ?')
    .bind(project.id, number)
    .first<CardRow>();
  if (!row || row.deleted_at !== null) throw notFound('卡片');
  return row;
}

const cardNumber = (c: Ctx) => {
  const n = Number(c.req.param('number'));
  if (!Number.isInteger(n)) throw notFound('卡片');
  return n;
};

async function freshCard(c: Ctx, id: number) {
  const row = await c.env.DB.prepare(`SELECT ${CARD_FIELDS} FROM cards c WHERE c.id = ?`).bind(id).first();
  return shapeCard(row, true);
}

/** Accepts a status id or its display name, which is what agents naturally have. */
async function resolveStatus(c: Ctx, project: Project, ref: unknown): Promise<Status> {
  const { results } = await c.env.DB.prepare(
    'SELECT id, name, category FROM statuses WHERE project_id = ? ORDER BY position, id',
  )
    .bind(project.id)
    .all<Status>();
  const found = results.find((s) => s.id === ref || s.name === ref);
  if (found) return found;
  // Category aliases let `done` work on any board, however its columns are named.
  const byCategory = results.find((s) => s.category === ref);
  if (byCategory) return byCategory;
  throw invalid(`状态不存在：${String(ref)}`);
}

async function resolveLabels(c: Ctx, project: Project, names: unknown): Promise<number[]> {
  if (!Array.isArray(names)) throw invalid('labels 必须是数组');
  const db = c.env.DB;
  const ids: number[] = [];
  for (const ref of names) {
    if (typeof ref === 'number') {
      const row = await db.prepare('SELECT id FROM labels WHERE id = ? AND project_id = ?').bind(ref, project.id).first<{ id: number }>();
      if (!row) throw invalid(`标签不存在：${ref}`);
      ids.push(row.id);
      continue;
    }
    const name = text(ref, 'label', 30, 1);
    const row = await db
      .prepare(
        `INSERT INTO labels (project_id, name, hue) VALUES (?, ?, ?)
         ON CONFLICT (project_id, name) DO UPDATE SET name = excluded.name RETURNING id`,
      )
      .bind(project.id, name, hueFor(name))
      .first<{ id: number }>();
    ids.push(row!.id);
  }
  return [...new Set(ids)];
}

const completedAt = (category: string, current: number | null) =>
  category === 'done' ? (current ?? now()) : null;

export const cards = new Hono<App>();

// Agents only. The public board has its cached route, and this one would be a way around it.
cards.get('/:slug/cards', async (c) => {
  const project = await loadProject(c, 'write');
  let list: any[] = await listCards(c, project);
  const { status, label, q, compact, limit } = c.req.query();
  const db = c.env.DB;
  const [{ results: statuses }, { results: labels }] = await Promise.all([
    db.prepare('SELECT id, name, category FROM statuses WHERE project_id = ?').bind(project.id).all<Status>(),
    db.prepare('SELECT id, name FROM labels WHERE project_id = ?').bind(project.id).all<{ id: number; name: string }>(),
  ]);
  const statusName = new Map(statuses.map((s) => [s.id, s.name]));
  const labelName = new Map(labels.map((l) => [l.id, l.name]));
  if (status) {
    const wanted = statuses.filter((s) => s.name === status || s.category === status).map((s) => s.id);
    list = list.filter((card) => wanted.includes(card.status_id));
  }
  if (label) {
    const id = labels.find((l) => l.name === label)?.id;
    list = list.filter((card) => card.label_ids.includes(id));
  }
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((card) => `${card.title} ${card.keywords}`.toLowerCase().includes(needle));
  }
  if (limit) list = list.slice(0, Math.max(0, Number(limit) || 0));
  const named = list.map((card) => ({
    ...card,
    status: statusName.get(card.status_id),
    labels: card.label_ids.map((id: number) => labelName.get(id)),
  }));
  if (compact) {
    return c.json({
      cards: named.map(({ number, title, status: s, labels: l, keywords, mentions }) => ({
        number,
        title,
        status: s,
        labels: l,
        keywords,
        mentions,
      })),
    });
  }
  return c.json({ cards: named });
});

cards.post('/:slug/cards', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  const db = c.env.DB;
  const title = text(input.title, 'title', 200, 1);
  const status = await resolveStatus(c, project, input.status ?? 'backlog');
  const labelIds = input.labels ? await resolveLabels(c, project, input.labels) : [];
  const priority = input.priority === undefined ? 0 : integer(input.priority, 'priority', 0, 4);
  const position = input.after !== undefined
    ? await positionAfter(
        c,
        'cards',
        'project_id = ? AND status_id = ? AND deleted_at IS NULL',
        [project.id, status.id],
        input.after === null ? null : await cardIdByNumber(c, project, input.after),
      )
    : await topPosition(c, project.id, status.id);

  const allocated = await db
    .prepare('UPDATE projects SET next_number = next_number + 1 WHERE id = ? RETURNING next_number')
    .bind(project.id)
    .first<{ next_number: number }>();
  const number = allocated!.next_number - 1;
  const t = now();
  const row = await db
    .prepare(
      `INSERT INTO cards (project_id, number, status_id, title, body, priority, position, is_private, keywords, completed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .bind(
      project.id,
      number,
      status.id,
      title,
      input.body ? text(input.body, 'body', 50000) : '',
      priority,
      position,
      // Agents summarize untrusted text, so what they create stays off public boards until reviewed.
      requireActor(c).type === 'agent' || input.is_private ? 1 : 0,
      input.keywords ? text(input.keywords, 'keywords', 1000) : '',
      completedAt(status.category, null),
      t,
      t,
    )
    .first<{ id: number }>();
  await db.batch([
    ...labelIds.map((id) => db.prepare('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)').bind(row!.id, id)),
    logActivity(c, project.id, row!.id, 'created', { title, reason: input.reason }),
    bumpRev(c, project.id),
  ]);
  return c.json({ card: await freshCard(c, row!.id) }, 201);
});

async function topPosition(c: Ctx, projectId: number, statusId: number) {
  const row = await c.env.DB.prepare('SELECT min(position) AS p FROM cards WHERE project_id = ? AND status_id = ? AND deleted_at IS NULL')
    .bind(projectId, statusId)
    .first<{ p: number | null }>();
  return (row?.p ?? 2048) - 1024;
}

cards.get('/:slug/cards/:number', async (c) => {
  const project = await loadProject(c);
  const card = await findCard(c, project, cardNumber(c));
  const editable = !!c.get('actor');
  const db = c.env.DB;
  if (!editable) {
    const status = await db.prepare('SELECT category FROM statuses WHERE id = ?').bind(card.status_id).first<{ category: string }>();
    if (card.is_private || status?.category === 'canceled') throw notFound('卡片');
  }
  const [row, checklist] = await Promise.all([
    db.prepare(`SELECT ${CARD_FIELDS} FROM cards c WHERE c.id = ?`).bind(card.id).first(),
    db.prepare('SELECT id, text, done, position FROM checklist_items WHERE card_id = ? ORDER BY position, id').bind(card.id).all(),
  ]);
  const detail: Record<string, unknown> = {
    ...shapeCard(row, editable),
    body: card.body,
    checklist: checklist.results.map((i: any) => ({ ...i, done: !!i.done })),
  };
  if (editable) {
    const [feedback, activity] = await Promise.all([
      db.prepare('SELECT * FROM feedback WHERE card_id = ? ORDER BY coalesce(posted_at, created_at) DESC').bind(card.id).all(),
      db.prepare('SELECT id, actor, kind, data, created_at FROM activity WHERE card_id = ? ORDER BY id DESC LIMIT 100').bind(card.id).all(),
    ]);
    detail.feedback = feedback.results.map(shapeFeedback);
    detail.activity = activity.results.map((a: any) => ({ ...a, data: JSON.parse(a.data) }));
  }
  return c.json({ card: detail });
});

cards.patch('/:slug/cards/:number', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await findCard(c, project, cardNumber(c));
  const input = await body(c);
  if (input.version !== undefined && input.version !== card.version) {
    throw new ApiError(409, 'version_conflict', '卡片已被修改，请重新读取后再试', { current_version: card.version });
  }
  const db = c.env.DB;
  const sets: string[] = [];
  const binds: unknown[] = [];
  const changes: Record<string, [unknown, unknown]> = {};
  const put = (column: string, value: unknown, track = true) => {
    sets.push(`${column} = ?`);
    binds.push(value);
    if (track) changes[column] = [(card as any)[column], value];
  };
  const statements: D1PreparedStatement[] = [];

  if (input.title !== undefined) {
    const value = text(input.title, 'title', 200, 1);
    if (value !== card.title) put('title', value);
  }
  if (input.body !== undefined) {
    const value = text(input.body, 'body', 50000);
    if (value !== card.body) {
      put('body', value, false);
      changes.body = [null, null];
    }
  }
  if (input.priority !== undefined) {
    const value = integer(input.priority, 'priority', 0, 4);
    if (value !== card.priority) put('priority', value);
  }
  if (input.is_private !== undefined) {
    const value = input.is_private ? 1 : 0;
    if (value !== card.is_private) {
      if (value === 0) requireOwner(c);
      put('is_private', value);
    }
  }
  if (input.keywords !== undefined) put('keywords', text(input.keywords, 'keywords', 1000), false);

  if (input.release_id !== undefined) {
    let value: number | null = input.release_id;
    if (value !== null) {
      const release = await db.prepare('SELECT id FROM releases WHERE id = ? AND project_id = ?').bind(value, project.id).first();
      if (!release) throw invalid('版本不存在');
    }
    if (value !== card.release_id) put('release_id', value);
  }

  let statusId = card.status_id;
  if (input.status !== undefined) {
    const status = await resolveStatus(c, project, input.status);
    statusId = status.id;
    if (status.id !== card.status_id) {
      put('status_id', status.id, false);
      changes.status = [await statusName(c, card.status_id), status.name];
      put('completed_at', completedAt(status.category, card.completed_at), false);
    }
  }
  if (input.after !== undefined) {
    const after = input.after === null ? null : await cardIdByNumber(c, project, input.after);
    put(
      'position',
      await positionAfter(c, 'cards', 'project_id = ? AND status_id = ? AND deleted_at IS NULL', [project.id, statusId], after, card.id),
      false,
    );
  } else if (statusId !== card.status_id) {
    put('position', await topPosition(c, project.id, statusId), false);
  }

  if (input.labels !== undefined || input.add_labels !== undefined || input.remove_labels !== undefined) {
    const { results } = await db.prepare('SELECT label_id FROM card_labels WHERE card_id = ?').bind(card.id).all<{ label_id: number }>();
    const before = new Set(results.map((r) => r.label_id));
    const next = input.labels !== undefined ? new Set(await resolveLabels(c, project, input.labels)) : new Set(before);
    if (input.add_labels) for (const id of await resolveLabels(c, project, input.add_labels)) next.add(id);
    if (input.remove_labels) for (const id of await resolveLabels(c, project, input.remove_labels)) next.delete(id);
    const added = [...next].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !next.has(id));
    for (const id of added) statements.push(db.prepare('INSERT OR IGNORE INTO card_labels (card_id, label_id) VALUES (?, ?)').bind(card.id, id));
    for (const id of removed) statements.push(db.prepare('DELETE FROM card_labels WHERE card_id = ? AND label_id = ?').bind(card.id, id));
    if (added.length || removed.length) changes.labels = [added, removed];
  }

  if (!sets.length && !statements.length) return c.json({ card: await freshCard(c, card.id) });

  sets.push('version = version + 1', 'updated_at = ?');
  binds.push(now());
  statements.unshift(db.prepare(`UPDATE cards SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, card.id));
  if (Object.keys(changes).length) {
    statements.push(logActivity(c, project.id, card.id, 'updated', { changes, reason: input.reason }));
  }
  statements.push(bumpRev(c, project.id));
  await db.batch(statements);
  return c.json({ card: await freshCard(c, card.id) });
});

async function statusName(c: Ctx, id: number) {
  const row = await c.env.DB.prepare('SELECT name FROM statuses WHERE id = ?').bind(id).first<{ name: string }>();
  return row?.name ?? null;
}

async function cardIdByNumber(c: Ctx, project: Project, number: unknown) {
  if (typeof number !== 'number') throw invalid('after 必须是卡片编号或 null');
  return (await findCard(c, project, number)).id;
}

// Deleting is always soft and undoable, including for agents.
cards.delete('/:slug/cards/:number', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await findCard(c, project, cardNumber(c));
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE cards SET deleted_at = ? WHERE id = ?').bind(now(), card.id),
    logActivity(c, project.id, card.id, 'deleted'),
    bumpRev(c, project.id),
  ]);
  return c.json({ ok: true });
});

cards.post('/:slug/cards/:number/restore', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await c.env.DB.prepare('SELECT * FROM cards WHERE project_id = ? AND number = ?')
    .bind(project.id, cardNumber(c))
    .first<CardRow>();
  if (!card) throw notFound('卡片');
  if (card.merged_into !== null) throw new ApiError(409, 'merged', '已合并的卡片不能恢复');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE cards SET deleted_at = NULL WHERE id = ?').bind(card.id),
    logActivity(c, project.id, card.id, 'restored'),
    bumpRev(c, project.id),
  ]);
  return c.json({ card: await freshCard(c, card.id) });
});

// Merging keeps every piece of feedback so duplicates add up on the surviving card.
cards.post('/:slug/cards/:number/merge', async (c) => {
  const project = await loadProject(c, 'write');
  const source = await findCard(c, project, cardNumber(c));
  const input = await body(c);
  const target = await findCard(c, project, integer(input.into, 'into', 1, Number.MAX_SAFE_INTEGER));
  if (source.id === target.id) throw invalid('不能合并到自身');
  const db = c.env.DB;
  const t = now();
  await db.batch([
    db.prepare('UPDATE feedback SET card_id = ? WHERE card_id = ?').bind(target.id, source.id),
    db.prepare('UPDATE cards SET merged_into = ?, deleted_at = ? WHERE id = ?').bind(target.id, t, source.id),
    db.prepare('UPDATE cards SET version = version + 1, updated_at = ? WHERE id = ?').bind(t, target.id),
    logActivity(c, project.id, target.id, 'merged', { from: source.number, title: source.title, reason: input.reason }),
    bumpRev(c, project.id),
  ]);
  return c.json({ card: await freshCard(c, target.id) });
});

cards.post('/:slug/cards/:number/comments', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await findCard(c, project, cardNumber(c));
  const value = text((await body(c)).text, 'text', 5000, 1);
  await c.env.DB.batch([logActivity(c, project.id, card.id, 'comment', { text: value }), bumpRev(c, project.id)]);
  return c.json({ ok: true }, 201);
});

// Checklist

cards.post('/:slug/cards/:number/checklist', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await findCard(c, project, cardNumber(c));
  const value = text((await body(c)).text, 'text', 300, 1);
  const last = await c.env.DB.prepare('SELECT max(position) AS p FROM checklist_items WHERE card_id = ?').bind(card.id).first<{ p: number | null }>();
  const db = c.env.DB;
  const [inserted] = await db.batch([
    db.prepare('INSERT INTO checklist_items (card_id, text, position) VALUES (?, ?, ?) RETURNING id, text, done, position').bind(card.id, value, (last?.p ?? 0) + 1024),
    bumpRev(c, project.id),
  ]);
  const item = inserted.results[0] as any;
  return c.json({ item: { ...item, done: !!item.done } }, 201);
});

async function findItem(c: Ctx, card: CardRow) {
  const item = await c.env.DB.prepare('SELECT * FROM checklist_items WHERE id = ? AND card_id = ?')
    .bind(Number(c.req.param('item')), card.id)
    .first<{ id: number; text: string; done: number; position: number }>();
  if (!item) throw notFound('清单项');
  return item;
}

cards.patch('/:slug/cards/:number/checklist/:item', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await findCard(c, project, cardNumber(c));
  const item = await findItem(c, card);
  const input = await body(c);
  const value = input.text !== undefined ? text(input.text, 'text', 300, 1) : item.text;
  const done = input.done !== undefined ? (input.done ? 1 : 0) : item.done;
  const position = input.after !== undefined
    ? await positionAfter(c, 'checklist_items', 'card_id = ?', [card.id], input.after, item.id)
    : item.position;
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE checklist_items SET text = ?, done = ?, position = ? WHERE id = ?').bind(value, done, position, item.id),
    bumpRev(c, project.id),
  ]);
  return c.json({ item: { id: item.id, text: value, done: !!done, position } });
});

cards.delete('/:slug/cards/:number/checklist/:item', async (c) => {
  const project = await loadProject(c, 'write');
  const card = await findCard(c, project, cardNumber(c));
  const item = await findItem(c, card);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM checklist_items WHERE id = ?').bind(item.id),
    bumpRev(c, project.id),
  ]);
  return c.json({ ok: true });
});

// Public participation

// Every visitor entry point stores the same way: only into the owner's private inbox.
async function storeSuggestion(c: Ctx, project: Project, source: 'public' | 'web') {
  const input = await body(c);
  // Hidden form field: people leave it empty, naive bots fill it. Pretend success for bots.
  if (input.website) return c.json({ ok: true }, 201);
  const value = text(input.body, 'body', 2000, 4);
  const ipHash = await sha256(`submit:${clientIp(c)}`);
  if (!(await rateLimit(c, `s:${ipHash}`, 5, 60 * 60 * 1000))) {
    throw new ApiError(429, 'rate_limited', '提交太频繁，请稍后再试');
  }
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO feedback (project_id, source, external_id, author_hash, body, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(project.id, source, crypto.randomUUID(), await sha256(`author:${project.id}:${ipHash}`), value, now()),
    bumpRev(c, project.id),
  ]);
  return c.json({ ok: true }, 201);
}

cards.post('/:slug/submit', async (c) => {
  const project = await loadProject(c);
  if (project.visibility !== 'public' || !project.allow_submissions) {
    throw new ApiError(403, 'submissions_disabled', '此项目未开启建议提交');
  }
  return storeSuggestion(c, project, 'public');
});

// The standalone feedback page. It reaches private projects, so it exposes only a name and icon,
// and a project with the page off looks exactly like one that does not exist.

export const collect = new Hono<App>();

async function collectProject(c: Ctx) {
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE slug = ? AND collect_enabled = 1')
    .bind(c.req.param('slug'))
    .first<Project>();
  if (!project) throw notFound('收集页');
  return project;
}

collect.get('/:slug', async (c) => {
  const { name, icon, hue, visibility } = await collectProject(c);
  return c.json({ project: { name, icon, hue, board: visibility === 'public' } });
});

collect.post('/:slug', async (c) => storeSuggestion(c, await collectProject(c), 'web'));

// Feedback

// Submitted text is untrusted input to whichever agent reads it, so it is fenced off in the API shape.
function shapeFeedback(row: any) {
  const { body: raw, project_id, ...rest } = row;
  return { ...rest, untrusted: { body: raw } };
}

cards.get('/:slug/feedback', async (c) => {
  const project = await loadProject(c, 'write');
  const { state = 'inbox', source, q, limit } = c.req.query();
  const where = ['f.project_id = ?'];
  const binds: unknown[] = [project.id];
  if (state === 'inbox') where.push('f.card_id IS NULL AND f.dismissed_at IS NULL');
  else if (state === 'linked') where.push('f.card_id IS NOT NULL');
  else if (state === 'dismissed') where.push('f.dismissed_at IS NOT NULL');
  else if (state !== 'all') throw invalid('state 无效');
  if (source) {
    where.push('f.source = ?');
    binds.push(source);
  }
  if (q) {
    where.push("f.body LIKE ? ESCAPE '\\'");
    binds.push(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
  }
  const { results } = await c.env.DB.prepare(
    `SELECT f.*, c.number AS card_number FROM feedback f LEFT JOIN cards c ON c.id = f.card_id
     WHERE ${where.join(' AND ')} ORDER BY coalesce(f.posted_at, f.created_at) DESC LIMIT ?`,
  )
    .bind(...binds, Math.min(Number(limit) || 200, 500))
    .all();
  return c.json({ feedback: results.map(shapeFeedback) });
});

cards.post('/:slug/feedback', async (c) => {
  const project = await loadProject(c, 'write');
  const input = await body(c);
  if (!Array.isArray(input.items) || !input.items.length) throw invalid('items 必须是非空数组');
  if (input.items.length > 100) throw invalid('一次最多提交 100 条');
  const db = c.env.DB;
  const t = now();

  const cardIds = new Map<number, number>();
  const prepared = [];
  for (const item of input.items) {
    const source = text(item.source, 'source', 40, 1).toLowerCase();
    const raw = text(item.body, 'body', 5000, 1);
    const url = item.url ? httpUrl(item.url, 'url') : '';
    let cardId: number | null = null;
    if (item.card !== undefined && item.card !== null) {
      cardId = cardIds.get(item.card) ?? (await findCard(c, project, item.card)).id;
      cardIds.set(item.card, cardId);
    }
    // Without a platform id, fall back to the content so re-runs still deduplicate.
    const externalId = item.external_id ? text(String(item.external_id), 'external_id', 200, 1) : await sha256(url || raw);
    prepared.push(
      db
        .prepare(
          `INSERT INTO feedback (project_id, card_id, source, external_id, url, author_hash, body, rating, posted_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (project_id, source, external_id) DO NOTHING RETURNING id`,
        )
        .bind(
          project.id,
          cardId,
          source,
          externalId,
          url,
          item.author ? await sha256(`author:${project.id}:${source}:${item.author}`) : null,
          raw,
          item.rating === undefined || item.rating === null ? null : integer(item.rating, 'rating', 0, 10),
          item.posted_at === undefined || item.posted_at === null ? null : integer(item.posted_at, 'posted_at', 0, 9e15),
          t,
        ),
    );
  }
  const results = await db.batch(prepared);
  await bumpRev(c, project.id).run();
  const items = results.map((r, i) => ({ index: i, id: (r.results[0] as any)?.id ?? null, duplicate: !r.results.length }));
  const created = items.filter((i) => !i.duplicate).length;
  return c.json({ created, duplicates: items.length - created, items }, 201);
});

cards.patch('/:slug/feedback/:id', async (c) => {
  const project = await loadProject(c, 'write');
  const db = c.env.DB;
  const id = Number(c.req.param('id'));
  const current = await db.prepare('SELECT id, card_id, dismissed_at FROM feedback WHERE id = ? AND project_id = ?')
    .bind(id, project.id)
    .first<{ id: number; card_id: number | null; dismissed_at: number | null }>();
  if (!current) throw notFound('反馈');
  const input = await body(c);
  let cardId = current.card_id;
  let dismissedAt = current.dismissed_at;
  let linked: CardRow | undefined;
  if (input.card !== undefined) {
    linked = input.card === null ? undefined : await findCard(c, project, input.card);
    cardId = linked?.id ?? null;
    if (linked) dismissedAt = null;
  }
  if (input.dismissed !== undefined) dismissedAt = input.dismissed ? now() : null;
  await db.batch([
    db.prepare('UPDATE feedback SET card_id = ?, dismissed_at = ? WHERE id = ?').bind(cardId, dismissedAt, id),
    ...(linked ? [logActivity(c, project.id, linked.id, 'linked_feedback', { feedback: id, reason: input.reason })] : []),
    bumpRev(c, project.id),
  ]);
  return c.json({ ok: true, card_id: cardId, dismissed_at: dismissedAt });
});

// Source cursors let an agent resume where it left off.

cards.get('/:slug/sources', async (c) => {
  const project = await loadProject(c, 'write');
  const { results } = await c.env.DB.prepare('SELECT source, cursor, updated_at FROM sources WHERE project_id = ? ORDER BY source').bind(project.id).all();
  return c.json({ sources: results });
});

cards.put('/:slug/sources/:source', async (c) => {
  const project = await loadProject(c, 'write');
  const cursor = text((await body(c)).cursor, 'cursor', 2000);
  await c.env.DB.prepare(
    `INSERT INTO sources (project_id, source, cursor, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (project_id, source) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`,
  )
    .bind(project.id, c.req.param('source').toLowerCase(), cursor, now())
    .run();
  return c.json({ ok: true });
});
