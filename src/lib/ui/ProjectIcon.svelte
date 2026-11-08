<script lang="ts">
  let { name, icon = '', hue, size = 20 }: { name: string; icon?: string; hue: number; size?: number } = $props();

  const glyph = $derived(icon || [...name.trim()][0]?.toUpperCase() || '?');
</script>

<span
  style:--h={hue}
  style:--size="{size}px"
  style:font-size="{Math.round(size * (icon ? 0.68 : 0.56))}px"
  aria-hidden="true">{glyph}</span
>

<style>
  span {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: calc(var(--size) * 0.28);
    background: oklch(var(--chip-bg-l) calc(var(--chip-bg-c) + 0.03) var(--h));
    color: oklch(var(--chip-fg-l) var(--chip-fg-c) var(--h));
    font-weight: 650;
    line-height: 1;
  }
</style>
