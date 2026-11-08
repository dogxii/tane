<script lang="ts">
  let { width = '100%', height = 14, radius = 5 }: { width?: string | number; height?: number; radius?: number } = $props();
</script>

<span style:width={typeof width === 'number' ? `${width}px` : width} style:height="{height}px" style:border-radius="{radius}px"></span>

<style>
  span {
    display: block;
    background: linear-gradient(90deg, var(--surface-active), var(--surface-hover), var(--surface-active));
    background-size: 200% 100%;
    animation: shimmer 1.4s linear infinite;
  }
  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }
</style>
