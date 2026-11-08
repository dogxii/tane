<script lang="ts">
  import { flip } from 'svelte/animate';
  import { fly } from 'svelte/transition';
  import { toasts } from './toast.svelte';
</script>

<div class="toaster" role="status" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div
      class="toast"
      class:error={toast.tone === 'error'}
      animate:flip={{ duration: 160 }}
      transition:fly={{ y: 10, duration: 170 }}
    >
      <span>{toast.message}</span>
      {#if toast.action}
        <button
          onclick={() => {
            toast.action!.run();
            toasts.dismiss(toast.id);
          }}>{toast.action.label}</button
        >
      {/if}
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 900;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    pointer-events: none;
    max-width: calc(100vw - 32px);
  }
  .toast {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 14px;
    border-radius: var(--r-lg);
    background: var(--inverse);
    color: var(--on-inverse);
    font-size: var(--fs-sm);
    box-shadow: var(--shadow-lg);
  }
  .toast.error {
    background: var(--danger);
    color: white;
  }
  button {
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
</style>
