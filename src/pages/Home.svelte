<script lang="ts">
  import Plus from '@lucide/svelte/icons/plus';
  import Menu from '@lucide/svelte/icons/menu';
  import FolderKanban from '@lucide/svelte/icons/folder-kanban';
  import Globe from '@lucide/svelte/icons/globe';
  import Lock from '@lucide/svelte/icons/lock';
  import { session } from '../lib/session.svelte';
  import { Button, Empty, ProjectIcon } from '../lib/ui';
</script>

<div class="page">
  <header>
    <span class="mobile"><Button variant="ghost" icon={Menu} aria-label="打开导航" onclick={() => (session.sidebarOpen = true)} /></span>
    <h1>所有项目</h1>
    <span class="spacer"></span>
    <Button variant="primary" icon={Plus} onclick={() => (session.newProjectOpen = true)}>新建项目</Button>
  </header>

  {#if !session.projects.length}
    <Empty icon={FolderKanban} title="创建你的第一个项目" description="每个项目都有独立的看板、反馈收件箱和更新日志。">
      <Button variant="primary" icon={Plus} onclick={() => (session.newProjectOpen = true)}>新建项目</Button>
    </Empty>
  {:else}
    <div class="grid">
      {#each session.projects as project (project.id)}
        <a href="/p/{project.slug}" class="tile">
          <div class="top">
            <ProjectIcon name={project.name} icon={project.icon} hue={project.hue} size={32} />
            <span class="visibility">
              {#if project.visibility === 'public'}<Globe size={12} strokeWidth={2} /> 公开{:else}<Lock size={12} strokeWidth={2} /> 私有{/if}
            </span>
          </div>
          <h2>{project.name}</h2>
          {#if project.description}<p>{project.description}</p>{/if}
          <div class="stats tabular">
            <span><strong>{project.open_cards ?? 0}</strong> 进行中和待办</span>
            {#if project.inbox}<span class="inbox"><strong>{project.inbox}</strong> 条待处理反馈</span>{/if}
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    padding: 0 28px 40px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 72px;
  }
  h1 {
    font-size: var(--fs-xl);
    font-weight: 620;
    letter-spacing: -0.01em;
  }
  .spacer {
    flex: 1;
  }
  .mobile {
    display: none;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
    gap: 12px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    padding: 15px 16px;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
    transition:
      border-color var(--fast),
      box-shadow var(--normal) var(--ease),
      transform var(--normal) var(--ease);
  }
  .tile:hover {
    border-color: var(--border-strong);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 11px;
  }
  .visibility {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  h2 {
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  p {
    margin-top: 2px;
    color: var(--text-2);
    font-size: var(--fs-sm);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 14px;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  strong {
    color: var(--text);
    font-weight: 600;
  }
  .inbox strong {
    color: var(--accent-text);
  }
  @media (max-width: 800px) {
    .page {
      padding-inline: 14px;
    }
    .mobile {
      display: inline-flex;
      margin-left: -6px;
    }
  }
</style>
