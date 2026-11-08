<script lang="ts">
  import type { Snippet } from 'svelte';

  let { label, hint, error, children }: { label: string; hint?: string; error?: string; children: Snippet } = $props();
</script>

<label class="field">
  <span class="label">{label}</span>
  {@render children()}
  {#if error}
    <span class="note error">{error}</span>
  {:else if hint}
    <span class="note">{hint}</span>
  {/if}
</label>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .label {
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--text-2);
  }
  .note {
    font-size: var(--fs-xs);
    color: var(--text-3);
  }
  .error {
    color: var(--danger);
  }
</style>
