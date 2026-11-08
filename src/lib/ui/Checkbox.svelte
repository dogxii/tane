<script lang="ts">
  import Check from '@lucide/svelte/icons/check';

  let {
    checked = $bindable(false),
    disabled = false,
    label,
    onchange,
  }: { checked?: boolean; disabled?: boolean; label?: string; onchange?: (checked: boolean) => void } = $props();
</script>

<button
  type="button"
  role="checkbox"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class:checked
  onclick={(event) => {
    event.stopPropagation();
    checked = !checked;
    onchange?.(checked);
  }}
>
  {#if checked}<Check size={11} strokeWidth={3.2} />{/if}
</button>

<style>
  button {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 16px;
    height: 16px;
    border-radius: 4.5px;
    border: 1.5px solid var(--border-strong);
    background: var(--surface);
    color: var(--on-inverse);
    transition:
      background var(--fast),
      border-color var(--fast);
  }
  button:hover:not(:disabled) {
    border-color: var(--text-3);
  }
  .checked,
  .checked:hover:not(:disabled) {
    background: var(--inverse);
    border-color: var(--inverse);
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
</style>
