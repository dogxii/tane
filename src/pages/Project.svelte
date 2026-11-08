<script lang="ts">
  import { untrack } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import Plus from '@lucide/svelte/icons/plus';
  import Menu from '@lucide/svelte/icons/menu';
  import Tag from '@lucide/svelte/icons/tag';
  import SignalHigh from '@lucide/svelte/icons/chart-no-axes-column-increasing';
  import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
  import Globe from '@lucide/svelte/icons/globe';
  import Lock from '@lucide/svelte/icons/lock';
  import X from '@lucide/svelte/icons/x';
  import SearchX from '@lucide/svelte/icons/search-x';
  import MessageCirclePlus from '@lucide/svelte/icons/message-circle-plus';
  import { api, ApiFailure } from '../lib/api';
  import { PRIORITIES } from '../lib/format';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { ProjectStore, type Sort } from '../lib/store.svelte';
  import { Button, Dialog, Empty, Input, Picker, ProjectIcon, Segmented, Sheet, Skeleton, Textarea, hasLayers, tip, toasts } from '../lib/ui';
  import type { Card } from '../lib/types';
  import BoardView from '../components/BoardView.svelte';

  let { slug }: { slug: string } = $props();

  // Visitors only ever need the board, so everything else is fetched on demand.
  const views = {
    list: () => import('../components/ListView.svelte'),
    feedback: () => import('../components/FeedbackView.svelte'),
    releases: () => import('../components/ReleasesView.svelte'),
    settings: () => import('../components/ProjectSettings.svelte'),
    changelog: () => import('../components/ChangelogView.svelte'),
    panel: () => import('../components/CardPanel.svelte'),
    compose: () => import('../components/ComposeDialog.svelte'),
  };

  $effect(() => {
    if (!store.editable) return;
    const timer = setTimeout(() => Object.values(views).forEach((load) => void load()), 1200);
    return () => clearTimeout(timer);
  });

  // Build the store once per slug; App remounts this page when the slug changes.
  const store = untrack(() => new ProjectStore(slug));

  $effect(() => {
    session.store = store;
    const stop = store.start();
    return () => {
      stop();
      session.store = null;
    };
  });

  // Keeps the sidebar's inbox counts honest as this board changes.
  $effect(() => {
    if (store.rev && session.signedIn) untrack(() => session.refreshProjects().catch(() => {}));
  });

  type View = 'board' | 'list' | 'feedback' | 'releases' | 'settings' | 'changelog';

  const view = $derived((router.query('view') ?? 'board') as View);
  const openNumber = $derived(Number(router.query('card')) || null);

  const ownerTabs = $derived([
    { value: 'board' as View, label: '看板' },
    { value: 'list' as View, label: '列表' },
    { value: 'feedback' as View, label: inboxLabel() },
    { value: 'releases' as View, label: '版本' },
    { value: 'settings' as View, label: '设置' },
  ]);
  const visitorTabs: { value: View; label: string }[] = [
    { value: 'board', label: '路线图' },
    { value: 'changelog', label: '更新日志' },
  ];

  function inboxLabel() {
    const count = session.projects.find((p) => p.slug === slug)?.inbox;
    return count ? `反馈 ${count}` : '反馈';
  }

  const showFilters = $derived(view === 'board' || view === 'list');
  let searchEl = $state<HTMLInputElement>();

  function setView(next: View) {
    router.setQuery({ view: next === 'board' ? null : next, card: null });
  }
  const openCard = (card: Card) => router.setQuery({ card: card.number });
  const openByNumber = (number: number) => router.setQuery({ card: number });
  const closeCard = () => router.setQuery({ card: null }, { replace: true });

  // Filters

  const labelItems = $derived(store.labels.map((l) => ({ value: l.id, label: l.name, hue: l.hue })));
  const SORTS: { value: Sort; label: string }[] = [
    { value: 'manual', label: '手动排序' },
    { value: 'demand', label: '呼声最高' },
    { value: 'priority', label: '优先级' },
    { value: 'newest', label: '最新创建' },
  ];
  const sortLabel = $derived(SORTS.find((s) => s.value === store.filter.sort)!.label);

  function toggle(list: number[], value: number) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function clearFilters() {
    store.filter.q = '';
    store.filter.labels = [];
    store.filter.priorities = [];
  }

  // Visitor suggestions

  let suggesting = $state(false);
  let suggestion = $state('');
  let honeypot = $state('');
  let sending = $state(false);

  async function submitSuggestion() {
    if (suggestion.trim().length < 4 || sending) return;
    sending = true;
    try {
      await api.post(`${store.base}/submit`, { body: suggestion.trim(), website: honeypot });
      suggesting = false;
      suggestion = '';
      toasts.show('收到了，感谢你的建议');
    } catch (failure) {
      toasts.error(failure instanceof ApiFailure ? failure.message : '提交失败');
    } finally {
      sending = false;
    }
  }

  // Shortcuts

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
    const target = event.target as HTMLElement;
    if (target.matches('input, textarea, [contenteditable]') || hasLayers()) return;
    if (!store.data || !store.editable) return;

    const key = event.key.toLowerCase();
    const hovered = store.hovered ? store.card(store.hovered) : undefined;
    const actions: Record<string, () => void> = {
      c: () => {
        store.compose = {};
      },
      '/': () => searchEl?.focus(),
      b: () => setView('board'),
      l: () => setView('list'),
      f: () => setView('feedback'),
      r: () => setView('releases'),
    };
    if (hovered && key === 'd') actions.d = () => store.toggleDone(hovered);
    if (hovered && event.key === 'Enter' && target === document.body) actions.enter = () => openCard(hovered);
    const action = actions[key];
    if (action) {
      event.preventDefault();
      action();
    }
  }
</script>

<svelte:window {onkeydown} />
<svelte:head><title>{store.data ? `${store.project.name} · Tane` : 'Tane'}</title></svelte:head>

{#if store.missing}
  <div class="page center">
    <Empty icon={SearchX} title="找不到这个看板" description="它可能不存在，或者尚未公开。">
      <Button onclick={() => router.go('/')}>返回首页</Button>
    </Empty>
  </div>
{:else if !store.data}
  <div class="page">
    <div class="head"><Skeleton width={160} height={22} /></div>
    <div class="skeleton-board">
      {#each [0, 1, 2, 3] as i (i)}
        <div class="skeleton-column"><Skeleton height={70} radius={11} /><Skeleton height={54} radius={11} /></div>
      {/each}
    </div>
  </div>
{:else}
  {@const project = store.project}
  <div class="page" style:--hue={project.hue}>
    <header class="head">
      {#if session.signedIn}
        <span class="mobile"><Button variant="ghost" icon={Menu} aria-label="打开导航" onclick={() => (session.sidebarOpen = true)} /></span>
      {/if}
      <ProjectIcon name={project.name} icon={project.icon} hue={project.hue} size={24} />
      <h1>{project.name}</h1>
      {#if store.editable}
        <span class="visibility" use:tip={project.visibility === 'public' ? '公开看板，任何人可查看' : '私有，只有你能看到'}>
          {#if project.visibility === 'public'}<Globe size={13} strokeWidth={2} />{:else}<Lock size={13} strokeWidth={2} />{/if}
        </span>
      {/if}
      <div class="tabs">
        <Segmented items={store.editable ? ownerTabs : visitorTabs} value={view} label="视图" onchange={setView} />
      </div>
      <span class="spacer"></span>
      {#if store.editable}
        <Button variant="primary" icon={Plus} tip="新建卡片 C" onclick={() => { store.compose = {}; }}>新建</Button>
      {:else if project.allow_submissions}
        <Button variant="primary" icon={MessageCirclePlus} onclick={() => (suggesting = true)}>提建议</Button>
      {/if}
    </header>

    {#if !store.editable && project.description}
      <p class="description">{project.description}</p>
    {/if}

    {#if showFilters}
      <div class="filters">
        <Input icon={Search} bind:el={searchEl} bind:value={store.filter.q} placeholder="筛选卡片" class="filter-search" aria-label="筛选卡片" />
        {#if store.labels.length}
          <Picker items={labelItems} value={store.filter.labels} multiple searchable onselect={(id) => (store.filter.labels = toggle(store.filter.labels, id))}>
            {#snippet trigger(props)}
              <Button size="sm" variant="ghost" icon={Tag} active={store.filter.labels.length > 0} {...props}>
                标签{store.filter.labels.length ? ` ${store.filter.labels.length}` : ''}
              </Button>
            {/snippet}
          </Picker>
        {/if}
        {#if store.editable}
          <Picker items={PRIORITIES} value={store.filter.priorities} multiple searchable={false} width={170} onselect={(p) => (store.filter.priorities = toggle(store.filter.priorities, p))}>
            {#snippet trigger(props)}
              <Button size="sm" variant="ghost" icon={SignalHigh} active={store.filter.priorities.length > 0} {...props}>
                优先级{store.filter.priorities.length ? ` ${store.filter.priorities.length}` : ''}
              </Button>
            {/snippet}
          </Picker>
        {/if}
        {#if store.filtering}
          <Button size="sm" variant="ghost" icon={X} onclick={clearFilters}>清除</Button>
        {/if}
        <span class="spacer"></span>
        <Picker items={SORTS} value={store.filter.sort} searchable={false} width={150} placement="bottom-end" onselect={(sort) => (store.filter.sort = sort)}>
          {#snippet trigger(props)}
            <Button size="sm" variant="ghost" icon={ArrowUpDown} {...props}>{sortLabel}</Button>
          {/snippet}
        </Picker>
      </div>
    {/if}

    {#if view === 'list' && store.editable}
      {#await views.list() then { default: View }}<View {store} onopen={openCard} />{/await}
    {:else if view === 'feedback' && store.editable}
      {#await views.feedback() then { default: View }}<View {store} onopen={openByNumber} />{/await}
    {:else if view === 'releases' && store.editable}
      {#await views.releases() then { default: View }}<View {store} onopen={openCard} />{/await}
    {:else if view === 'settings' && store.editable}
      {#await views.settings() then { default: View }}<View {store} />{/await}
    {:else if view === 'changelog'}
      {#await views.changelog() then { default: View }}<View {store} />{/await}
    {:else}
      <BoardView {store} onopen={openCard} />
    {/if}

    {#if !session.signedIn}
      <footer class="powered">由 Tane 提供支持</footer>
    {/if}
  </div>

  <Sheet open={openNumber !== null} label="卡片详情" onclose={closeCard}>
    {#if openNumber !== null}
      {#key openNumber}
        {#await views.panel() then { default: Panel }}<Panel {store} number={openNumber} onclose={closeCard} />{/await}
      {/key}
    {/if}
  </Sheet>

  {#if store.editable}
    {#await views.compose() then { default: Compose }}<Compose {store} />{/await}
  {:else}
    <Dialog bind:open={suggesting} title="提一条建议" description="说说你遇到的问题或想要的功能。内容会先发送给项目作者，不会直接公开。">
      <Textarea bind:value={suggestion} rows={4} maxlength={2000} placeholder="越具体越好，比如在什么情况下遇到了什么问题" aria-label="建议内容" />
      <input class="trap" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={honeypot} />
      {#snippet footer()}
        <Button onclick={() => (suggesting = false)}>取消</Button>
        <Button variant="primary" loading={sending} disabled={suggestion.trim().length < 4} onclick={submitSuggestion}>发送</Button>
      {/snippet}
    </Dialog>
  {/if}
{/if}

<style>
  .page {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
  }
  .center {
    justify-content: center;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 9px;
    flex: none;
    min-height: 56px;
    padding: 8px 20px;
  }
  h1 {
    font-size: var(--fs-lg);
    font-weight: 620;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .visibility {
    display: grid;
    color: var(--text-3);
  }
  .tabs {
    margin-left: 10px;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .spacer {
    flex: 1;
  }
  .mobile {
    display: none;
  }
  .description {
    padding: 0 20px 10px;
    color: var(--text-2);
    font-size: var(--fs-md);
  }
  .filters {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
    padding: 0 20px 10px;
  }
  .filters :global(.filter-search) {
    width: 190px;
    height: 26px;
    margin-right: 4px;
  }
  .filters :global(.filter-search input) {
    font-size: var(--fs-sm);
  }
  .powered {
    flex: none;
    padding: 0 20px 10px;
    color: var(--text-3);
    font-size: var(--fs-xs);
    text-align: center;
  }
  .skeleton-board {
    display: flex;
    gap: 10px;
    padding: 12px 20px;
  }
  .skeleton-column {
    flex: 0 0 286px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .trap {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  @media (max-width: 800px) {
    .head {
      flex-wrap: wrap;
      padding: 8px 12px;
    }
    .mobile {
      display: inline-flex;
      margin-left: -6px;
    }
    .tabs {
      order: 5;
      flex-basis: 100%;
      margin-left: 0;
    }
    .filters,
    .description {
      padding-inline: 12px;
    }
    .filters {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .filters :global(.filter-search) {
      flex: none;
      width: 140px;
    }
    .page :global(.board) {
      padding-inline: 12px;
    }
  }
</style>
