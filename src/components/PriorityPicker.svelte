<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Picker } from '../lib/ui';
  import { PRIORITIES } from '../lib/format';
  import PriorityIcon from './PriorityIcon.svelte';

  let {
    value,
    onselect,
    trigger,
  }: { value: number; onselect: (priority: number) => void; trigger: Snippet<[any]> } = $props();
</script>

<Picker items={PRIORITIES} {value} searchable={false} width={170} onselect={(p) => onselect(p)} {trigger}>
  {#snippet leading(item)}<PriorityIcon priority={item.value} />{/snippet}
</Picker>
