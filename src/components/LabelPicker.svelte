<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Picker } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';

  let {
    store,
    value,
    onchange,
    trigger,
  }: {
    store: ProjectStore;
    value: number[];
    onchange: (labels: number[]) => void;
    trigger: Snippet<[any]>;
  } = $props();

  const items = $derived(store.labels.map((l) => ({ value: l.id, label: l.name, hue: l.hue })));

  function toggle(id: number) {
    onchange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }
</script>

<Picker
  {items}
  {value}
  multiple
  searchable
  placeholder="搜索或新建标签…"
  onselect={toggle}
  oncreate={async (name) => {
    const label = await store.createLabel(name);
    if (label) onchange([...value, label.id]);
  }}
  {trigger}
/>
