<script lang="ts" module>
  export type PickerItem = {
    value: any;
    label: string;
    hint?: string;
    hue?: number;
    keywords?: string;
    danger?: boolean;
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { tick, untrack } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import Plus from '@lucide/svelte/icons/plus';
  import Search from '@lucide/svelte/icons/search';
  import Popover from './Popover.svelte';
  import type { Placement } from './layers';

  type TriggerProps = {
    onclick: (event: MouseEvent) => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'listbox';
  };

  let {
    items,
    value,
    multiple = false,
    searchable = items.length > 7,
    placeholder = '搜索…',
    placement = 'bottom-start',
    width = 220,
    open = $bindable(false),
    onselect,
    oncreate,
    trigger,
    leading,
  }: {
    items: PickerItem[];
    value?: any;
    multiple?: boolean;
    searchable?: boolean;
    placeholder?: string;
    placement?: Placement;
    width?: number;
    open?: boolean;
    onselect: (value: any, item: PickerItem) => void;
    oncreate?: (query: string) => void;
    trigger: Snippet<[TriggerProps]>;
    leading?: Snippet<[PickerItem]>;
  } = $props();

  let host = $state<HTMLElement>();
  let list = $state<HTMLElement>();
  let search = $state<HTMLInputElement>();
  let query = $state('');
  let active = $state(0);

  const anchor = $derived((host?.firstElementChild as HTMLElement) ?? null);
  const selected = (candidate: any) => (multiple ? (value as any[])?.includes(candidate) : value === candidate);

  const filtered = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(needle));
  });
  const canCreate = $derived(
    !!oncreate && !!query.trim() && !items.some((item) => item.label === query.trim()),
  );
  const total = $derived(filtered.length + (canCreate ? 1 : 0));

  $effect(() => {
    if (!open) return;
    untrack(() => {
      query = '';
      active = Math.max(0, items.findIndex((item) => selected(item.value)));
      tick().then(() => (searchable ? search : list)?.focus());
    });
  });

  $effect(() => {
    if (active >= total) active = Math.max(0, total - 1);
  });

  function choose(index: number) {
    if (index === filtered.length && canCreate) {
      oncreate!(query.trim());
      query = '';
      if (!multiple) open = false;
      return;
    }
    const item = filtered[index];
    if (!item) return;
    onselect(item.value, item);
    if (!multiple) open = false;
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!total) return;
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + total) % total;
      tick().then(() => list?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      choose(active);
    }
    event.stopPropagation();
  }
</script>

<span bind:this={host} class="host">
  {@render trigger({
    onclick: (event) => {
      event.stopPropagation();
      open = !open;
    },
    'aria-expanded': open,
    'aria-haspopup': 'listbox',
  })}
</span>

<Popover bind:open {anchor} {placement}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker" style:width="{width}px" {onkeydown} onclick={(event) => event.stopPropagation()}>
    {#if searchable}
      <div class="search">
        <Search size={13} strokeWidth={2} />
        <input bind:this={search} bind:value={query} {placeholder} autocomplete="off" oninput={() => (active = 0)} />
      </div>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div bind:this={list} class="list" role="listbox" tabindex="-1" aria-multiselectable={multiple}>
      {#each filtered as item, index (item.value)}
        <button
          role="option"
          aria-selected={selected(item.value)}
          class="row"
          class:danger={item.danger}
          data-active={index === active}
          tabindex="-1"
          onpointermove={() => (active = index)}
          onclick={() => choose(index)}
        >
          {#if leading}{@render leading(item)}{:else if item.hue !== undefined}<i style:--h={item.hue}></i>{/if}
          <span class="label">{item.label}</span>
          {#if item.hint}<span class="hint">{item.hint}</span>{/if}
          {#if selected(item.value)}<Check size={13} strokeWidth={2.4} />{/if}
        </button>
      {/each}
      {#if canCreate}
        <button
          class="row"
          data-active={active === filtered.length}
          tabindex="-1"
          onpointermove={() => (active = filtered.length)}
          onclick={() => choose(filtered.length)}
        >
          <Plus size={13} strokeWidth={2} />
          <span class="label">创建“{query.trim()}”</span>
        </button>
      {:else if !filtered.length}
        <div class="empty">没有匹配项</div>
      {/if}
    </div>
  </div>
</Popover>

<style>
  .host {
    display: contents;
  }
  .picker {
    display: flex;
    flex-direction: column;
    max-height: 320px;
    max-width: calc(100vw - 16px);
  }
  .search {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
    color: var(--text-3);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text);
    font-size: var(--fs-sm);
  }
  .search input:focus-visible,
  .list:focus-visible {
    outline: none;
  }
  .list {
    padding: 4px;
    overflow-y: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 30px;
    padding: 0 8px;
    border-radius: var(--r-sm);
    font-size: var(--fs-sm);
    text-align: left;
  }
  .row[data-active='true'] {
    background: var(--surface-hover);
  }
  .row:focus-visible {
    outline: none;
  }
  .row.danger {
    color: var(--danger);
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  i {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: oklch(var(--dot-l) var(--dot-c) var(--h));
  }
  .empty {
    padding: 12px 8px;
    text-align: center;
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
</style>
