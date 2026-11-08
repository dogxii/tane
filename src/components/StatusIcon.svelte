<script lang="ts">
  import type { Category } from '../lib/types';

  let { category, size = 14 }: { category: Category; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 14 14" fill="none" aria-hidden="true" class={category}>
  {#if category === 'backlog'}
    <circle cx="7" cy="7" r="5.6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2.1 2.3" stroke-linecap="round" />
  {:else if category === 'active'}
    <circle cx="7" cy="7" r="5.6" stroke="currentColor" stroke-width="1.5" />
    <path d="M7 3.6a3.4 3.4 0 0 1 0 6.8z" fill="currentColor" />
  {:else if category === 'done'}
    <circle cx="7" cy="7" r="6.3" fill="currentColor" />
    <path d="m4.3 7.2 1.9 1.9 3.5-3.9" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  {:else}
    <circle cx="7" cy="7" r="6.3" fill="currentColor" />
    <path d="m5 5 4 4m0-4-4 4" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round" />
  {/if}
</svg>

<style>
  svg {
    display: block;
    flex: none;
  }
  .backlog {
    color: var(--text-3);
  }
  .active {
    color: var(--warning);
  }
  .done {
    color: var(--accent);
  }
  .canceled {
    color: var(--text-3);
  }
</style>
