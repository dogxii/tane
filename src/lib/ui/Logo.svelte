<script lang="ts">
  let { size = 20 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
  <rect class="tile" width="32" height="32" rx="8" />
  <path class="mark" d="M16 20.500C16 13.500 11.800 8.500 6 8.500c0 7 3.900 12 10 12Z" />
  <path class="mark" opacity=".7" d="M16 17.500c0-5.600 3.900-10 10-10 0 6-3.900 10-10 10Z" />
  <rect class="mark" x="14.800" y="16.500" width="2.400" height="9" rx="1.200" />
</svg>

<style>
  svg {
    flex: none;
    display: block;
  }
  .tile {
    fill: var(--inverse);
  }
  .mark {
    fill: var(--on-inverse);
  }
</style>
