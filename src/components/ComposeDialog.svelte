<script lang="ts">
  import { tick } from 'svelte';
  import Tag from '@lucide/svelte/icons/tag';
  import { Button, Chip, Dialog, Kbd, Textarea } from '../lib/ui';
  import { PRIORITIES, firstLine } from '../lib/format';
  import type { ProjectStore } from '../lib/store.svelte';
  import StatusIcon from './StatusIcon.svelte';
  import StatusPicker from './StatusPicker.svelte';
  import PriorityIcon from './PriorityIcon.svelte';
  import PriorityPicker from './PriorityPicker.svelte';
  import LabelPicker from './LabelPicker.svelte';

  let { store }: { store: ProjectStore } = $props();

  let title = $state('');
  let body = $state('');
  let status = $state(0);
  let priority = $state(0);
  let labels = $state<number[]>([]);
  let titleEl = $state<HTMLTextAreaElement>();
  let open = $state(false);
  let feedbackId: number | undefined;

  $effect(() => {
    const prefill = store.compose;
    if (!prefill) return;
    title = prefill.title ?? '';
    body = prefill.body ?? '';
    status = prefill.status ?? store.firstOf('backlog', 'active')!.id;
    priority = 0;
    labels = [];
    feedbackId = prefill.feedbackId;
    open = true;
    store.compose = null;
    tick().then(() => titleEl?.focus());
  });

  const current = $derived(store.status(status));
  const priorityLabel = $derived(PRIORITIES.find((p) => p.value === priority)?.label);

  async function submit() {
    const cleanTitle = firstLine(title, 200);
    if (!cleanTitle) return;
    const linking = feedbackId;
    open = false;
    const card = await store.createCard({ title: cleanTitle, body: body.trim() || undefined, status, priority, labels });
    if (card && linking) store.send('patch', `/feedback/${linking}`, { card: card.number });
  }

  function onkeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
    event.stopPropagation();
  }
</script>

<Dialog bind:open width={560}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="compose" {onkeydown}>
    <div class="crumb">{store.project.name} · 新建卡片</div>
    <Textarea bind:el={titleEl} bind:value={title} bare class="title" placeholder="标题" aria-label="标题" />
    <Textarea bind:value={body} bare class="body" rows={3} placeholder="补充描述，支持 Markdown" aria-label="描述" />
    <div class="properties">
      <StatusPicker statuses={store.statuses} value={status} onselect={(id) => (status = id)}>
        {#snippet trigger(props)}
          <Button size="sm" {...props}>
            {#if current}<StatusIcon category={current.category} />{current.name}{/if}
          </Button>
        {/snippet}
      </StatusPicker>
      <PriorityPicker value={priority} onselect={(p) => (priority = p)}>
        {#snippet trigger(props)}
          <Button size="sm" {...props}><PriorityIcon priority={priority} />{priorityLabel}</Button>
        {/snippet}
      </PriorityPicker>
      <LabelPicker {store} value={labels} onchange={(next) => (labels = next)}>
        {#snippet trigger(props)}
          <Button size="sm" icon={labels.length ? undefined : Tag} {...props}>
            {#if labels.length}
              {#each labels.slice(0, 3) as id (id)}
                {@const label = store.label(id)}
                {#if label}<Chip label={label.name} hue={label.hue} />{/if}
              {/each}
            {:else}标签{/if}
          </Button>
        {/snippet}
      </LabelPicker>
    </div>
  </div>
  {#snippet footer()}
    <span class="hint"><Kbd>⌘</Kbd><Kbd>↵</Kbd> 创建</span>
    <Button onclick={() => (open = false)}>取消</Button>
    <Button variant="primary" disabled={!title.trim()} onclick={submit}>创建卡片</Button>
  {/snippet}
</Dialog>

<style>
  .compose {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .crumb {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .compose :global(.title) {
    font-size: var(--fs-xl);
    font-weight: 600;
    line-height: 1.35;
  }
  .compose :global(.body) {
    min-height: 66px;
  }
  .properties {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 6px;
  }
  .hint {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    margin-right: auto;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
</style>
