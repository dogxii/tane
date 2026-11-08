<script lang="ts">
  import type { Component, Snippet } from 'svelte';

  let {
    icon: Icon,
    title,
    description,
    children,
  }: { icon?: Component<any>; title: string; description?: string; children?: Snippet } = $props();
</script>

<div class="empty">
  {#if Icon}<span class="icon"><Icon size={18} strokeWidth={1.7} /></span>{/if}
  <h3>{title}</h3>
  {#if description}<p>{description}</p>{/if}
  {#if children}<div class="actions">{@render children()}</div>{/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 56px 24px;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-bottom: 12px;
    border-radius: var(--r-lg);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-2);
    box-shadow: var(--shadow-sm);
  }
  h3 {
    font-size: var(--fs-md);
    font-weight: 600;
  }
  p {
    margin-top: 3px;
    max-width: 340px;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }
</style>
