<script lang="ts">
  import X from '@lucide/svelte/icons/x';

  let {
    label,
    hue,
    onremove,
  }: { label: string; hue?: number; onremove?: () => void } = $props();
</script>

<span class="chip" style:--h={hue} class:neutral={hue === undefined}>
  {#if hue !== undefined}<i></i>{/if}
  <span class="text">{label}</span>
  {#if onremove}
    <button aria-label="移除 {label}" onclick={onremove}><X size={10} strokeWidth={2.6} /></button>
  {/if}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 150px;
    height: 19px;
    padding: 0 6px;
    border-radius: 99px;
    border: 1px solid var(--border);
    color: var(--text-2);
    font-size: var(--fs-xs);
    line-height: 1;
    white-space: nowrap;
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  i {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: oklch(var(--dot-l) var(--dot-c) var(--h));
  }
  button {
    display: grid;
    place-items: center;
    color: var(--text-3);
  }
  button:hover {
    color: var(--text);
  }
</style>
