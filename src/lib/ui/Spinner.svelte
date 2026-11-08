<script lang="ts">
  let { size = 15 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-label="加载中" role="img">
  <circle cx="8" cy="8" r="6.2" stroke="currentColor" stroke-opacity=".22" stroke-width="1.8" />
  <path d="M14.2 8A6.2 6.2 0 0 0 8 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
</svg>

<style>
  svg {
    flex: none;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
