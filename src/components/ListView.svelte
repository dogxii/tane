<script lang="ts">
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Lock from '@lucide/svelte/icons/lock';
  import { Chip, Empty, nearEnd } from '../lib/ui';
  import LayoutList from '@lucide/svelte/icons/layout-list';
  import { relativeTime } from '../lib/format';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Card } from '../lib/types';
  import StatusIcon from './StatusIcon.svelte';
  import StatusPicker from './StatusPicker.svelte';
  import PriorityIcon from './PriorityIcon.svelte';
  import PriorityPicker from './PriorityPicker.svelte';
  import LabelPicker from './LabelPicker.svelte';

  let { store, onopen }: { store: ProjectStore; onopen: (card: Card) => void } = $props();

  type Key = 'number' | 'status' | 'title' | 'priority' | 'mentions' | 'updated';
  let sortKey = $state<Key | null>(null);
  let ascending = $state(false);

  const statusOrder = $derived(new Map(store.statuses.map((s, i) => [s.id, i])));

  const value = (card: Card, key: Key): number | string => {
    switch (key) {
      case 'number':
        return card.number;
      case 'status':
        return statusOrder.get(card.status_id) ?? 0;
      case 'title':
        return card.title;
      case 'priority':
        return card.priority;
      case 'mentions':
        return card.mentions;
      case 'updated':
        return card.updated_at;
    }
  };

  const rows = $derived.by(() => {
    const cards = [...store.visibleCards];
    if (!sortKey) {
      return store.filter.sort === 'manual'
        ? cards.sort((a, b) => (statusOrder.get(a.status_id) ?? 0) - (statusOrder.get(b.status_id) ?? 0))
        : cards;
    }
    const key = sortKey;
    const direction = ascending ? 1 : -1;
    return cards.sort((a, b) => {
      const x = value(a, key);
      const y = value(b, key);
      return (typeof x === 'string' ? x.localeCompare(y as string, 'zh') : x - (y as number)) * direction;
    });
  });

  const PAGE = 100;
  let limit = $state(PAGE);

  function sortBy(key: Key) {
    if (sortKey !== key) {
      sortKey = key;
      ascending = key === 'title' || key === 'status';
    } else if (ascending === (key === 'title' || key === 'status')) {
      ascending = !ascending;
    } else {
      sortKey = null;
    }
  }

  const columns: { key: Key; label: string; className: string }[] = [
    { key: 'number', label: '编号', className: 'c-id' },
    { key: 'status', label: '状态', className: 'c-status' },
    { key: 'title', label: '标题', className: 'c-title' },
    { key: 'priority', label: '优先级', className: 'c-priority' },
  ];
  const trailing: { key: Key; label: string; className: string }[] = [
    { key: 'mentions', label: '提及', className: 'c-num' },
    { key: 'updated', label: '更新', className: 'c-time' },
  ];
</script>

{#snippet head(column: { key: Key; label: string; className: string })}
  <button class="th {column.className}" onclick={() => sortBy(column.key)}>
    {column.label}
    {#if sortKey === column.key}
      {#if ascending}<ArrowUp size={11} strokeWidth={2.4} />{:else}<ArrowDown size={11} strokeWidth={2.4} />{/if}
    {/if}
  </button>
{/snippet}

<div class="scroll">
  {#if !rows.length}
    <Empty icon={LayoutList} title={store.filtering ? '没有匹配的卡片' : '还没有卡片'} description={store.filtering ? '试试调整筛选条件' : '按 C 新建第一张卡片'} />
  {:else}
    <div class="table" role="table">
      <div class="row head" role="row">
        {#each columns as column (column.key)}{@render head(column)}{/each}
        <span class="th c-labels">标签</span>
        {#each trailing as column (column.key)}{@render head(column)}{/each}
      </div>
      {#each rows.slice(0, limit) as card (card.id)}
        {@const status = store.status(card.status_id)}
        <div
          class="row"
          role="row"
          tabindex="0"
          onclick={() => card.id > 0 && onopen(card)}
          onkeydown={(event) => {
            if (event.key === 'Enter' && event.target === event.currentTarget && card.id > 0) onopen(card);
          }}
          onpointerenter={() => (store.hovered = card.number)}
          onpointerleave={() => {
            if (store.hovered === card.number) store.hovered = null;
          }}
        >
          <span class="td c-id tabular">{store.project.key}-{card.number || '…'}</span>
          <span class="td c-status">
            <StatusPicker statuses={store.statuses} value={card.status_id} onselect={(id) => store.setStatus(card, id)}>
              {#snippet trigger(props)}
                <button class="cell-btn" disabled={!store.editable} {...props}>
                  {#if status}<StatusIcon category={status.category} /><span class="ellipsis">{status.name}</span>{/if}
                </button>
              {/snippet}
            </StatusPicker>
          </span>
          <span class="td c-title">
            <span class="ellipsis">{card.title}</span>
            {#if card.is_private && store.project.visibility === 'public'}<Lock size={11} strokeWidth={2} />{/if}
          </span>
          <span class="td c-priority">
            <PriorityPicker value={card.priority} onselect={(priority) => store.updateCard(card, { priority }, { priority })}>
              {#snippet trigger(props)}
                <button class="cell-btn" disabled={!store.editable} aria-label="优先级" {...props}><PriorityIcon priority={card.priority} /></button>
              {/snippet}
            </PriorityPicker>
          </span>
          <span class="td c-labels">
            <LabelPicker {store} value={card.label_ids} onchange={(labels) => store.updateCard(card, { labels }, { label_ids: labels })}>
              {#snippet trigger(props)}
                <button class="cell-btn labels" disabled={!store.editable} aria-label="标签" {...props}>
                  {#each card.label_ids.slice(0, 3) as id (id)}
                    {@const label = store.label(id)}
                    {#if label}<Chip label={label.name} hue={label.hue} />{/if}
                  {:else}
                    <span class="placeholder">—</span>
                  {/each}
                </button>
              {/snippet}
            </LabelPicker>
          </span>
          <span class="td c-num tabular">{card.mentions || ''}</span>
          <span class="td c-time">{relativeTime(card.updated_at)}</span>
        </div>
      {/each}
      {#if rows.length > limit}
        <div use:nearEnd={() => (limit += PAGE)}></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 20px 24px;
  }
  .table {
    min-width: 860px;
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    background: var(--surface);
    overflow: clip;
  }
  .row {
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 8px;
    border-top: 1px solid var(--border);
    cursor: pointer;
    transition: background var(--fast);
  }
  .row:hover {
    background: var(--surface-hover);
  }
  .row.head {
    position: sticky;
    top: 0;
    z-index: 2;
    height: 32px;
    border-top: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: -1px;
    background: var(--bg-sunken);
    cursor: default;
  }
  .th {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0 6px;
    color: var(--text-3);
    font-size: var(--fs-xs);
    font-weight: 500;
    white-space: nowrap;
  }
  button.th:hover {
    color: var(--text);
  }
  .td {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    padding: 0 6px;
    font-size: var(--fs-sm);
  }
  .c-id {
    flex: 0 0 78px;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .c-status {
    flex: 0 0 112px;
  }
  .c-title {
    flex: 1 1 200px;
  }
  .td.c-title {
    color: var(--text);
    font-size: var(--fs-md);
  }
  .td.c-title :global(svg) {
    flex: none;
    color: var(--text-3);
  }
  .c-priority {
    flex: 0 0 56px;
  }
  .c-labels {
    flex: 0 0 200px;
  }
  .c-num {
    flex: 0 0 48px;
    justify-content: flex-end;
    text-align: right;
    color: var(--text-2);
  }
  .c-time {
    flex: 0 0 84px;
    justify-content: flex-end;
    color: var(--text-3);
    font-size: var(--fs-xs);
    white-space: nowrap;
  }
  .ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    min-height: 24px;
    padding: 0 5px;
    margin-left: -5px;
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    transition: background var(--fast);
  }
  .cell-btn:hover:not(:disabled) {
    background: var(--surface-active);
  }
  .cell-btn:disabled {
    cursor: default;
    color: inherit;
  }
  .labels {
    gap: 4px;
    overflow: hidden;
  }
  .placeholder {
    color: var(--text-3);
  }
</style>
