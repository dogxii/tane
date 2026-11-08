<script lang="ts">
  import type { Snippet } from 'svelte';
  import { type Placement, place, portal, pushLayer } from './layers';

  let {
    open = $bindable(false),
    anchor,
    placement = 'bottom-start',
    children,
  }: { open?: boolean; anchor?: HTMLElement | null; placement?: Placement; children: Snippet } = $props();

  let el = $state<HTMLElement>();

  function reposition() {
    if (!el || !anchor) return;
    const { top, left } = place(anchor.getBoundingClientRect(), el.getBoundingClientRect(), placement);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }

  $effect(() => {
    if (!open || !el || !anchor) return;
    reposition();
    const popup = el;
    const trigger = anchor;
    const popLayer = pushLayer(() => (open = false));
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popup.contains(target) && !trigger.contains(target)) open = false;
    };
    const observer = new ResizeObserver(reposition);
    observer.observe(popup);
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      popLayer();
      observer.disconnect();
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  });
</script>

{#if open}
  <div bind:this={el} use:portal={anchor} class="popover">
    {@render children()}
  </div>
{/if}

<style>
  .popover {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 800;
    border-radius: var(--r-lg);
    border: 1px solid var(--border);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    animation: pop var(--fast) var(--ease);
  }
  @keyframes pop {
    from {
      opacity: 0;
      scale: 0.975;
    }
  }
</style>
