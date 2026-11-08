<script lang="ts">
  let {
    checked = $bindable(false),
    disabled = false,
    label,
    onchange,
  }: { checked?: boolean; disabled?: boolean; label?: string; onchange?: (checked: boolean) => void } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class:checked
  onclick={() => {
    checked = !checked;
    onchange?.(checked);
  }}
>
  <span></span>
</button>

<style>
  button {
    position: relative;
    flex: none;
    width: 30px;
    height: 18px;
    border-radius: 99px;
    background: var(--border-strong);
    transition: background var(--normal) var(--ease);
  }
  span {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 2px oklch(0 0 0 / 0.25);
    transition: transform var(--normal) var(--ease);
  }
  .checked {
    background: var(--accent);
  }
  .checked span {
    transform: translateX(12px);
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
