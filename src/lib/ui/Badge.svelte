<script lang="ts">
  import type { Snippet } from 'svelte';

  let { tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'success' | 'warning'; children: Snippet } = $props();
</script>

<span class="badge {tone}">{@render children()}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 7px;
    border-radius: var(--r-sm);
    font-size: var(--fs-xs);
    font-weight: 500;
    white-space: nowrap;
  }
  .neutral {
    background: var(--surface-active);
    color: var(--text-2);
  }
  .accent {
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .success {
    background: color-mix(in oklch, var(--success) 15%, transparent);
    color: color-mix(in oklch, var(--success) 62%, var(--text));
  }
  .warning {
    background: color-mix(in oklch, var(--warning) 17%, transparent);
    color: color-mix(in oklch, var(--warning) 58%, var(--text));
  }
</style>
