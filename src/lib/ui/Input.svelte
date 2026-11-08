<script lang="ts">
  import type { Component } from 'svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = HTMLInputAttributes & {
    value?: string;
    icon?: Component<any>;
    invalid?: boolean;
    el?: HTMLInputElement;
  };

  let { value = $bindable(''), icon: Icon, invalid = false, el = $bindable(), class: className = '', ...rest }: Props = $props();
</script>

<span class="wrap {className}" class:invalid>
  {#if Icon}<Icon size={14} strokeWidth={1.9} />{/if}
  <input bind:this={el} bind:value autocomplete="off" {...rest} />
</span>

<style>
  .wrap {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 32px;
    padding: 0 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-3);
    transition:
      border-color var(--fast),
      box-shadow var(--fast);
  }
  .wrap:hover {
    border-color: var(--border-strong);
  }
  :global(:root[data-keyboard]) .wrap:focus-within {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .wrap.invalid {
    border-color: var(--danger);
  }
  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    background: none;
    color: var(--text);
    font-size: var(--fs-md);
  }
  input:focus-visible {
    outline: none;
  }
</style>
