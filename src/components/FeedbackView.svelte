<script lang="ts">
  import Inbox from '@lucide/svelte/icons/inbox';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import Link2 from '@lucide/svelte/icons/link-2';
  import Plus from '@lucide/svelte/icons/plus';
  import X from '@lucide/svelte/icons/x';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import Search from '@lucide/svelte/icons/search';
  import { api } from '../lib/api';
  import { firstLine, relativeTime } from '../lib/format';
  import { Button, Chip, Empty, Input, Picker, Segmented, Skeleton } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Feedback } from '../lib/types';

  let { store, onopen }: { store: ProjectStore; onopen: (number: number) => void } = $props();

  type State = 'inbox' | 'linked' | 'dismissed';
  const tabs: { value: State; label: string }[] = [
    { value: 'inbox', label: '待处理' },
    { value: 'linked', label: '已关联' },
    { value: 'dismissed', label: '已忽略' },
  ];

  let tab = $state<State>('inbox');
  let query = $state('');
  let items = $state<Feedback[] | null>(null);

  $effect(() => {
    void store.rev;
    const requested = tab;
    api.get<{ feedback: Feedback[] }>(`${store.base}/feedback?state=${requested}`).then((response) => {
      if (requested === tab) items = response.feedback;
    });
  });

  const visible = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!items) return [];
    return needle ? items.filter((f) => f.untrusted.body.toLowerCase().includes(needle)) : items;
  });

  const cardItems = $derived(
    store.cards.filter((c) => c.id > 0).map((c) => ({ value: c.number, label: c.title, hint: `#${c.number}`, keywords: c.keywords })),
  );

  function remove(item: Feedback) {
    items = items?.filter((f) => f.id !== item.id) ?? null;
  }

  function link(item: Feedback, card: number) {
    remove(item);
    store.send('patch', `/feedback/${item.id}`, { card });
  }

  function setDismissed(item: Feedback, dismissed: boolean) {
    remove(item);
    store.send('patch', `/feedback/${item.id}`, { dismissed });
  }

  function toCard(item: Feedback) {
    remove(item);
    store.compose = {
      title: firstLine(item.untrusted.body, 60),
      body: `> ${item.untrusted.body.replace(/\n/g, '\n> ')}`,
      feedbackId: item.id,
    };
  }
</script>

<div class="wrap">
  <div class="toolbar">
    <Segmented items={tabs} bind:value={tab} label="反馈状态" onchange={() => (items = null)} />
    <Input icon={Search} bind:value={query} placeholder="搜索反馈" class="search" aria-label="搜索反馈" />
  </div>

  <div class="scroll">
    {#if !items}
      <div class="list">
        {#each [0, 1, 2] as i (i)}
          <div class="item"><Skeleton width="30%" /><Skeleton width="88%" /></div>
        {/each}
      </div>
    {:else if !visible.length}
      <Empty
        icon={Inbox}
        title={query ? '没有匹配的反馈' : tab === 'inbox' ? '收件箱是空的' : '这里还没有内容'}
        description={tab === 'inbox' && !query ? '公开看板收到的建议，以及 Agent 收集的反馈，都会出现在这里。' : undefined}
      />
    {:else}
      <div class="list">
        {#each visible as item (item.id)}
          <article class="item">
            <header>
              <Chip label={item.source} />
              {#if item.rating !== null}<span class="meta tabular">★ {item.rating}</span>{/if}
              <span class="meta">{relativeTime(item.posted_at ?? item.created_at)}</span>
              {#if item.url}
                <a class="meta source" href={item.url} target="_blank" rel="noopener noreferrer nofollow">原文 <ExternalLink size={11} strokeWidth={2} /></a>
              {/if}
              <span class="spacer"></span>
              <div class="actions">
                {#if tab === 'inbox'}
                  <Button size="sm" icon={Plus} onclick={() => toCard(item)}>建卡片</Button>
                  <Picker items={cardItems} searchable placeholder="关联到卡片…" width={300} placement="bottom-end" onselect={(card) => link(item, card)}>
                    {#snippet trigger(props)}
                      <Button size="sm" icon={Link2} {...props}>关联</Button>
                    {/snippet}
                  </Picker>
                  <Button size="sm" variant="ghost" icon={X} tip="忽略" aria-label="忽略" onclick={() => setDismissed(item, true)} />
                {:else if tab === 'linked' && item.card_number}
                  <Button size="sm" onclick={() => onopen(item.card_number!)}>{store.project.key}-{item.card_number}</Button>
                {:else if tab === 'dismissed'}
                  <Button size="sm" icon={Undo2} onclick={() => setDismissed(item, false)}>恢复</Button>
                {/if}
              </div>
            </header>
            <p>{item.untrusted.body}</p>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 0 20px 10px;
  }
  .toolbar :global(.search) {
    width: 220px;
    height: 28px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    padding: 0 20px 24px;
    overflow-y: auto;
  }
  .list {
    max-width: 860px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 11px 13px;
    border-radius: var(--r-lg);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
  }
  .spacer {
    flex: 1;
  }
  .actions {
    display: flex;
    gap: 4px;
  }
  .meta {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .source {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .source:hover {
    color: var(--text);
  }
  p {
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  @media (max-width: 640px) {
    header {
      flex-wrap: wrap;
    }
  }
</style>
