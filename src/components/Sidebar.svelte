<script lang="ts">
  import Search from '@lucide/svelte/icons/search';
  import Plus from '@lucide/svelte/icons/plus';
  import Settings from '@lucide/svelte/icons/settings';
  import Sun from '@lucide/svelte/icons/sun';
  import Moon from '@lucide/svelte/icons/moon';
  import Monitor from '@lucide/svelte/icons/monitor';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { Button, Kbd, Logo, ProjectIcon, tip } from '../lib/ui';

  const THEMES = { system: 'light', light: 'dark', dark: 'system' } as const;
  const themeIcon = $derived({ system: Monitor, light: Sun, dark: Moon }[session.theme]);
  const themeLabel = $derived({ system: '主题：跟随系统', light: '主题：浅色', dark: '主题：深色' }[session.theme]);

  const close = () => (session.sidebarOpen = false);
</script>

{#if session.sidebarOpen}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="scrim" onclick={close}></div>
{/if}

<nav class:open={session.sidebarOpen} aria-label="主导航">
  <div class="brand">
    <Logo />
    <span>Tane</span>
  </div>

  <button class="search" onclick={() => (session.paletteOpen = true)}>
    <Search size={14} strokeWidth={2} />
    <span>搜索</span>
    <span class="keys"><Kbd>⌘</Kbd><Kbd>K</Kbd></span>
  </button>

  <a href="/" class="link" class:current={router.path === '/'} onclick={close}>
    <LayoutGrid size={15} strokeWidth={1.9} /> 所有项目
  </a>

  <div class="section">
    <span>项目</span>
    <button aria-label="新建项目" use:tip={'新建项目'} onclick={() => (session.newProjectOpen = true)}><Plus size={14} strokeWidth={2} /></button>
  </div>

  <div class="projects">
    {#each session.projects as project (project.id)}
      <a href="/p/{project.slug}" class="link" class:current={router.path === `/p/${project.slug}`} onclick={close}>
        <ProjectIcon name={project.name} icon={project.icon} hue={project.hue} size={18} />
        <span class="name">{project.name}</span>
        {#if project.inbox}<span class="count tabular" use:tip={`${project.inbox} 条待处理反馈`}>{project.inbox}</span>{/if}
      </a>
    {/each}
  </div>

  <div class="foot">
    <a href="/settings" class="link" class:current={router.path === '/settings'} onclick={close}>
      <Settings size={15} strokeWidth={1.9} /> 设置
    </a>
    <span class="spacer"></span>
    <Button variant="ghost" size="sm" icon={themeIcon} tip={themeLabel} aria-label={themeLabel} onclick={() => session.setTheme(THEMES[session.theme])} />
  </div>
</nav>

<style>
  nav {
    flex: 0 0 232px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 10px 8px;
    border-right: 1px solid var(--border);
    background: var(--bg);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 32px;
    padding: 0 8px;
    margin-bottom: 8px;
    font-size: var(--fs-md);
    font-weight: 650;
    letter-spacing: -0.01em;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    margin-bottom: 6px;
    padding: 0 7px 0 9px;
    border-radius: var(--r-md);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-3);
    font-size: var(--fs-sm);
    transition: border-color var(--fast);
  }
  .search:hover {
    border-color: var(--border-strong);
  }
  .keys {
    display: inline-flex;
    gap: 2px;
    margin-left: auto;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 30px;
    padding: 0 8px;
    border-radius: var(--r-md);
    color: var(--text-2);
    font-size: var(--fs-sm);
    font-weight: 500;
    transition:
      background var(--fast),
      color var(--fast);
  }
  .link:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  .link.current {
    background: var(--surface-active);
    color: var(--text);
  }
  .section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 30px;
    margin-top: 10px;
    padding: 0 6px 0 8px;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .section button {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: var(--r-sm);
  }
  .section button:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  .projects {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-height: 0;
    overflow-y: auto;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .foot {
    display: flex;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
  .scrim {
    display: none;
  }
  @media (max-width: 800px) {
    nav {
      position: fixed;
      top: 0;
      bottom: 0;
      left: 0;
      z-index: 400;
      width: 260px;
      transform: translateX(-100%);
      transition: transform var(--normal) var(--ease);
    }
    nav.open {
      transform: none;
      box-shadow: var(--shadow-lg);
    }
    .scrim {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 390;
      background: var(--backdrop);
    }
  }
</style>
