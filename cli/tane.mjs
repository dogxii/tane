#!/usr/bin/env node
// Tane CLI: a thin, dependency-free wrapper over the REST API.
// Every command prints JSON to stdout, and errors print JSON to stderr with exit code 1.

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const CONFIG_PATH = process.env.TANE_CONFIG ?? join(homedir(), '.config', 'tane', 'config.json');
const FEEDBACK_BATCH = 100;

const HELP = `tane - operate a Tane from the command line

Setup
  tane login <url> <token>           Save the server and agent token
  tane use <slug>                    Set the default project
  tane projects                      List projects

Reading
  tane board                         Statuses, labels and releases of the project
  tane cards [--status S] [--label L] [--q TEXT] [--compact] [--limit N]
  tane card <number>                 One card with checklist, feedback and activity
  tane feedback [--state inbox|linked|dismissed|all] [--source S] [--q TEXT]
  tane cursor <source>               Where collection last stopped

Writing
  tane add <title> [--body B] [--status S] [--priority 0-4] [--label L]... [--keywords K] [--reason R]
  tane update <number> [--title T] [--body B] [--status S] [--priority 0-4]
              [--add-label L]... [--remove-label L]... [--keywords K] [--private true|false]
              [--if-version N] [--reason R]
  tane done <number> [--reason R]    Move to the first completed status
  tane move <number> <status> [--after NUMBER|top]
  tane comment <number> <text>
  tane merge <number> --into <number> [--reason R]
  tane delete <number>               Soft delete, undo with tane restore
  tane restore <number>
  tane check add <number> <text>
  tane check done <number> <item-id>
  tane check undone <number> <item-id>
  tane feedback add --file batch.json   Use --file - for stdin. Duplicates are skipped.
  tane feedback link <id> <card-number> [--reason R]
  tane feedback dismiss <id>
  tane cursor set <source> <value>

Global options
  --project <slug>                 Override the default project

Priority: 0 none, 1 low, 2 medium, 3 high, 4 urgent.
--status accepts a status name, or a category: backlog, active, done, canceled.
Environment: TANE_URL, TANE_TOKEN, TANE_PROJECT override the saved config.
`;

function fail(message, extra = {}) {
  process.stderr.write(`${JSON.stringify({ error: { message, ...extra } }, null, 2)}\n`);
  process.exit(1);
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function loadConfig() {
  const saved = existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) : {};
  return {
    ...saved,
    url: process.env.TANE_URL ?? saved.url,
    token: process.env.TANE_TOKEN ?? saved.token,
    project: process.env.TANE_PROJECT ?? saved.project,
  };
}

function saveConfig(next) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  chmodSync(CONFIG_PATH, 0o600);
}

const { values: flags, positionals } = (() => {
  try {
    return parseArgs({
      allowPositionals: true,
      options: {
        project: { type: 'string' },
        status: { type: 'string' },
        label: { type: 'string', multiple: true },
        q: { type: 'string' },
        compact: { type: 'boolean' },
        limit: { type: 'string' },
        state: { type: 'string' },
        source: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
        priority: { type: 'string' },
        keywords: { type: 'string' },
        reason: { type: 'string' },
        'add-label': { type: 'string', multiple: true },
        'remove-label': { type: 'string', multiple: true },
        private: { type: 'string' },
        'if-version': { type: 'string' },
        after: { type: 'string' },
        into: { type: 'string' },
        file: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    fail(error.message);
  }
})();

const config = loadConfig();

async function call(method, path, payload) {
  if (!config.url || !config.token) fail('Not logged in. Run: tane login <url> <token>');
  let response;
  try {
    response = await fetch(`${config.url.replace(/\/$/, '')}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${config.token}`,
        ...(payload !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
  } catch (error) {
    fail(`Cannot reach ${config.url}: ${error.message}`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) fail(data?.error?.message ?? `HTTP ${response.status}`, { status: response.status, ...data?.error });
  return data;
}

const project = () => {
  const slug = flags.project ?? config.project;
  if (!slug) fail('No project selected. Run: tane use <slug>, or pass --project <slug>');
  return `/projects/${encodeURIComponent(slug)}`;
};

function number(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) fail(`${name} must be an integer, got: ${value}`);
  return parsed;
}

function require_(value, usage) {
  if (value === undefined) fail(`Usage: ${usage}`);
  return value;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== false) search.set(key, String(value));
  const text = search.toString();
  return text ? `?${text}` : '';
}

const withReason = (payload) => (flags.reason ? { ...payload, reason: flags.reason } : payload);

function readBatch() {
  const file = require_(flags.file, 'tane feedback add --file batch.json');
  const raw = readFileSync(file === '-' ? 0 : file, 'utf8');
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items)) fail('The file must contain an array, or an object with an "items" array');
  return items;
}

async function addFeedback() {
  const items = readBatch();
  const totals = { created: 0, duplicates: 0, items: [] };
  for (let i = 0; i < items.length; i += FEEDBACK_BATCH) {
    const result = await call('POST', `${project()}/feedback`, { items: items.slice(i, i + FEEDBACK_BATCH) });
    totals.created += result.created;
    totals.duplicates += result.duplicates;
    totals.items.push(...result.items.map((item) => ({ ...item, index: item.index + i })));
  }
  return totals;
}

const commands = {
  async login([url, token]) {
    require_(token, 'tane login <url> <token>');
    saveConfig({ ...config, url, token });
    config.url = url;
    config.token = token;
    return { ok: true, config: CONFIG_PATH, projects: (await call('GET', '/projects')).projects.map((p) => p.slug) };
  },
  async use([slug]) {
    require_(slug, 'tane use <slug>');
    await call('GET', `/projects/${encodeURIComponent(slug)}`);
    saveConfig({ ...config, project: slug });
    return { ok: true, project: slug };
  },
  projects: () => call('GET', '/projects'),
  async board() {
    const { project: info, statuses, labels, releases } = await call('GET', project());
    return { project: info, statuses, labels, releases };
  },
  cards: () =>
    call(
      'GET',
      `${project()}/cards${query({ status: flags.status, label: flags.label?.[0], q: flags.q, compact: flags.compact ? 1 : undefined, limit: flags.limit })}`,
    ),
  card: ([n]) => call('GET', `${project()}/cards/${number(require_(n, 'tane card <number>'), 'number')}`),
  add([title]) {
    require_(title, 'tane add <title>');
    return call(
      'POST',
      `${project()}/cards`,
      withReason({
        title,
        body: flags.body,
        status: flags.status,
        priority: flags.priority === undefined ? undefined : number(flags.priority, 'priority'),
        labels: flags.label,
        keywords: flags.keywords,
      }),
    );
  },
  update([n]) {
    const payload = withReason({
      title: flags.title,
      body: flags.body,
      status: flags.status,
      priority: flags.priority === undefined ? undefined : number(flags.priority, 'priority'),
      add_labels: flags['add-label'],
      remove_labels: flags['remove-label'],
      keywords: flags.keywords,
      is_private: flags.private === undefined ? undefined : flags.private === 'true',
      version: flags['if-version'] === undefined ? undefined : number(flags['if-version'], 'if-version'),
    });
    return call('PATCH', `${project()}/cards/${number(require_(n, 'tane update <number> ...'), 'number')}`, payload);
  },
  done: ([n]) =>
    call('PATCH', `${project()}/cards/${number(require_(n, 'tane done <number>'), 'number')}`, withReason({ status: 'done' })),
  move([n, status]) {
    require_(status, 'tane move <number> <status> [--after NUMBER|top]');
    const after = flags.after === undefined ? undefined : flags.after === 'top' ? null : number(flags.after, 'after');
    return call('PATCH', `${project()}/cards/${number(n, 'number')}`, withReason({ status, after }));
  },
  comment([n, text]) {
    require_(text, 'tane comment <number> <text>');
    return call('POST', `${project()}/cards/${number(n, 'number')}/comments`, { text });
  },
  merge([n]) {
    const into = number(require_(flags.into, 'tane merge <number> --into <number>'), 'into');
    return call('POST', `${project()}/cards/${number(n, 'number')}/merge`, withReason({ into }));
  },
  delete: ([n]) => call('DELETE', `${project()}/cards/${number(require_(n, 'tane delete <number>'), 'number')}`),
  restore: ([n]) => call('POST', `${project()}/cards/${number(require_(n, 'tane restore <number>'), 'number')}/restore`),
  check([action, n, arg]) {
    require_(arg, 'tane check add <number> <text> | tane check done|undone <number> <item-id>');
    const base = `${project()}/cards/${number(n, 'number')}/checklist`;
    if (action === 'add') return call('POST', base, { text: arg });
    if (action === 'done' || action === 'undone') {
      return call('PATCH', `${base}/${number(arg, 'item-id')}`, { done: action === 'done' });
    }
    fail(`Unknown check action: ${action}`);
  },
  feedback([action, id, card]) {
    if (!action) {
      return call('GET', `${project()}/feedback${query({ state: flags.state, source: flags.source, q: flags.q, limit: flags.limit })}`);
    }
    if (action === 'add') return addFeedback();
    if (action === 'link') {
      require_(card, 'tane feedback link <id> <card-number>');
      return call('PATCH', `${project()}/feedback/${number(id, 'id')}`, withReason({ card: number(card, 'card-number') }));
    }
    if (action === 'dismiss') {
      return call('PATCH', `${project()}/feedback/${number(require_(id, 'tane feedback dismiss <id>'), 'id')}`, { dismissed: true });
    }
    fail(`Unknown feedback action: ${action}`);
  },
  async cursor([first, source, value]) {
    if (first === 'set') {
      require_(value, 'tane cursor set <source> <value>');
      return call('PUT', `${project()}/sources/${encodeURIComponent(source)}`, { cursor: value });
    }
    require_(first, 'tane cursor <source>');
    const { sources } = await call('GET', `${project()}/sources`);
    return sources.find((s) => s.source === first.toLowerCase()) ?? { source: first, cursor: '', updated_at: null };
  },
};

const [command, ...args] = positionals;

if (!command || flags.help) {
  process.stdout.write(HELP);
} else if (!Object.hasOwn(commands, command)) {
  fail(`Unknown command: ${command}. Run tane --help`);
} else {
  print(await commands[command](args));
}
