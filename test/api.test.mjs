// Integration tests against a running dev server: `npm run dev`, then `npm test`.
// Set TANE_TEST_URL and ADMIN_PASSWORD to point elsewhere.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';

const BASE = process.env.TANE_TEST_URL ?? 'http://localhost:5173';
const PASSWORD =
  process.env.ADMIN_PASSWORD ?? readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8').match(/ADMIN_PASSWORD=(.*)/)[1].trim();
const slug = `test-${Date.now()}`;
const P = `/api/projects/${slug}`;

let cookie = '';
let token = '';
let tokenId = 0;

async function request(method, path, { auth = 'owner', body, headers = {} } = {}) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(auth === 'owner' ? { cookie } : auth === 'agent' ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 304 ? null : await response.json().catch(() => null);
  return { status: response.status, data, headers: response.headers };
}

const owner = (method, path, body) => request(method, path, { body });
const agent = (method, path, body) => request(method, path, { auth: 'agent', body });
const visitor = (method, path, body, headers) => request(method, path, { auth: 'none', body, headers });

async function newCard(fields) {
  const { status, data } = await agent('POST', `${P}/cards`, fields);
  assert.equal(status, 201, JSON.stringify(data));
  return data.card;
}

before(async () => {
  const login = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.getSetCookie()[0].split(';')[0];
  const created = await owner('POST', '/api/tokens', { name: 'test-agent' });
  token = created.data.secret;
  tokenId = created.data.token.id;
  assert.equal((await owner('POST', '/api/projects', { name: 'Test', slug })).status, 201);
});

after(async () => {
  await owner('DELETE', P, { confirm: slug });
  await owner('DELETE', `/api/tokens/${tokenId}`);
});

test('a new project is private to visitors', async () => {
  assert.equal((await visitor('GET', P)).status, 404);
  assert.equal((await visitor('POST', `${P}/submit`, { body: 'hello there' })).status, 404);
});

test('an invalid bearer token is rejected', async () => {
  const response = await request('GET', '/api/projects', { auth: 'none', headers: { authorization: 'Bearer nope' } });
  assert.equal(response.status, 401);
});

test('agent tokens cannot perform owner-only actions', async () => {
  assert.equal((await agent('PATCH', P, { visibility: 'public' })).status, 403);
  assert.equal((await agent('DELETE', P, { confirm: slug })).status, 403);
  assert.equal((await agent('GET', '/api/tokens')).status, 403);
  const { data } = await agent('POST', `${P}/releases`, { name: 'v1' });
  assert.equal((await agent('PATCH', `${P}/releases/${data.release.id}`, { status: 'published' })).status, 403);
});

test('cross-site cookie writes are refused', async () => {
  const response = await request('POST', `${P}/cards`, {
    body: { title: 'csrf' },
    headers: { origin: 'https://evil.example' },
  });
  assert.equal(response.status, 403);
});

test('cards get sequential numbers, and labels are created by name', async () => {
  const first = await newCard({ title: 'one', labels: ['bug'] });
  const second = await newCard({ title: 'two', labels: ['bug'] });
  assert.equal(second.number, first.number + 1);
  assert.deepEqual(first.label_ids, second.label_ids);
});

test('status accepts a name or a category, and done stamps completion', async () => {
  const card = await newCard({ title: 'finish me' });
  const done = await agent('PATCH', `${P}/cards/${card.number}`, { status: 'done', reason: 'shipped' });
  assert.ok(done.data.card.completed_at);
  const reopened = await agent('PATCH', `${P}/cards/${card.number}`, { status: '进行中' });
  assert.equal(reopened.data.card.completed_at, null);
  const detail = await owner('GET', `${P}/cards/${card.number}`);
  const log = detail.data.card.activity.find((a) => a.data.reason === 'shipped');
  assert.equal(log.actor, 'test-agent');
});

test('stale versions are rejected', async () => {
  const card = await newCard({ title: 'race' });
  await agent('PATCH', `${P}/cards/${card.number}`, { title: 'race 2', version: card.version });
  const stale = await agent('PATCH', `${P}/cards/${card.number}`, { title: 'race 3', version: card.version });
  assert.equal(stale.status, 409);
  assert.equal(stale.data.error.code, 'version_conflict');
});

test('after places a card exactly and survives repeated midpoint inserts', async () => {
  const a = await newCard({ title: 'a', status: '计划中' });
  const b = await newCard({ title: 'b', status: '计划中', after: a.number });
  for (let i = 0; i < 60; i++) {
    const c = await newCard({ title: `mid${i}`, status: '计划中', after: a.number });
    assert.equal(c.status_id, a.status_id);
  }
  const { data } = await agent('GET', `${P}/cards?status=${encodeURIComponent('计划中')}`);
  const titles = data.cards.map((card) => card.title);
  assert.equal(titles[0], 'a');
  assert.equal(titles[1], 'mid59');
  assert.equal(titles[titles.length - 1], 'b');
});

test('feedback is idempotent and mentions count distinct authors', async () => {
  const card = await newCard({ title: 'hard level' });
  const items = [
    { source: 'TapTap', external_id: 'r1', author: 'alice', body: '太难了', card: card.number },
    { source: 'taptap', external_id: 'r2', author: 'alice', body: '还是太难', card: card.number },
    { source: 'taptap', external_id: 'r3', author: 'bob', body: '过不去', card: card.number },
  ];
  const first = await agent('POST', `${P}/feedback`, { items });
  assert.equal(first.data.created, 3);
  const second = await agent('POST', `${P}/feedback`, { items });
  assert.equal(second.data.created, 0);
  assert.equal(second.data.duplicates, 3);
  const { data } = await agent('GET', `${P}/cards/${card.number}`);
  assert.equal(data.card.mentions, 2);
  assert.ok(data.card.feedback[0].untrusted.body);
  assert.equal(data.card.feedback[0].body, undefined);
});

test('feedback without an id still deduplicates, and bad urls are a 400', async () => {
  const item = { source: 'forum', body: 'same text' };
  assert.equal((await agent('POST', `${P}/feedback`, { items: [item] })).data.created, 1);
  assert.equal((await agent('POST', `${P}/feedback`, { items: [item] })).data.created, 0);
  const bad = await agent('POST', `${P}/feedback`, { items: [{ source: 'x', body: 'y', url: 'javascript:alert(1)' }] });
  assert.equal(bad.status, 400);
});

test('source cursors round-trip', async () => {
  await agent('PUT', `${P}/sources/taptap`, { cursor: '12345' });
  const { data } = await agent('GET', `${P}/sources`);
  assert.equal(data.sources.find((s) => s.source === 'taptap').cursor, '12345');
});

test('soft delete can be undone', async () => {
  const card = await newCard({ title: 'oops' });
  await agent('DELETE', `${P}/cards/${card.number}`);
  assert.equal((await agent('GET', `${P}/cards/${card.number}`)).status, 404);
  assert.equal((await agent('POST', `${P}/cards/${card.number}/restore`)).status, 200);
  assert.equal((await agent('GET', `${P}/cards/${card.number}`)).status, 200);
});

test('merge moves feedback and blocks restoring the duplicate', async () => {
  const keeper = await newCard({ title: 'keeper' });
  const duplicate = await newCard({ title: 'duplicate' });
  await agent('POST', `${P}/feedback`, {
    items: [{ source: 'm', external_id: '1', author: 'c', body: 'x', card: duplicate.number }],
  });
  const merged = await agent('POST', `${P}/cards/${duplicate.number}/merge`, { into: keeper.number });
  assert.equal(merged.data.card.mentions, 1);
  assert.equal((await agent('POST', `${P}/cards/${duplicate.number}/restore`)).status, 409);
});

test('a board polled with its etag returns 304 until something changes', async () => {
  const first = await owner('GET', P);
  const etag = first.headers.get('etag');
  const headers = { 'if-none-match': etag, cookie };
  assert.equal((await request('GET', P, { auth: 'none', headers })).status, 304);
  await newCard({ title: 'bump' });
  assert.equal((await request('GET', P, { auth: 'none', headers })).status, 200);
});

test('deleting a status requires a destination and moves its cards', async () => {
  const { data: created } = await agent('POST', `${P}/statuses`, { name: '临时', category: 'backlog' });
  const card = await newCard({ title: 'mover', status: '临时' });
  assert.equal((await agent('DELETE', `${P}/statuses/${created.status.id}`)).status, 400);
  const { data: board } = await owner('GET', P);
  const target = board.statuses.find((s) => s.category === 'done');
  assert.equal((await agent('DELETE', `${P}/statuses/${created.status.id}?move_to=${target.id}`)).status, 200);
  const moved = await agent('GET', `${P}/cards/${card.number}`);
  assert.equal(moved.data.card.status_id, target.id);
  assert.ok(moved.data.card.completed_at);
});

test('agent cards start private and only the owner can reveal them', async () => {
  const card = await newCard({ title: 'from agent' });
  assert.equal(card.is_private, true);
  assert.equal((await newCard({ title: 'asks to be public', is_private: false })).is_private, true);
  assert.equal((await agent('PATCH', `${P}/cards/${card.number}`, { is_private: false })).status, 403);
  const revealed = await owner('PATCH', `${P}/cards/${card.number}`, { is_private: false });
  assert.equal(revealed.data.card.is_private, false);
  assert.equal((await agent('PATCH', `${P}/cards/${card.number}`, { is_private: true })).status, 200);
});

test('agents cannot change public settings or published releases', async () => {
  assert.equal((await agent('PATCH', P, { allow_submissions: false })).status, 403);
  const { data } = await agent('POST', `${P}/releases`, { name: 'shipped' });
  await owner('PATCH', `${P}/releases/${data.release.id}`, { status: 'published' });
  assert.equal((await agent('PATCH', `${P}/releases/${data.release.id}`, { body: 'defaced' })).status, 403);
  await owner('DELETE', `${P}/releases/${data.release.id}`);
});

test('a public board exposes only what it should', async () => {
  const opened = await owner('POST', `${P}/cards`, { title: 'public card', keywords: 'secret-keyword' });
  const open = opened.data.card;
  const hidden = await newCard({ title: 'private card' });
  await agent('PATCH', `${P}/cards/${hidden.number}`, { is_private: true });
  const canceled = (await owner('POST', `${P}/cards`, { title: 'canceled card', status: 'canceled' })).data.card;
  await agent('POST', `${P}/feedback`, {
    items: [{ source: 'pub', external_id: '1', author: 'd', body: 'player private words', card: open.number }],
  });
  const draft = await agent('POST', `${P}/releases`, { name: 'hidden-draft' });
  assert.equal(draft.status, 201);

  assert.equal((await owner('PATCH', P, { visibility: 'public' })).status, 200);
  const { status, data } = await visitor('GET', P);
  assert.equal(status, 200);
  assert.equal(data.viewer.editable, false);
  const titles = data.cards.map((c) => c.title);
  assert.ok(titles.includes('public card'));
  assert.ok(!titles.includes('private card'));
  assert.ok(!titles.includes('canceled card'));
  assert.ok(!data.statuses.some((s) => s.category === 'canceled'));
  assert.ok(!data.releases.some((r) => r.name === 'hidden-draft'));

  const raw = JSON.stringify(data);
  assert.ok(!raw.includes('secret-keyword'));
  assert.ok(!raw.includes('player private words'));

  const detail = await visitor('GET', `${P}/cards/${open.number}`);
  assert.equal(detail.data.card.feedback, undefined);
  assert.equal(detail.data.card.activity, undefined);
  assert.equal((await visitor('GET', `${P}/cards/${hidden.number}`)).status, 404);
  assert.equal((await visitor('GET', `${P}/cards/${canceled.number}`)).status, 404);
  assert.equal((await visitor('GET', `${P}/cards`)).status, 401);

  assert.equal((await visitor('POST', `${P}/cards`, { title: 'nope' })).status, 401);
  assert.equal((await visitor('PATCH', `${P}/cards/${open.number}`, { title: 'nope' })).status, 401);
  assert.equal((await visitor('GET', `${P}/feedback`)).status, 401);
  assert.equal((await visitor('GET', `${P}/sources`)).status, 401);
});

test('visitor suggestions land in the inbox only', async () => {
  const text = `please add this ${Date.now()}`;
  assert.equal((await visitor('POST', `${P}/submit`, { body: text })).status, 201);
  assert.ok(!JSON.stringify((await visitor('GET', P)).data).includes(text));
  const inbox = await owner('GET', `${P}/feedback?state=inbox&source=public`);
  assert.ok(inbox.data.feedback.some((f) => f.untrusted.body === text));
});

test('the feedback page works on a private board, only while switched on', async () => {
  const page = `/api/collect/${slug}`;
  const ip = { 'cf-connecting-ip': `collect-${Date.now()}` };
  assert.equal((await owner('PATCH', P, { visibility: 'private' })).status, 200);

  assert.equal((await visitor('GET', page)).status, 404);
  assert.equal((await visitor('POST', page, { body: 'page is switched off' }, ip)).status, 404);
  assert.equal((await agent('PATCH', P, { collect_enabled: true })).status, 403);

  assert.equal((await owner('PATCH', P, { collect_enabled: true })).status, 200);
  const { status, data } = await visitor('GET', page);
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(data.project).sort(), ['board', 'hue', 'icon', 'name']);
  assert.equal(data.project.board, false);
  assert.equal((await visitor('GET', P)).status, 404);

  const text = `from the feedback page ${Date.now()}`;
  assert.equal((await visitor('POST', page, { body: 'no' }, ip)).status, 400);
  assert.equal((await visitor('POST', page, { body: text }, ip)).status, 201);
  assert.equal((await visitor('POST', page, { body: `${text} bot`, website: 'x' }, ip)).status, 201);
  const inbox = await owner('GET', `${P}/feedback?state=inbox&source=web`);
  assert.deepEqual(inbox.data.feedback.map((f) => f.untrusted.body), [text]);

  assert.equal((await owner('PATCH', P, { collect_enabled: false, visibility: 'public' })).status, 200);
  assert.equal((await visitor('GET', page)).status, 404);
});

test('a honeypot submission reports success but stores nothing', async () => {
  const text = `bot text ${Date.now()}`;
  assert.equal((await visitor('POST', `${P}/submit`, { body: text, website: 'x' })).status, 201);
  const inbox = await owner('GET', `${P}/feedback?state=inbox&source=public`);
  assert.ok(!inbox.data.feedback.some((f) => f.untrusted.body === text));
});
