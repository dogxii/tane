<script lang="ts">
  import type { Component, Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import Spinner from './Spinner.svelte';
  import { tip as tooltip } from './tooltip';

  type Props = HTMLButtonAttributes & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    icon?: Component<any>;
    loading?: boolean;
    active?: boolean;
    tip?: string;
    el?: HTMLButtonElement;
    children?: Snippet;
  };

  let {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    loading = false,
    active = false,
    tip,
    el = $bindable(),
    children,
    class: className = '',
    type = 'button',
    disabled,
    ...rest
  }: Props = $props();

  const iconSize = $derived(size === 'sm' ? 14 : 15);
</script>

<button
  bind:this={el}
  use:tooltip={tip}
  {type}
  disabled={disabled || loading}
  class="btn {variant} {size} {className}"
  class:square={!children}
  class:active
  {...rest}
>
  {#if loading}
    <Spinner size={iconSize} />
  {:else if Icon}
    <Icon size={iconSize} strokeWidth={1.9} />
  {/if}
  {#if children}<span class="content">{@render children()}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    flex: none;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    font-weight: 500;
    white-space: nowrap;
    user-select: none;
    transition:
      background var(--fast),
      border-color var(--fast),
      color var(--fast),
      transform var(--fast) var(--ease);
  }
  .btn:active:not(:disabled) {
    transform: scale(0.975);
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .sm {
    height: 26px;
    padding: 0 8px;
    font-size: var(--fs-sm);
  }
  .md {
    height: 32px;
    padding: 0 12px;
    font-size: var(--fs-md);
  }
  .lg {
    height: 38px;
    padding: 0 16px;
    font-size: var(--fs-md);
  }
  .square.sm {
    width: 26px;
    padding: 0;
  }
  .square.md {
    width: 32px;
    padding: 0;
  }
  .square.lg {
    width: 38px;
    padding: 0;
  }

  .primary {
    background: var(--inverse);
    color: var(--on-inverse);
  }
  .primary:hover:not(:disabled) {
    background: var(--inverse-hover);
  }

  .secondary {
    background: var(--surface);
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
  }
  .secondary:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--border-strong);
  }

  .ghost {
    color: var(--text-2);
  }
  .ghost:hover:not(:disabled),
  .ghost.active {
    background: var(--surface-hover);
    color: var(--text);
  }

  .danger {
    background: var(--danger);
    color: white;
  }
  .danger:hover:not(:disabled) {
    filter: brightness(1.07);
  }
</style>
