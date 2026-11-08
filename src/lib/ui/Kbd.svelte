<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<kbd>{@render children()}</kbd>

<style>
  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--bg-sunken);
    color: var(--text-2);
    font-family: var(--font);
    font-size: 10.5px;
    font-weight: 500;
    line-height: 1;
  }
</style>
