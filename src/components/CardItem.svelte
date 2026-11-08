<script lang="ts">
  import Lock from '@lucide/svelte/icons/lock';
  import ListChecks from '@lucide/svelte/icons/list-checks';
  import MessageSquareText from '@lucide/svelte/icons/message-square-text';
  import AlignLeft from '@lucide/svelte/icons/align-left';
  import { Chip, tip } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Card } from '../lib/types';
  import StatusIcon from './StatusIcon.svelte';
  import PriorityIcon from './PriorityIcon.svelte';

  let {
    store,
    card,
    onopen,
    onpointerdown,
    floating = false,
  }: {
    store: ProjectStore;
    card: Card;
    onopen?: (card: Card) => void;
    onpointerdown?: (event: PointerEvent) => void;
    floating?: boolean;
  } = $props();

  const status = $derived(store.status(card.status_id));
  const labels = $derived(card.label_ids.map((id) => store.label(id)).filter((l) => !!l));
  const done = $derived(status?.category === 'done' || status?.category === 'canceled');
  const showFooter = $derived(
    labels.length > 0 ||
      card.checklist_total > 0 ||
      card.mentions > 0 ||
      card.has_body,
  );
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="card"
  class:floating
  class:temp={card.id < 0}
  data-card={card.number}
  role="button"
  tabindex="0"
  {onpointerdown}
  onpointerenter={() => (store.hovered = card.number)}
  onpointerleave={() => {
    if (store.hovered === card.number) store.hovered = null;
  }}
  onclick={() => card.id > 0 && onopen?.(card)}
  onkeydown={(event) => {
    if (event.key === 'Enter' && event.target === event.currentTarget && card.id > 0) onopen?.(card);
  }}
>
  <div class="top">
    {#if store.editable && status}
      <button
        class="tick"
        use:tip={done ? '标记为未完成' : '标记为完成'}
        aria-label={done ? '标记为未完成' : '标记为完成'}
        onclick={(event) => {
          event.stopPropagation();
          store.toggleDone(card);
        }}
      >
        <StatusIcon category={status.category} />
      </button>
    {:else if status}
      <span class="tick static"><StatusIcon category={status.category} /></span>
    {/if}
    <span class="id tabular">{store.project.key}-{card.number || '…'}</span>
    {#if card.is_private && store.project.visibility === 'public'}<span class="muted" use:tip={'不在公开看板显示'}><Lock size={11} strokeWidth={2} /></span>{/if}
    <span class="spacer"></span>
    {#if card.priority > 0}<PriorityIcon priority={card.priority} />{/if}
  </div>

  <p class="title" class:done>{card.title}</p>

  {#if showFooter}
    <div class="footer">
      {#each labels.slice(0, 3) as label (label.id)}<Chip label={label.name} hue={label.hue} />{/each}
      {#if labels.length > 3}<span class="meta">+{labels.length - 3}</span>{/if}
      <span class="spacer"></span>
      {#if card.has_body}<span class="meta"><AlignLeft size={12} strokeWidth={2} /></span>{/if}
      {#if card.checklist_total > 0}
        <span class="meta tabular" class:complete={card.checklist_done === card.checklist_total}>
          <ListChecks size={12} strokeWidth={2} />{card.checklist_done}/{card.checklist_total}
        </span>
      {/if}
      {#if card.mentions > 0}
        <span class="meta tabular" use:tip={`${card.mentions} 人提到`}>
          <MessageSquareText size={12} strokeWidth={2} />{card.mentions}
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 9px 11px 10px;
    border-radius: var(--r-lg);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    cursor: pointer;
    user-select: none;
    -webkit-touch-callout: none;
    transition: border-color var(--fast);
  }
  .card:hover {
    border-color: var(--border-strong);
  }
  .temp {
    opacity: 0.65;
  }
  .floating {
    cursor: grabbing;
    border-color: var(--border-strong);
    box-shadow: var(--shadow-lg);
    rotate: 1.4deg;
  }
  .top,
  .footer {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }
  .footer {
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .spacer {
    flex: 1;
  }
  .tick {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    margin: -2px 1px -2px -3px;
    border-radius: 50%;
    transition: background var(--fast);
  }
  button.tick:hover {
    background: var(--surface-active);
  }
  .id {
    color: var(--text-3);
    font-size: var(--fs-xs);
    letter-spacing: 0.01em;
  }
  .muted {
    display: grid;
    color: var(--text-3);
  }
  .title {
    font-size: var(--fs-md);
    line-height: 1.45;
    font-weight: 450;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .title.done {
    color: var(--text-2);
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .complete {
    color: var(--success);
  }
</style>
