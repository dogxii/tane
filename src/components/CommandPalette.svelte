<script lang="ts">
  import { tick } from 'svelte';
  import Search from '@lucide/svelte/icons/search';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { Dialog, Kbd, ProjectIcon } from '../lib/ui';

  type Command = {
    id: string;
    group: string;
    label: string;
    hint?: string;
    keywords?: string;
    hue?: number;
    icon?: string;
    run: () => void;
  };

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLElement>();

  const commands = $derived.by<Command[]>(() => {
    const store = session.store;
    const result: Command[] = [];
    if (store?.editable && store.data) {
      result.push(
        { id: 'new', group: '操作', label: '新建卡片', hint: 'C', keywords: 'new create', run: () => { store.compose = {}; } },
        { id: 'new-project', group: '操作', label: '新建项目', keywords: 'new project', run: () => (session.newProjectOpen = true) },
        { id: 'board', group: '视图', label: '看板', hint: 'B', keywords: 'board', run: () => router.setQuery({ view: null, card: null }) },
        { id: 'list', group: '视图', label: '列表', hint: 'L', keywords: 'list table', run: () => router.setQuery({ view: 'list', card: null }) },
        { id: 'feedback', group: '视图', label: '反馈收件箱', hint: 'F', keywords: 'feedback inbox', run: () => router.setQuery({ view: 'feedback', card: null }) },
        { id: 'releases', group: '视图', label: '版本', hint: 'R', keywords: 'release changelog', run: () => router.setQuery({ view: 'releases', card: null }) },
        { id: 'settings', group: '视图', label: '项目设置', keywords: 'settings', run: () => router.setQuery({ view: 'settings', card: null }) },
      );
    }
    if (!store?.editable) {
      result.push({ id: 'new-project', group: '操作', label: '新建项目', keywords: 'new project', run: () => (session.newProjectOpen = true) });
    }
    for (const project of session.projects) {
      result.push({
        id: `p${project.id}`,
        group: '项目',
        label: project.name,
        keywords: project.slug,
        hue: project.hue,
        icon: project.icon,
        run: () => router.go(`/p/${project.slug}`),
      });
    }
    result.push(
      { id: 'theme-light', group: '外观', label: '浅色主题', keywords: 'light theme', run: () => session.setTheme('light') },
      { id: 'theme-dark', group: '外观', label: '深色主题', keywords: 'dark theme', run: () => session.setTheme('dark') },
      { id: 'theme-system', group: '外观', label: '跟随系统', keywords: 'system theme', run: () => session.setTheme('system') },
      { id: 'tokens', group: '外观', label: '账户与 Agent Token', keywords: 'settings token', run: () => router.go('/settings') },
      { id: 'shortcuts', group: '外观', label: '键盘快捷键', hint: '?', keywords: 'keyboard help', run: () => (session.shortcutsOpen = true) },
    );
    if (store?.data) {
      for (const card of store.cards) {
        if (card.id < 0) continue;
        result.push({
          id: `c${card.id}`,
          group: '卡片',
          label: card.title,
          hint: `${store.project.key}-${card.number}`,
          keywords: `${card.number} ${card.keywords ?? ''}`,
          run: () => router.setQuery({ card: card.number }),
        });
      }
    }
    return result;
  });

  const visible = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? commands.filter((c) => `${c.label} ${c.keywords ?? ''} ${c.hint ?? ''}`.toLowerCase().includes(needle))
      : commands.filter((c) => c.group !== '卡片');
    return matched.slice(0, 60);
  });

  $effect(() => {
    if (!session.paletteOpen) return;
    query = '';
    active = 0;
    tick().then(() => input?.focus());
  });

  $effect(() => {
    void query;
    active = 0;
  });

  function run(command: Command | undefined) {
    if (!command) return;
    session.paletteOpen = false;
    command.run();
  }

  function onkeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!visible.length) return;
      active = (active + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
      tick().then(() => list?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
    } else if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      run(visible[active]);
    }
  }
</script>

<Dialog bind:open={session.paletteOpen} width={560}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="palette" {onkeydown}>
    <div class="search">
      <Search size={15} strokeWidth={2} />
      <input bind:this={input} bind:value={query} placeholder="搜索卡片、项目或操作…" autocomplete="off" aria-label="命令搜索" />
      <Kbd>Esc</Kbd>
    </div>
    <div class="list" bind:this={list} role="listbox">
      {#each visible as command, index (command.id)}
        {#if index === 0 || visible[index - 1].group !== command.group}
          <div class="group">{command.group}</div>
        {/if}
        <button
          role="option"
          aria-selected={index === active}
          data-active={index === active}
          onpointermove={() => (active = index)}
          onclick={() => run(command)}
        >
          {#if command.hue !== undefined}<ProjectIcon name={command.label} icon={command.icon} hue={command.hue} size={18} />{/if}
          <span class="label">{command.label}</span>
          {#if command.hint}<span class="hint">{command.hint}</span>{/if}
        </button>
      {:else}
        <div class="none">没有结果</div>
      {/each}
    </div>
  </div>
</Dialog>

<style>
  .palette {
    margin: -14px -20px -18px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px 16px;
    border-bottom: 1px solid var(--border);
    color: var(--text-3);
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--text);
    font-size: var(--fs-lg);
  }
  input:focus-visible {
    outline: none;
  }
  .list {
    max-height: min(400px, 56dvh);
    padding: 6px;
    overflow-y: auto;
  }
  .group {
    padding: 8px 10px 4px;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  button {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    height: 36px;
    padding: 0 10px;
    border-radius: var(--r-md);
    text-align: left;
  }
  button[data-active='true'] {
    background: var(--surface-hover);
  }
  button:focus-visible {
    outline: none;
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    flex: none;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .none {
    padding: 28px;
    text-align: center;
    color: var(--text-3);
  }
</style>
