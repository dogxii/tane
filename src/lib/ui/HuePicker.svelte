<script lang="ts">
  const HUES = [25, 55, 85, 135, 165, 200, 235, 265, 300, 340];

  let { value = $bindable(255), onchange }: { value?: number; onchange?: (hue: number) => void } = $props();
</script>

<div role="radiogroup" aria-label="颜色">
  {#each HUES as hue (hue)}
    <button
      type="button"
      role="radio"
      aria-checked={value === hue}
      aria-label="色相 {hue}"
      style:--h={hue}
      class:selected={value === hue}
      onclick={() => {
        value = hue;
        onchange?.(hue);
      }}
    ></button>
  {/each}
</div>

<style>
  div {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  button {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: oklch(var(--dot-l) var(--dot-c) var(--h));
    transition: transform var(--fast) var(--ease);
  }
  button:hover {
    transform: scale(1.12);
  }
  .selected {
    box-shadow:
      0 0 0 2px var(--surface),
      0 0 0 3.5px oklch(var(--dot-l) var(--dot-c) var(--h));
  }
</style>
