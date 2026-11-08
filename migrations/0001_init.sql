-- Tane schema. One owner, many projects.

CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  hue INTEGER NOT NULL DEFAULT 255,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  allow_submissions INTEGER NOT NULL DEFAULT 1,
  collect_enabled INTEGER NOT NULL DEFAULT 0,
  next_number INTEGER NOT NULL DEFAULT 1,
  rev INTEGER NOT NULL DEFAULT 1,
  position REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE statuses (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('backlog', 'active', 'done', 'canceled')),
  position REAL NOT NULL,
  UNIQUE (project_id, name)
);

CREATE TABLE labels (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hue INTEGER NOT NULL DEFAULT 255,
  UNIQUE (project_id, name)
);

CREATE TABLE releases (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX releases_project ON releases (project_id, created_at);

CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  status_id INTEGER NOT NULL REFERENCES statuses(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 4),
  position REAL NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  release_id INTEGER REFERENCES releases(id) ON DELETE SET NULL,
  keywords TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  merged_into INTEGER REFERENCES cards(id),
  completed_at INTEGER,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (project_id, number)
);
CREATE INDEX cards_board ON cards (project_id, status_id, position);

CREATE TABLE card_labels (
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);
CREATE INDEX card_labels_label ON card_labels (label_id);

CREATE TABLE checklist_items (
  id INTEGER PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position REAL NOT NULL
);
CREATE INDEX checklist_card ON checklist_items (card_id, position);

-- Raw signals from people: forums, reviews, the public submit form.
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  author_hash TEXT,
  body TEXT NOT NULL,
  rating INTEGER,
  posted_at INTEGER,
  dismissed_at INTEGER,
  created_at INTEGER NOT NULL,
  UNIQUE (project_id, source, external_id)
);
CREATE INDEX feedback_card ON feedback (card_id);
CREATE INDEX feedback_inbox ON feedback (project_id, card_id, dismissed_at, created_at);

CREATE TABLE activity (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
  actor TEXT NOT NULL,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX activity_card ON activity (card_id, id);

-- Where an agent left off for each source.
CREATE TABLE sources (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  cursor TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, source)
);

CREATE TABLE tokens (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
