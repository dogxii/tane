<script lang="ts">
  import Rocket from '@lucide/svelte/icons/rocket';
  import { fullDate } from '../lib/format';
  import { renderMarkdown } from '../lib/markdown';
  import { Empty } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';

  let { store }: { store: ProjectStore } = $props();
</script>

<div class="scroll">
  {#if !store.releases.length}
    <Empty icon={Rocket} title="还没有更新日志" description="发布新版本后，会显示在这里。" />
  {:else}
    <ol>
      {#each store.releases as release (release.id)}
        <li>
          <time>{fullDate(release.published_at ?? release.created_at)}</time>
          <div class="entry">
            <h2>{release.name}</h2>
            {#if release.body}
              <div class="prose">{@html renderMarkdown(release.body)}</div>
            {/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .scroll {
    flex: 1;
    min-height: 0;
    padding: 12px 20px 48px;
    overflow-y: auto;
  }
  ol {
    list-style: none;
    max-width: 720px;
    margin: 0 auto;
    padding: 0;
  }
  li {
    display: flex;
    gap: 24px;
    padding: 20px 0;
    border-bottom: 1px solid var(--border);
  }
  li:last-child {
    border-bottom: 0;
  }
  time {
    flex: 0 0 120px;
    padding-top: 3px;
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
  .entry {
    flex: 1;
    min-width: 0;
  }
  h2 {
    margin-bottom: 8px;
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  @media (max-width: 560px) {
    li {
      flex-direction: column;
      gap: 4px;
    }
    time {
      flex: none;
    }
  }
</style>
