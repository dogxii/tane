<script lang="ts">
  import Rocket from '@lucide/svelte/icons/rocket';
  import Plus from '@lucide/svelte/icons/plus';
  import Sparkles from '@lucide/svelte/icons/list-plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { api } from '../lib/api';
  import { fullDate } from '../lib/format';
  import { Badge, Button, Dialog, Empty, Input, Picker, Textarea } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Card, Release } from '../lib/types';
  import StatusIcon from './StatusIcon.svelte';

  let { store, onopen }: { store: ProjectStore; onopen: (card: Card) => void } = $props();

  let selectedId = $state<number | null>(null);
  let confirming = $state<'publish' | 'delete' | null>(null);

  const selected = $derived(store.releases.find((r) => r.id === selectedId) ?? store.releases[0]);
  const members = $derived(selected ? store.cards.filter((c) => c.release_id === selected.id) : []);
  const memberIds = $derived(members.map((c) => c.number));
  const cardItems = $derived(
    store.cards.filter((c) => c.id > 0).map((c) => ({ value: c.number, label: c.title, hint: `#${c.number}` })),
  );

  async function create() {
    const count = store.releases.length + 1;
    const result = await store.mutate(null, async () => {
      const { release } = await api.post<{ release: Release }>(`${store.base}/releases`, { name: `版本 ${count}` });
      store.data!.releases.unshift(release);
      return release;
    });
    if (result) selectedId = result.id;
  }

  function patch(release: Release, payload: Partial<Release>) {
    store.mutate(
      () => Object.assign(release, payload),
      () => api.patch(`${store.base}/releases/${release.id}`, payload),
    );
  }

  function toggleMember(number: number) {
    const card = store.card(number);
    if (!card || !selected) return;
    const release_id = card.release_id === selected.id ? null : selected.id;
    store.updateCard(card, { release_id }, { release_id });
  }

  function draftNotes() {
    if (!selected) return;
    const lines = members
      .filter((c) => store.status(c.status_id)?.category === 'done' && !c.is_private)
      .map((c) => `- ${c.title}`);
    if (!lines.length) return;
    patch(selected, { body: selected.body ? `${selected.body}\n${lines.join('\n')}` : lines.join('\n') });
  }

  function confirmAction() {
    if (!selected) return;
    if (confirming === 'publish') {
      const publishing = selected.status === 'draft';
      patch(selected, { status: publishing ? 'published' : 'draft' });
    } else if (confirming === 'delete') {
      const id = selected.id;
      store.data!.releases = store.releases.filter((r) => r.id !== id);
      for (const card of store.cards) if (card.release_id === id) card.release_id = null;
      store.send('del', `/releases/${id}`);
      selectedId = null;
    }
    confirming = null;
  }
</script>

{#if !store.releases.length}
  <div class="center">
    <Empty icon={Rocket} title="还没有版本" description="把卡片打包成一个版本，写好说明后发布到公开的更新日志。">
      <Button variant="primary" icon={Plus} onclick={create}>新建版本</Button>
    </Empty>
  </div>
{:else if selected}
  <div class="split">
    <nav aria-label="版本列表">
      <Button variant="ghost" size="sm" icon={Plus} onclick={create}>新建版本</Button>
      {#each store.releases as release (release.id)}
        <button class="release" class:selected={release.id === selected.id} onclick={() => (selectedId = release.id)}>
          <span class="name">{release.name}</span>
          {#if release.status === 'draft'}<Badge>草稿</Badge>{:else}<span class="date">{fullDate(release.published_at!)}</span>{/if}
        </button>
      {/each}
    </nav>

    {#key selected.id}
      <div class="editor">
        <div class="heading">
          <Input
            value={selected.name}
            class="name-input"
            aria-label="版本名称"
            onblur={(event) => {
              const name = event.currentTarget.value.trim();
              if (name && name !== selected.name) patch(selected, { name });
            }}
          />
          {#if selected.status === 'published'}<Badge tone="success">已发布</Badge>{/if}
          <span class="spacer"></span>
          <Button variant="ghost" icon={Trash2} tip="删除版本" aria-label="删除版本" onclick={() => (confirming = 'delete')} />
          <Button variant={selected.status === 'draft' ? 'primary' : 'secondary'} onclick={() => (confirming = 'publish')}>
            {selected.status === 'draft' ? '发布' : '撤回发布'}
          </Button>
        </div>

        <section>
          <div class="section-head">
            <h4>更新说明</h4>
            <Button variant="ghost" size="sm" icon={Sparkles} disabled={!members.length} onclick={draftNotes}>从已完成卡片填入</Button>
          </div>
          <Textarea
            value={selected.body}
            rows={8}
            placeholder="这个版本改了什么？支持 Markdown"
            aria-label="更新说明"
            onblur={(event) => {
              const body = event.currentTarget.value.trim();
              if (body !== selected.body) patch(selected, { body });
            }}
          />
        </section>

        <section>
          <div class="section-head">
            <h4>包含的卡片 <span class="tabular">{members.length}</span></h4>
            <Picker items={cardItems} value={memberIds} multiple searchable placeholder="搜索卡片…" width={320} placement="bottom-end" onselect={toggleMember}>
              {#snippet trigger(props)}
                <Button variant="ghost" size="sm" icon={Plus} {...props}>选择卡片</Button>
              {/snippet}
            </Picker>
          </div>
          {#each members as card (card.id)}
            {@const status = store.status(card.status_id)}
            <button class="member" onclick={() => onopen(card)}>
              {#if status}<StatusIcon category={status.category} />{/if}
              <span class="id tabular">{store.project.key}-{card.number}</span>
              <span class="member-title">{card.title}</span>
            </button>
          {:else}
            <p class="none">还没有卡片。</p>
          {/each}
        </section>
      </div>
    {/key}
  </div>

  <Dialog
    bind:open={() => confirming !== null, (value) => { if (!value) confirming = null; }}
    title={confirming === 'delete' ? `删除“${selected.name}”？` : selected.status === 'draft' ? `发布“${selected.name}”？` : `撤回“${selected.name}”？`}
    description={confirming === 'delete'
      ? '卡片会保留，只是不再属于这个版本。删除后无法恢复。'
      : selected.status === 'draft'
        ? store.project.visibility === 'public'
          ? '发布后，所有访问公开看板的人都能在更新日志里看到它。'
          : '项目目前是私有的，开启公开访问后更新日志才对外可见。'
        : '撤回后，它会从公开的更新日志中消失。'}
  >
    <div></div>
    {#snippet footer()}
      <Button onclick={() => (confirming = null)}>取消</Button>
      <Button variant={confirming === 'delete' ? 'danger' : 'primary'} onclick={confirmAction}>确认</Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .center {
    flex: 1;
  }
  .split {
    flex: 1;
    display: flex;
    gap: 16px;
    min-height: 0;
    padding: 0 20px 20px;
  }
  nav {
    flex: 0 0 220px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    overflow-y: auto;
  }
  .release {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 34px;
    padding: 4px 9px;
    border-radius: var(--r-md);
    text-align: left;
    transition: background var(--fast);
  }
  .release:hover {
    background: var(--surface-hover);
  }
  .release.selected {
    background: var(--surface-active);
  }
  .name {
    font-size: var(--fs-sm);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .date {
    flex: none;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .editor {
    flex: 1;
    min-width: 0;
    max-width: 760px;
    padding: 16px 18px 24px;
    overflow-y: auto;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  .heading {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .heading :global(.name-input) {
    width: 240px;
    font-weight: 600;
  }
  .spacer {
    flex: 1;
  }
  section {
    margin-top: 20px;
  }
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  h4 {
    font-size: var(--fs-sm);
    font-weight: 600;
  }
  h4 span {
    margin-left: 4px;
    color: var(--text-3);
    font-weight: 400;
  }
  .member {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 32px;
    padding: 0 8px;
    border-radius: var(--r-md);
    text-align: left;
  }
  .member:hover {
    background: var(--surface-hover);
  }
  .id {
    flex: none;
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .member-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .none {
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
  @media (max-width: 720px) {
    .split {
      flex-direction: column;
      overflow-y: auto;
    }
    nav {
      flex: none;
      overflow: visible;
    }
    .editor {
      overflow: visible;
    }
  }
</style>
