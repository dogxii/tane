<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Picker } from '../lib/ui';
  import type { Status } from '../lib/types';
  import StatusIcon from './StatusIcon.svelte';

  let {
    statuses,
    value,
    onselect,
    trigger,
  }: {
    statuses: Status[];
    value: number;
    onselect: (id: number) => void;
    trigger: Snippet<[any]>;
  } = $props();

  const items = $derived(statuses.map((s) => ({ value: s.id, label: s.name })));
  const categoryOf = (id: number) => statuses.find((s) => s.id === id)?.category ?? 'backlog';
</script>

<Picker {items} {value} searchable={false} onselect={(id) => onselect(id)} {trigger}>
  {#snippet leading(item)}<StatusIcon category={categoryOf(item.value)} />{/snippet}
</Picker>
