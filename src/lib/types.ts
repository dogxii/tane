export type Category = 'backlog' | 'active' | 'done' | 'canceled';

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
  rev: number;
  open_cards?: number;
  inbox?: number;
};

export type Status = { id: number; name: string; category: Category; position: number };
export type Label = { id: number; name: string; hue: number };

export type Release = {
  id: number;
  name: string;
  body: string;
  status: 'draft' | 'published';
  published_at: number | null;
  created_at: number;
};

export type Card = {
  id: number;
  number: number;
  status_id: number;
  title: string;
  priority: number;
  position: number;
  release_id: number | null;
  version: number;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
  mentions: number;
  checklist_total: number;
  checklist_done: number;
  label_ids: number[];
  has_body: boolean;
  keywords?: string;
  is_private?: boolean;
};

export type ChecklistItem = { id: number; text: string; done: boolean; position: number };

export type Feedback = {
  id: number;
  card_id: number | null;
  card_number?: number | null;
  source: string;
  external_id: string;
  url: string;
  author_hash: string | null;
  rating: number | null;
  posted_at: number | null;
  dismissed_at: number | null;
  created_at: number;
  untrusted: { body: string };
};

export type Activity = {
  id: number;
  actor: string;
  kind: string;
  data: Record<string, any>;
  created_at: number;
};

export type CardDetail = Card & {
  body: string;
  checklist: ChecklistItem[];
  feedback?: Feedback[];
  activity?: Activity[];
};

export type BoardData = {
  project: Project;
  viewer: { editable: boolean };
  statuses: Status[];
  labels: Label[];
  releases: Release[];
  cards: Card[];
};

export type Token = {
  id: number;
  name: string;
  prefix: string;
  last_used_at: number | null;
  created_at: number;
};
