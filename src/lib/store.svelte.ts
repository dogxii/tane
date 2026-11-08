import { ApiFailure, api, takePrefetch } from './api';
import { toasts } from './ui/toast.svelte';
import type { BoardData, Card, Category, Project, Status } from './types';

export type Sort = 'manual' | 'demand' | 'priority' | 'newest';
export type Filter = { q: string; labels: number[]; priorities: number[]; sort: Sort };

export type ComposePrefill = { title?: string; body?: string; status?: number; feedbackId?: number };

const POLL_MS = 8000;
// A public board can have many readers at once, and none of them is waiting on an agent's edit.
const VISITOR_POLL_MS = 300000;

const COMPARATORS: Record<Sort, (a: Card, b: Card) => number> = {
  manual: (a, b) => a.position - b.position || a.id - b.id,
  demand: (a, b) => b.mentions - a.mentions || a.position - b.position,
  priority: (a, b) => b.priority - a.priority || a.position - b.position,
  newest: (a, b) => b.created_at - a.created_at,
};

/**
 * One project's board. Writes apply locally first and go out through a serial
 * queue, so the UI never waits and requests can never overtake each other.
 */
export class ProjectStore {
  data = $state<BoardData | null>(null);
  missing = $state(false);
  filter = $state<Filter>({ q: '', labels: [], priorities: [], sort: 'manual' });
  hovered = $state<number | null>(null);
  compose = $state<ComposePrefill | null>(null);

  private etag = '';
  private pending = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private loadId = 0;
  private tempId = -1;

  constructor(public slug: string) {}

  get base() {
    return `/projects/${this.slug}`;
  }
  get project() {
    return this.data!.project;
  }
  get editable() {
    return this.data?.viewer.editable ?? false;
  }
  get statuses() {
    return this.data?.statuses ?? [];
  }
  get labels() {
    return this.data?.labels ?? [];
  }
  get releases() {
    return this.data?.releases ?? [];
  }
  get cards() {
    return this.data?.cards ?? [];
  }
  get rev() {
    return this.data?.project.rev ?? 0;
  }

  visibleCards = $derived.by(() => {
    const { q, labels, priorities, sort } = this.filter;
    const needle = q.trim().toLowerCase();
    return this.cards
      .filter((card) => {
        if (needle && !`${card.title} ${card.keywords ?? ''} #${card.number}`.toLowerCase().includes(needle)) return false;
        if (labels.length && !labels.some((id) => card.label_ids.includes(id))) return false;
        if (priorities.length && !priorities.includes(card.priority)) return false;
        return true;
      })
      .sort(COMPARATORS[sort]);
  });

  get filtering() {
    const { q, labels, priorities } = this.filter;
    return !!q.trim() || labels.length > 0 || priorities.length > 0;
  }

  private byStatus = $derived.by(() => {
    const groups = new Map<number, Card[]>();
    for (const card of this.visibleCards) {
      const group = groups.get(card.status_id);
      if (group) group.push(card);
      else groups.set(card.status_id, [card]);
    }
    return groups;
  });

  cardsIn(statusId: number): readonly Card[] {
    return this.byStatus.get(statusId) ?? [];
  }

  card(number: number) {
    return this.cards.find((card) => card.number === number);
  }

  status(id: number) {
    return this.statuses.find((status) => status.id === id);
  }

  label(id: number) {
    return this.labels.find((label) => label.id === id);
  }

  firstOf(...categories: Category[]): Status | undefined {
    for (const category of categories) {
      const found = this.statuses.find((status) => status.category === category);
      if (found) return found;
    }
    return undefined;
  }

  // Sync

  start() {
    void this.load();
    let last = Date.now();
    const refresh = () => {
      if (!this.editable && Date.now() - last < VISITOR_POLL_MS) return;
      last = Date.now();
      void this.load();
    };
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
    };
  }

  async load() {
    if (this.pending) return;
    const id = ++this.loadId;
    try {
      const next = await (takePrefetch<BoardData>(this.base) ??
        api.get<BoardData | null>(this.base, this.etag ? { 'if-none-match': this.etag } : undefined));
      // A write that started mid-flight makes this snapshot stale; the queue reloads after it.
      if (id !== this.loadId || this.pending || !next) return;
      this.data = next;
      this.etag = `W/"${next.project.rev}-${next.viewer.editable ? 'e' : 'v'}"`;
      this.missing = false;
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 404) this.missing = true;
    }
  }

  /** Applies a change now, sends it in order, and rolls back by refetching on failure. */
  mutate<T>(optimistic: (() => void) | null, send: () => Promise<T>): Promise<T | undefined> {
    optimistic?.();
    this.pending++;
    this.loadId++;
    const result = this.queue.then(send).then(
      (value) => value,
      (error) => {
        toasts.error(error instanceof ApiFailure ? error.message : '操作失败');
        this.etag = '';
        return undefined;
      },
    );
    this.queue = result.finally(() => {
      this.pending--;
      if (!this.pending) void this.load();
    });
    return result;
  }

  // Cards

  updateCard(card: Card, payload: Record<string, unknown>, local: Partial<Card> = {}) {
    return this.mutate(
      () => Object.assign(card, local),
      () => api.patch(`${this.base}/cards/${card.number}`, payload),
    );
  }

  private topOf(statusId: number) {
    return Math.min(0, ...this.cards.filter((c) => c.status_id === statusId).map((c) => c.position)) - 1024;
  }

  setStatus(card: Card, statusId: number) {
    const status = this.status(statusId);
    if (!status || status.id === card.status_id) return;
    return this.updateCard(card, { status: statusId }, {
      status_id: statusId,
      position: this.topOf(statusId),
      completed_at: status.category === 'done' ? Date.now() : null,
    });
  }

  toggleDone(card: Card) {
    const current = this.status(card.status_id);
    const target = current?.category === 'done' ? this.firstOf('active', 'backlog') : this.firstOf('done');
    if (target) return this.setStatus(card, target.id);
  }

  /** Drops a card after `after` (a card number, or null for the top of the column). */
  moveCard(card: Card, statusId: number, after: number | null | undefined) {
    const status = this.status(statusId);
    if (!status) return;
    const siblings = this.cards
      .filter((c) => c.status_id === statusId && c.id !== card.id)
      .sort(COMPARATORS.manual);
    const payload: Record<string, unknown> = { status: statusId };
    const local: Partial<Card> = {
      status_id: statusId,
      completed_at: status.category === 'done' ? (card.completed_at ?? Date.now()) : null,
    };
    if (after !== undefined) {
      payload.after = after;
      const index = after === null ? 0 : siblings.findIndex((c) => c.number === after) + 1;
      const prev = siblings[index - 1]?.position;
      const next = siblings[index]?.position;
      local.position =
        prev === undefined && next === undefined
          ? 1024
          : prev === undefined
            ? next! - 1024
            : next === undefined
              ? prev + 1024
              : (prev + next) / 2;
    } else if (statusId !== card.status_id) {
      local.position = this.topOf(statusId);
    }
    return this.updateCard(card, payload, local);
  }

  createCard(input: { title: string; status?: number; priority?: number; labels?: number[]; body?: string }) {
    const statusId = input.status ?? this.firstOf('backlog', 'active')!.id;
    const now = Date.now();
    const id = this.tempId--;
    const temp: Card = {
      id,
      number: 0,
      status_id: statusId,
      title: input.title,
      priority: input.priority ?? 0,
      position: this.topOf(statusId),
      release_id: null,
      version: 1,
      completed_at: null,
      created_at: now,
      updated_at: now,
      mentions: 0,
      checklist_total: 0,
      checklist_done: 0,
      label_ids: input.labels ?? [],
      has_body: !!input.body,
      keywords: '',
      is_private: false,
    };
    return this.mutate(
      () => this.data!.cards.push(temp),
      async () => {
        const { card } = await api.post<{ card: Card }>(`${this.base}/cards`, { ...input, status: statusId });
        const entry = this.data!.cards.find((c) => c.id === id);
        if (entry) Object.assign(entry, card);
        return card;
      },
    ).then((card) => {
      if (!card) this.data!.cards = this.data!.cards.filter((c) => c.id !== id);
      return card;
    });
  }

  deleteCard(card: Card) {
    const number = card.number;
    this.mutate(
      () => (this.data!.cards = this.data!.cards.filter((c) => c.id !== card.id)),
      () => api.del(`${this.base}/cards/${number}`),
    );
    toasts.show(`已删除 ${this.project.key}-${number}`, {
      action: {
        label: '撤销',
        run: () => this.mutate(null, () => api.post(`${this.base}/cards/${number}/restore`)),
      },
    });
  }

  // Labels, statuses, project

  createLabel(name: string) {
    return this.mutate(null, async () => {
      const { label } = await api.post<{ label: BoardData['labels'][number] }>(`${this.base}/labels`, { name });
      if (!this.data!.labels.some((l) => l.id === label.id)) this.data!.labels.push(label);
      return label;
    });
  }

  send<T>(method: 'post' | 'patch' | 'del', path: string, payload?: unknown) {
    return this.mutate(null, () => (api[method] as any)(`${this.base}${path}`, payload) as Promise<T>);
  }

  updateProject(payload: Partial<Project>) {
    return this.mutate(
      () => Object.assign(this.data!.project, payload),
      () => api.patch(this.base, payload),
    );
  }
}
