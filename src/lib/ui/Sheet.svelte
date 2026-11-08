<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { pushLayer } from './layers';

  let {
    open = $bindable(false),
    width = 680,
    label,
    onclose,
    children,
  }: { open?: boolean; width?: number; label?: string; onclose?: () => void; children: Snippet } = $props();

  function close() {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open) return;
    return pushLayer(close);
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div class="scrim" transition:fade={{ duration: 130 }} onclick={close}></div>
  <aside
    class="sheet"
    aria-label={label}
    style:--width="{width}px"
    transition:fly={{ x: 28, duration: 190, opacity: 0, easing: cubicOut }}
  >
    {@render children()}
  </aside>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 500;
    background: var(--backdrop);
  }
  .sheet {
    position: fixed;
    top: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 510;
    width: min(var(--width), calc(100vw - 16px));
    display: flex;
    flex-direction: column;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
  }
</style>
