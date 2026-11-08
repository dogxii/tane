<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pushLayer } from './layers';

  let {
    open = $bindable(false),
    title,
    description,
    width = 440,
    children,
    footer,
  }: {
    open?: boolean;
    title?: string;
    description?: string;
    width?: number;
    children: Snippet;
    footer?: Snippet;
  } = $props();

  let el = $state<HTMLDialogElement>();

  $effect(() => {
    if (!open || !el) return;
    const dialog = el;
    dialog.showModal();
    const popLayer = pushLayer(() => (open = false));
    return () => {
      popLayer();
      dialog.close();
    };
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
  <dialog
    bind:this={el}
    style:--width="{width}px"
    aria-label={title}
    onclick={(event) => {
      if (event.target === el) open = false;
    }}
  >
    <div class="panel">
      {#if title}
        <header>
          <h2>{title}</h2>
          {#if description}<p>{description}</p>{/if}
        </header>
      {/if}
      <div class="body">{@render children()}</div>
      {#if footer}<footer>{@render footer()}</footer>{/if}
    </div>
  </dialog>
{/if}

<style>
  dialog {
    width: min(var(--width), calc(100vw - 32px));
    max-height: calc(100dvh - 48px);
    margin: 12vh auto auto;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--r-xl);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-lg);
    overflow: visible;
    animation: rise var(--normal) var(--ease);
  }
  dialog::backdrop {
    background: var(--backdrop);
    animation: fade var(--normal) var(--ease);
  }
  .panel {
    display: flex;
    flex-direction: column;
    max-height: inherit;
  }
  header {
    padding: 18px 20px 0;
  }
  h2 {
    font-size: var(--fs-lg);
    font-weight: 600;
  }
  p {
    margin-top: 3px;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }
  .body {
    padding: 14px 20px 18px;
    overflow-y: auto;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
  }
  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 8px;
      scale: 0.985;
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
