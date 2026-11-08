<script lang="ts" generics="T extends string">
  import type { Component } from 'svelte';

  let {
    items,
    value = $bindable(),
    onchange,
    label,
  }: {
    items: { value: T; label: string; icon?: Component<any> }[];
    value: T;
    onchange?: (value: T) => void;
    label?: string;
  } = $props();
</script>

<div class="segmented" role="tablist" aria-label={label}>
  {#each items as item (item.value)}
    <button
      role="tab"
      aria-selected={value === item.value}
      class:selected={value === item.value}
      onclick={() => {
        value = item.value;
        onchange?.(item.value);
      }}
    >
      {#if item.icon}<item.icon size={14} strokeWidth={1.9} />{/if}
      {item.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--r-md);
    background: var(--surface-active);
  }
  button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    border-radius: 5px;
    color: var(--text-2);
    font-size: var(--fs-sm);
    font-weight: 500;
    white-space: nowrap;
    transition:
      background var(--fast),
      color var(--fast);
  }
  button:hover {
    color: var(--text);
  }
  .selected {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-sm);
  }
</style>
