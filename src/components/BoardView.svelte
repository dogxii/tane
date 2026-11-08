<script lang="ts">
  import { flip } from 'svelte/animate';
  import { tick } from 'svelte';
  import Plus from '@lucide/svelte/icons/plus';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import { Button, Picker, Textarea, nearEnd, pushLayer, toasts } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Card, Status } from '../lib/types';
  import { CATEGORY_LABELS } from '../lib/format';
  import CardItem from './CardItem.svelte';
  import StatusIcon from './StatusIcon.svelte';

  let { store, onopen }: { store: ProjectStore; onopen: (card: Card) => void } = $props();

  type Drag = {
    card: Card;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    statusId: number;
    index: number;
  };

  let drag = $state<Drag | null>(null);
  let boardEl = $state<HTMLElement>();
  let addingTo = $state<number | null>(null);
  let draft = $state('');
  let composer = $state<HTMLTextAreaElement>();
  let renaming = $state<number | null>(null);
  let renameValue = $state('');
  let suppressClick = false;

  type Entry = { key: string; card?: Card; hidden?: boolean };

  // The hidden slot of a dragged card has no size, and scaling to nothing is not an animation.
  const flipSlot = (node: Element, rects: { from: DOMRect; to: DOMRect }, params: { duration: number }) =>
    rects.to.width ? flip(node, rects, params) : { duration: 0 };

  // Long columns render in pages, which keeps a board with thousands of cards responsive.
  const PAGE = 60;
  let limits = $state<Record<number, number>>({});
  const limitOf = (status: Status) => limits[status.id] ?? PAGE;
  const showMore = (status: Status) => (limits[status.id] = limitOf(status) + PAGE);

  // The dragged card stays mounted but hidden: touch events keep targeting the node
  // the finger went down on, and they stop bubbling if that node leaves the document.
  function entries(status: Status): Entry[] {
    const list: Entry[] = store.cardsIn(status.id).map((card) => ({
      key: `c${card.id}`,
      card,
      hidden: card.id === drag?.card.id,
    }));
    if (drag?.statusId === status.id) {
      let at = 0;
      let seen = 0;
      while (at < list.length && (seen < drag.index || list[at].hidden)) {
        if (!list[at].hidden) seen++;
        at++;
      }
      list.splice(at, 0, { key: 'placeholder' });
    }
    return list.slice(0, limitOf(status) + (drag?.statusId === status.id ? 1 : 0));
  }

  // Registered up front: a listener added once a touch is under way cannot block scrolling.
  $effect(() => {
    if (!boardEl) return;
    const board = boardEl;
    const onTouchMove = (event: TouchEvent) => {
      if (drag) event.preventDefault();
    };
    board.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => board.removeEventListener('touchmove', onTouchMove);
  });

  function open(card: Card) {
    if (suppressClick) return;
    onopen(card);
  }

  // Drag and drop

  function startPress(event: PointerEvent, card: Card) {
    if (!store.editable || event.button !== 0 || card.id < 0) return;
    if ((event.target as Element).closest('button, a')) return;
    const element = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const isTouch = event.pointerType === 'touch';
    let latest = { x: startX, y: startY };
    let frame = 0;
    let popLayer: (() => void) | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;

    const begin = () => {
      const rect = element.getBoundingClientRect();
      drag = {
        card,
        x: latest.x,
        y: latest.y,
        offsetX: startX - rect.left,
        offsetY: startY - rect.top,
        width: rect.width,
        height: rect.height,
        statusId: card.status_id,
        index: store.cardsIn(card.status_id).findIndex((c) => c.id === card.id),
      };
      document.body.style.cursor = 'grabbing';
      popLayer = pushLayer(() => finish(false));
      frame = requestAnimationFrame(autoScroll);
    };

    const updateTarget = () => {
      if (!drag || !boardEl) return;
      const columns = [...boardEl.querySelectorAll<HTMLElement>('[data-status]')];
      let target = columns[0];
      let best = Infinity;
      for (const column of columns) {
        const rect = column.getBoundingClientRect();
        const distance = latest.x < rect.left ? rect.left - latest.x : latest.x > rect.right ? latest.x - rect.right : 0;
        if (distance < best) {
          best = distance;
          target = column;
        }
      }
      if (!target) return;
      const statusId = Number(target.dataset.status);
      let index = 0;
      for (const element of target.querySelectorAll<HTMLElement>('.slot:not(.hidden) [data-card]')) {
        const rect = element.getBoundingClientRect();
        if (latest.y > rect.top + rect.height / 2) index++;
      }
      if (statusId !== drag.statusId || index !== drag.index) {
        drag.statusId = statusId;
        drag.index = index;
      }
    };

    const autoScroll = () => {
      if (!drag || !boardEl) return;
      const EDGE = 64;
      const SPEED = 12;
      const rect = boardEl.getBoundingClientRect();
      let moved = false;
      if (latest.x < rect.left + EDGE) {
        boardEl.scrollLeft -= SPEED;
        moved = true;
      } else if (latest.x > rect.right - EDGE) {
        boardEl.scrollLeft += SPEED;
        moved = true;
      }
      const list = boardEl.querySelector<HTMLElement>(`[data-status="${drag.statusId}"] .cards`);
      if (list) {
        const listRect = list.getBoundingClientRect();
        if (latest.y < listRect.top + EDGE && list.scrollTop > 0) {
          list.scrollTop -= SPEED;
          moved = true;
        } else if (latest.y > listRect.bottom - EDGE) {
          list.scrollTop += SPEED;
          moved = true;
        }
      }
      if (moved) updateTarget();
      frame = requestAnimationFrame(autoScroll);
    };

    const onMove = (e: PointerEvent) => {
      latest = { x: e.clientX, y: e.clientY };
      const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (!drag) {
        if (isTouch) {
          if (distance > 8) finish(false);
          return;
        }
        if (distance < 5) return;
        begin();
      }
      drag!.x = e.clientX;
      drag!.y = e.clientY;
      updateTarget();
    };

    const finish = (commit: boolean) => {
      clearTimeout(holdTimer);
      cancelAnimationFrame(frame);
      popLayer?.();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      document.body.style.cursor = '';
      if (!drag) return;
      const { card: moving, statusId, index } = drag;
      drag = null;
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      if (commit) drop(moving, statusId, index);
    };

    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    if (isTouch) {
      holdTimer = setTimeout(() => {
        begin();
        navigator.vibrate?.(8);
      }, 220);
    }
  }

  function drop(dragged: Card, statusId: number, index: number) {
    // A poll may have replaced the card objects while it was in the air.
    const card = store.cards.find((c) => c.id === dragged.id);
    if (!card) return;
    if (store.filter.sort !== 'manual') {
      // A sorted column has no manual order to preserve, only a destination.
      if (statusId !== card.status_id) store.moveCard(card, statusId, undefined);
      return;
    }
    const column = store.cardsIn(statusId);
    if (statusId === card.status_id && column.findIndex((c) => c.id === card.id) === index) return;
    const others = column.filter((c) => c.id !== card.id);
    store.moveCard(card, statusId, index > 0 ? others[index - 1].number : null);
  }

  // Quick add

  async function startAdding(statusId: number) {
    addingTo = statusId;
    draft = '';
    await tick();
    composer?.focus();
  }

  function submitDraft(statusId: number) {
    const title = draft.trim();
    if (title) store.createCard({ title, status: statusId });
    draft = '';
    composer?.focus();
  }

  // Column actions

  const columnActions = [
    { value: 'rename', label: '重命名' },
    { value: 'left', label: '向左移动' },
    { value: 'right', label: '向右移动' },
    { value: 'delete', label: '删除列', danger: true },
  ];

  async function columnAction(status: Status, action: string) {
    const statuses = store.statuses;
    const index = statuses.findIndex((s) => s.id === status.id);
    if (action === 'rename') {
      renameValue = status.name;
      renaming = status.id;
      await tick();
      boardEl?.querySelector<HTMLInputElement>('.rename')?.select();
    } else if (action === 'left' && index > 0) {
      const after = index >= 2 ? statuses[index - 2].id : null;
      moveColumn(status, index - 1, after);
    } else if (action === 'right' && index < statuses.length - 1) {
      moveColumn(status, index + 1, statuses[index + 1].id);
    } else if (action === 'delete') {
      const fallback = statuses.find((s) => s.id !== status.id);
      if (!fallback) return;
      const moved = store.cards.filter((card) => card.status_id === status.id);
      store.data!.statuses = statuses.filter((s) => s.id !== status.id);
      for (const card of moved) card.status_id = fallback.id;
      store.send('del', `/statuses/${status.id}?move_to=${fallback.id}`);
      if (moved.length) toasts.show(`${moved.length} 张卡片已移到“${fallback.name}”`);
    }
  }

  function moveColumn(status: Status, toIndex: number, after: number | null) {
    const next = store.statuses.filter((s) => s.id !== status.id);
    next.splice(toIndex, 0, status);
    store.data!.statuses = next;
    store.send('patch', `/statuses/${status.id}`, { after });
  }

  function commitRename(status: Status) {
    const name = renameValue.trim();
    renaming = null;
    if (!name || name === status.name) return;
    status.name = name;
    store.send('patch', `/statuses/${status.id}`, { name });
  }
</script>

<div class="board" bind:this={boardEl}>
  {#each store.statuses as status (status.id)}
    {@const list = entries(status)}
    <section class="column" data-status={status.id} aria-label={status.name}>
      <header>
        <StatusIcon category={status.category} />
        {#if renaming === status.id}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="rename"
            bind:value={renameValue}
            autofocus
            onblur={() => commitRename(status)}
            onkeydown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              if (event.key === 'Escape') renaming = null;
              event.stopPropagation();
            }}
          />
        {:else}
          <h3>{status.name}</h3>
        {/if}
        <span class="count tabular">{store.cardsIn(status.id).length}</span>
        <span class="spacer"></span>
        {#if store.editable}
          <div class="actions">
            <Picker items={columnActions} searchable={false} width={140} placement="bottom-end" onselect={(action) => columnAction(status, action)}>
              {#snippet trigger(props)}
                <Button variant="ghost" size="sm" icon={Ellipsis} aria-label="{status.name} 列操作" {...props} />
              {/snippet}
            </Picker>
            <Button variant="ghost" size="sm" icon={Plus} tip="在此列新建" aria-label="在 {status.name} 新建卡片" onclick={() => startAdding(status.id)} />
          </div>
        {/if}
      </header>

      <div class="cards">
        {#if addingTo === status.id}
          <div class="composer">
            <Textarea
              bind:el={composer}
              bind:value={draft}
              bare
              placeholder="输入标题，回车创建"
              onkeydown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                  event.preventDefault();
                  submitDraft(status.id);
                } else if (event.key === 'Escape') {
                  addingTo = null;
                }
              }}
              onblur={() => {
                if (!draft.trim()) addingTo = null;
              }}
            />
          </div>
        {/if}
        {#each list as entry (entry.key)}
          <div class="slot" class:hidden={entry.hidden} animate:flipSlot={{ duration: drag ? 130 : 180 }}>
            {#if entry.card}
              <CardItem {store} card={entry.card} onopen={open} onpointerdown={(event) => startPress(event, entry.card!)} />
            {:else}
              <div class="placeholder" style:height="{drag?.height}px"></div>
            {/if}
          </div>
        {/each}
        {#if store.cardsIn(status.id).length > limitOf(status)}
          <div class="more" use:nearEnd={() => showMore(status)}></div>
        {/if}
        {#if !list.some((entry) => !entry.hidden) && addingTo !== status.id}
          <div class="empty">{store.filtering ? '没有匹配的卡片' : `暂无${CATEGORY_LABELS[status.category]}卡片`}</div>
        {/if}
      </div>
    </section>
  {/each}
</div>

{#if drag}
  <div
    class="ghost"
    style:width="{drag.width}px"
    style:transform="translate3d({drag.x - drag.offsetX}px, {drag.y - drag.offsetY}px, 0)"
  >
    <CardItem {store} card={drag.card} floating />
  </div>
{/if}

<style>
  .board {
    flex: 1;
    display: flex;
    align-items: stretch;
    gap: 10px;
    min-height: 0;
    padding: 2px 20px 16px;
    overflow-x: auto;
  }
  .column {
    flex: 0 0 286px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    max-width: 86vw;
    border-radius: var(--r-xl);
    background: var(--bg-sunken);
  }
  header {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
    height: 42px;
    padding: 0 7px 0 13px;
  }
  h3 {
    font-size: var(--fs-sm);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rename {
    width: 110px;
    height: 24px;
    padding: 0 6px;
    border-radius: var(--r-sm);
    border: 1px solid var(--accent);
    background: var(--surface);
    font-size: var(--fs-sm);
  }
  .count {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .spacer {
    flex: 1;
  }
  .actions {
    display: flex;
    opacity: 0;
    transition: opacity var(--fast);
  }
  .column:hover .actions,
  .actions:focus-within {
    opacity: 1;
  }
  @media (hover: none) {
    .actions {
      opacity: 1;
    }
  }
  .cards {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 48px;
    padding: 0 7px 8px;
    overflow-y: auto;
  }
  .slot {
    flex: none;
  }
  .slot.hidden {
    display: none;
  }
  .composer {
    flex: none;
    padding: 9px 11px;
    border-radius: var(--r-lg);
    border: 1px solid var(--border-strong);
    background: var(--surface);
  }
  :global(:root[data-keyboard]) .composer:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .placeholder {
    border-radius: var(--r-lg);
    border: 1.5px dashed var(--border-strong);
    background: var(--surface-hover);
  }
  .empty {
    padding: 18px 0;
    text-align: center;
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
  .ghost {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 700;
    pointer-events: none;
    will-change: transform;
  }
</style>
