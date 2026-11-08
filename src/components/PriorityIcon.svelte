<script lang="ts">
  let { priority, size = 14 }: { priority: number; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
  {#if priority === 4}
    <rect x="1" y="1" width="12" height="12" rx="3" fill="var(--warning)" />
    <rect x="6.2" y="3.4" width="1.6" height="4.6" rx=".8" fill="white" />
    <circle cx="7" cy="10" r=".95" fill="white" />
  {:else if priority === 0}
    <g fill="var(--text-3)">
      <rect x="1.5" y="6.3" width="2.4" height="1.5" rx=".7" />
      <rect x="5.8" y="6.3" width="2.4" height="1.5" rx=".7" />
      <rect x="10.1" y="6.3" width="2.4" height="1.5" rx=".7" />
    </g>
  {:else}
    <rect x="1.5" y="8" width="2.8" height="4.5" rx=".8" fill="var(--text-2)" />
    <rect x="5.6" y="5" width="2.8" height="7.5" rx=".8" fill={priority >= 2 ? 'var(--text-2)' : 'var(--border-strong)'} />
    <rect x="9.7" y="2" width="2.8" height="10.5" rx=".8" fill={priority >= 3 ? 'var(--text-2)' : 'var(--border-strong)'} />
  {/if}
</svg>

<style>
  svg {
    display: block;
    flex: none;
  }
</style>
