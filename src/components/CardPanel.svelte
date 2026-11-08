<script lang="ts">
  import { tick } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import Link from '@lucide/svelte/icons/link';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import Merge from '@lucide/svelte/icons/merge';
  import Plus from '@lucide/svelte/icons/plus';
  import Bot from '@lucide/svelte/icons/bot';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Unlink from '@lucide/svelte/icons/unlink';
  import Tag from '@lucide/svelte/icons/tag';
  import Rocket from '@lucide/svelte/icons/rocket';
  import { api } from '../lib/api';
  import { renderMarkdown } from '../lib/markdown';
  import { PRIORITIES, relativeTime } from '../lib/format';
  import { Button, Checkbox, Chip, Dialog, Picker, Skeleton, Switch, Textarea, tip, toasts } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Activity, CardDetail, ChecklistItem } from '../lib/types';
  import StatusIcon from './StatusIcon.svelte';
  import StatusPicker from './StatusPicker.svelte';
  import PriorityIcon from './PriorityIcon.svelte';
  import PriorityPicker from './PriorityPicker.svelte';
  import LabelPicker from './LabelPicker.svelte';

  let { store, number, onclose }: { store: ProjectStore; number: number; onclose: () => void } = $props();

  const card = $derived(store.card(number));
  const status = $derived(card ? store.status(card.status_id) : undefined);
  const editable = $derived(store.editable);
  const path = $derived(`${store.base}/cards/${number}`);

  let detail = $state<CardDetail | null>(null);
  let title = $state('');
  let titleFocused = $state(false);
  let editingBody = $state(false);
  let bodyDraft = $state('');
  let bodyEl = $state<HTMLTextAreaElement>();
  let newItem = $state('');
  let comment = $state('');
  let mergeTarget = $state<number | null>(null);

  $effect(() => {
    void store.rev;
    const requested = number;
    api
      .get<{ card: CardDetail }>(path)
      .then((response) => {
        if (requested === number) detail = response.card;
      })
      .catch(() => {
        toasts.error('卡片不存在或已被删除');
        onclose();
      });
  });

  $effect(() => {
    if (card && !titleFocused) title = card.title;
  });

  function saveTitle() {
    titleFocused = false;
    const next = title.trim();
    if (!card || !next || next === card.title) {
      if (card) title = card.title;
      return;
    }
    store.updateCard(card, { title: next }, { title: next });
  }

  async function startEditingBody() {
    if (!editable || !detail) return;
    bodyDraft = detail.body;
    editingBody = true;
    await tick();
    bodyEl?.focus();
  }

  function saveBody() {
    editingBody = false;
    if (!card || !detail || bodyDraft.trim() === detail.body) return;
    const body = bodyDraft.trim();
    detail.body = body;
    store.updateCard(card, { body }, { has_body: !!body });
  }

  // Checklist

  function addItem() {
    const text = newItem.trim();
    if (!text || !detail || !card) return;
    newItem = '';
    const temp: ChecklistItem = { id: -Date.now(), text, done: false, position: Number.MAX_SAFE_INTEGER };
    const target = detail;
    target.checklist.push(temp);
    card.checklist_total++;
    store.mutate(null, async () => {
      const { item } = await api.post<{ item: ChecklistItem }>(`${path}/checklist`, { text });
      const entry = target.checklist.find((i) => i.id === temp.id);
      if (entry) Object.assign(entry, item);
    });
  }

  function toggleItem(item: ChecklistItem, done: boolean) {
    if (!card) return;
    item.done = done;
    card.checklist_done += done ? 1 : -1;
    store.send('patch', `/cards/${number}/checklist/${item.id}`, { done });
  }

  function removeItem(item: ChecklistItem) {
    if (!detail || !card) return;
    detail.checklist = detail.checklist.filter((i) => i.id !== item.id);
    card.checklist_total--;
    if (item.done) card.checklist_done--;
    store.send('del', `/cards/${number}/checklist/${item.id}`);
  }

  function renameItem(item: ChecklistItem, text: string) {
    const next = text.trim();
    if (!next || next === item.text) return;
    item.text = next;
    store.send('patch', `/cards/${number}/checklist/${item.id}`, { text: next });
  }

  // Feedback, comments, merging

  function unlinkFeedback(id: number) {
    if (!detail || !card) return;
    detail.feedback = detail.feedback?.filter((f) => f.id !== id);
    store.send('patch', `/feedback/${id}`, { card: null });
  }

  function addComment() {
    const text = comment.trim();
    if (!text) return;
    comment = '';
    store.send('post', `/cards/${number}/comments`, { text });
  }

  function confirmMerge() {
    if (mergeTarget === null) return;
    const into = mergeTarget;
    mergeTarget = null;
    store.send('post', `/cards/${number}/merge`, { into });
    store.data!.cards = store.data!.cards.filter((c) => c.number !== number);
    toasts.show(`已合并到 ${store.project.key}-${into}`);
    onclose();
  }

  function copyLink() {
    navigator.clipboard?.writeText(location.href);
    toasts.show('链接已复制');
  }

  const mergeItems = $derived(
    store.cards
      .filter((c) => c.number !== number && c.id > 0)
      .map((c) => ({ value: c.number, label: c.title, hint: `#${c.number}` })),
  );
  const releaseItems = $derived([
    { value: null, label: '不属于任何版本' },
    ...store.releases.map((r) => ({ value: r.id, label: r.name, hint: r.status === 'draft' ? '草稿' : '' })),
  ]);
  const releaseName = $derived(store.releases.find((r) => r.id === card?.release_id)?.name);
  const priorityLabel = $derived(PRIORITIES.find((p) => p.value === card?.priority)?.label);

  const FIELD_NAMES: Record<string, string> = {
    title: '标题',
    body: '描述',
    priority: '优先级',
    is_private: '公开状态',
    release_id: '所属版本',
    labels: '标签',
  };

  function describe(entry: Activity) {
    switch (entry.kind) {
      case 'created':
        return '创建了卡片';
      case 'deleted':
        return '删除了卡片';
      case 'restored':
        return '恢复了卡片';
      case 'merged':
        return `合并了 #${entry.data.from}「${entry.data.title}」`;
      case 'linked_feedback':
        return '关联了一条反馈';
      case 'updated': {
        const changes = entry.data.changes ?? {};
        if (changes.status) return `将状态改为「${changes.status[1]}」`;
        const names = Object.keys(changes).map((key) => FIELD_NAMES[key] ?? key);
        return names.length ? `修改了${names.join('、')}` : '更新了卡片';
      }
      default:
        return entry.kind;
    }
  }
</script>

{#if card}
  <div class="bar">
    <span class="id tabular">{store.project.key}-{card.number}</span>
    <span class="spacer"></span>
    <Button variant="ghost" size="sm" icon={Link} tip="复制链接" aria-label="复制链接" onclick={copyLink} />
    {#if editable}
      <Picker items={mergeItems} searchable placeholder="合并到哪张卡片…" width={300} placement="bottom-end" onselect={(target) => (mergeTarget = target)}>
        {#snippet trigger(props)}
          <Button variant="ghost" size="sm" icon={Merge} tip="合并重复项" aria-label="合并重复项" {...props} />
        {/snippet}
      </Picker>
      <Button
        variant="ghost"
        size="sm"
        icon={Trash2}
        tip="删除"
        aria-label="删除"
        onclick={() => {
          store.deleteCard(card!);
          onclose();
        }}
      />
    {/if}
    <Button variant="ghost" size="sm" icon={X} tip="关闭 Esc" aria-label="关闭" onclick={onclose} />
  </div>

  <div class="scroll">
    {#if editable}
      <Textarea
        bare
        class="title-input"
        bind:value={title}
        aria-label="标题"
        onfocus={() => (titleFocused = true)}
        onblur={saveTitle}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
      />
    {:else}
      <h2 class="public-title">{card.title}</h2>
    {/if}

    <div class="properties">
      {#if editable}
        <StatusPicker statuses={store.statuses} value={card.status_id} onselect={(id) => store.setStatus(card!, id)}>
          {#snippet trigger(props)}
            <Button size="sm" {...props}>
              {#if status}<StatusIcon category={status.category} />{status.name}{/if}
            </Button>
          {/snippet}
        </StatusPicker>
        <PriorityPicker value={card.priority} onselect={(priority) => store.updateCard(card!, { priority }, { priority })}>
          {#snippet trigger(props)}
            <Button size="sm" {...props}><PriorityIcon priority={card!.priority} />{priorityLabel}</Button>
          {/snippet}
        </PriorityPicker>
        <LabelPicker {store} value={card.label_ids} onchange={(labels) => store.updateCard(card!, { labels }, { label_ids: labels })}>
          {#snippet trigger(props)}
            <Button size="sm" icon={card!.label_ids.length ? undefined : Tag} {...props}>
              {#if card!.label_ids.length}
                {#each card!.label_ids.slice(0, 4) as id (id)}
                  {@const label = store.label(id)}
                  {#if label}<Chip label={label.name} hue={label.hue} />{/if}
                {/each}
              {:else}标签{/if}
            </Button>
          {/snippet}
        </LabelPicker>
        <Picker items={releaseItems} value={card.release_id} onselect={(release_id) => store.updateCard(card!, { release_id }, { release_id })}>
          {#snippet trigger(props)}
            <Button size="sm" icon={Rocket} {...props}>{releaseName ?? '版本'}</Button>
          {/snippet}
        </Picker>
        <label class="private" use:tip={'开启后，这张卡片不会出现在公开看板'}>
          <Switch checked={card.is_private} label="仅自己可见" onchange={(is_private) => store.updateCard(card!, { is_private }, { is_private })} />
          仅自己可见
        </label>
      {:else}
        {#if status}<span class="static"><StatusIcon category={status.category} />{status.name}</span>{/if}
        {#each card.label_ids as id (id)}
          {@const label = store.label(id)}
          {#if label}<Chip label={label.name} hue={label.hue} />{/if}
        {/each}
      {/if}
    </div>

    {#if !detail}
      <div class="loading"><Skeleton width="72%" /><Skeleton width="92%" /><Skeleton width="48%" /></div>
    {:else}
      <section>
        {#if editingBody}
          <Textarea
            bind:el={bodyEl}
            bind:value={bodyDraft}
            rows={5}
            placeholder="支持 Markdown"
            onblur={saveBody}
            onkeydown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') {
                event.stopPropagation();
                bodyDraft = detail!.body;
                event.currentTarget.blur();
              }
            }}
          />
        {:else if detail.body}
          <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
          <div
            class="prose"
            class:clickable={editable}
            onclick={(event) => {
              if (!(event.target as Element).closest('a')) startEditingBody();
            }}
          >
            {@html renderMarkdown(detail.body)}
          </div>
        {:else if editable}
          <button class="add-body" onclick={startEditingBody}>添加描述…</button>
        {/if}
      </section>

      {#if detail.checklist.length || editable}
        <section>
          <h4>
            清单
            {#if detail.checklist.length}
              <span class="tabular">{detail.checklist.filter((i) => i.done).length}/{detail.checklist.length}</span>
            {/if}
          </h4>
          <ul class="checklist">
            {#each detail.checklist as item (item.id)}
              <li class:done={item.done}>
                <Checkbox checked={item.done} disabled={!editable} label={item.text} onchange={(done) => toggleItem(item, done)} />
                {#if editable}
                  <input
                    value={item.text}
                    aria-label="清单项"
                    onblur={(event) => renameItem(item, event.currentTarget.value)}
                    onkeydown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                  />
                  <button class="remove" aria-label="删除清单项" onclick={() => removeItem(item)}><X size={12} strokeWidth={2.2} /></button>
                {:else}
                  <span>{item.text}</span>
                {/if}
              </li>
            {/each}
            {#if editable}
              <li class="new">
                <Plus size={14} strokeWidth={2} />
                <input
                  bind:value={newItem}
                  placeholder="添加清单项，回车确认"
                  aria-label="添加清单项"
                  onkeydown={(event) => {
                    if (event.key === 'Enter' && !event.isComposing) addItem();
                  }}
                />
              </li>
            {/if}
          </ul>
        </section>
      {/if}

      {#if detail.feedback?.length}
        <section>
          <h4>用户反馈 <span class="tabular">{card.mentions} 人提到</span></h4>
          <div class="feedback">
            {#each detail.feedback as item (item.id)}
              <article>
                <header>
                  <Chip label={item.source} />
                  {#if item.rating !== null}<span class="meta tabular">★ {item.rating}</span>{/if}
                  <span class="meta">{relativeTime(item.posted_at ?? item.created_at)}</span>
                  <span class="spacer"></span>
                  {#if item.url}
                    <a class="icon-link" href={item.url} target="_blank" rel="noopener noreferrer nofollow" aria-label="查看原文"><ExternalLink size={12} strokeWidth={2} /></a>
                  {/if}
                  <button class="icon-link" aria-label="解除关联" use:tip={'解除关联'} onclick={() => unlinkFeedback(item.id)}><Unlink size={12} strokeWidth={2} /></button>
                </header>
                <p>{item.untrusted.body}</p>
              </article>
            {/each}
          </div>
        </section>
      {/if}

      {#if editable}
        <section>
          <h4>动态</h4>
          <div class="comment-box">
            <Textarea
              bind:value={comment}
              placeholder="写一条评论，⌘↵ 发送"
              aria-label="评论"
              onkeydown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') addComment();
              }}
            />
            {#if comment.trim()}<Button size="sm" variant="primary" onclick={addComment}>发送</Button>{/if}
          </div>
          <ol class="activity">
            {#each detail.activity ?? [] as entry (entry.id)}
              <li>
                {#if entry.actor === 'owner'}
                  <span class="who">你</span>
                {:else}
                  <span class="who agent"><Bot size={12} strokeWidth={2} />{entry.actor}</span>
                {/if}
                {#if entry.kind === 'comment'}
                  <span class="meta">{relativeTime(entry.created_at)}</span>
                  <p class="comment">{entry.data.text}</p>
                {:else}
                  <span class="what">{describe(entry)}</span>
                  <span class="meta">{relativeTime(entry.created_at)}</span>
                  {#if entry.data.reason}<p class="reason">{entry.data.reason}</p>{/if}
                {/if}
              </li>
            {/each}
          </ol>
        </section>
      {/if}
    {/if}
  </div>

  <Dialog
    bind:open={() => mergeTarget !== null, (value) => { if (!value) mergeTarget = null; }}
    title="合并重复卡片？"
    description="这张卡片的用户反馈都会转移到目标卡片，合并后无法撤销。"
  >
    <p class="merge-target">{store.project.key}-{mergeTarget} · {mergeTarget ? store.card(mergeTarget)?.title : ''}</p>
    {#snippet footer()}
      <Button onclick={() => (mergeTarget = null)}>取消</Button>
      <Button variant="primary" onclick={confirmMerge}>确认合并</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: none;
    height: 44px;
    padding: 0 10px 0 22px;
    border-bottom: 1px solid var(--border);
  }
  .id {
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
  .spacer {
    flex: 1;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    padding: 18px 22px 40px;
    overflow-y: auto;
  }
  .scroll :global(.title-input) {
    font-size: var(--fs-xl);
    font-weight: 600;
    line-height: 1.35;
  }
  .public-title {
    font-size: var(--fs-xl);
    font-weight: 600;
    line-height: 1.35;
  }
  .properties {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
  }
  .static {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: var(--fs-sm);
    color: var(--text-2);
  }
  .private {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: 4px;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }
  .loading {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 24px;
  }
  section {
    margin-top: 24px;
  }
  h4 {
    display: flex;
    align-items: baseline;
    gap: 7px;
    margin-bottom: 8px;
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  h4 span {
    color: var(--text-3);
    font-weight: 400;
    font-size: var(--fs-xs);
  }
  .clickable {
    cursor: text;
  }
  .add-body {
    color: var(--text-3);
    font-size: var(--fs-md);
  }
  .add-body:hover {
    color: var(--text-2);
  }
  .checklist {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .checklist li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
  }
  .checklist input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    font-size: var(--fs-md);
  }
  .checklist input:focus-visible {
    outline: none;
  }
  .checklist .done input,
  .checklist .done span {
    color: var(--text-3);
    text-decoration: line-through;
  }
  .new {
    color: var(--text-3);
    padding-left: 1px;
  }
  .remove {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--r-sm);
    color: var(--text-3);
    opacity: 0;
  }
  li:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  .remove:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  @media (hover: none) {
    .remove {
      opacity: 1;
    }
  }
  .feedback {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  article {
    padding: 9px 11px;
    border-radius: var(--r-md);
    background: var(--bg-sunken);
  }
  article header {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 4px;
  }
  article p {
    font-size: var(--fs-sm);
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .meta {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .icon-link {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--r-sm);
    color: var(--text-3);
  }
  .icon-link:hover {
    background: var(--surface-active);
    color: var(--text);
  }
  .comment-box {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .activity {
    list-style: none;
    margin: 14px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: var(--fs-sm);
  }
  .activity li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .who {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 500;
  }
  .who.agent {
    color: var(--accent-text);
  }
  .what {
    color: var(--text-2);
  }
  .comment,
  .reason {
    flex-basis: 100%;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .comment {
    padding: 7px 10px;
    border-radius: var(--r-md);
    background: var(--bg-sunken);
  }
  .reason {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .merge-target {
    font-size: var(--fs-md);
    font-weight: 500;
  }
</style>
