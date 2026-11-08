<script lang="ts">
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import ArrowDown from '@lucide/svelte/icons/arrow-down';
  import Copy from '@lucide/svelte/icons/copy';
  import Plus from '@lucide/svelte/icons/plus';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { api } from '../lib/api';
  import { CATEGORY_LABELS } from '../lib/format';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { Button, Dialog, Field, HuePicker, Input, Picker, ProjectIcon, Switch, toasts } from '../lib/ui';
  import type { ProjectStore } from '../lib/store.svelte';
  import type { Category, Label, Status } from '../lib/types';
  import StatusIcon from './StatusIcon.svelte';

  let { store }: { store: ProjectStore } = $props();

  const project = $derived(store.project);
  const publicUrl = $derived(`${location.origin}/p/${project.slug}`);
  const collectUrl = $derived(`${location.origin}/f/${project.slug}`);

  let goingPublic = $state(false);
  let deleting = $state(false);
  let confirmSlug = $state('');
  let newStatus = $state('');
  let newLabel = $state('');

  const categoryItems = (Object.keys(CATEGORY_LABELS) as Category[]).map((value) => ({ value, label: CATEGORY_LABELS[value] }));

  async function update(payload: Record<string, unknown>) {
    await store.updateProject(payload);
    void session.refreshProjects();
  }

  function saveText(field: 'name' | 'description' | 'icon' | 'key', value: string) {
    const next = value.trim();
    if (next === project[field] || (field !== 'description' && field !== 'icon' && !next)) return;
    void update({ [field]: field === 'key' ? next.toUpperCase() : next });
  }

  function setVisibility(isPublic: boolean) {
    if (isPublic) goingPublic = true;
    else void update({ visibility: 'private' });
  }

  function copyLink(url: string) {
    navigator.clipboard?.writeText(url);
    toasts.show('链接已复制');
  }

  // Statuses

  function moveStatus(status: Status, direction: -1 | 1) {
    const list = store.statuses;
    const index = list.findIndex((s) => s.id === status.id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const next = list.filter((s) => s.id !== status.id);
    next.splice(target, 0, status);
    store.data!.statuses = next;
    store.send('patch', `/statuses/${status.id}`, { after: target > 0 ? next[target - 1].id : null });
  }

  function renameStatus(status: Status, value: string) {
    const name = value.trim();
    if (!name || name === status.name) return;
    status.name = name;
    store.send('patch', `/statuses/${status.id}`, { name });
  }

  function setCategory(status: Status, category: Category) {
    status.category = category;
    store.send('patch', `/statuses/${status.id}`, { category });
  }

  function deleteStatus(status: Status) {
    const fallback = store.statuses.find((s) => s.id !== status.id);
    if (!fallback) return;
    const moved = store.cards.filter((c) => c.status_id === status.id);
    store.data!.statuses = store.statuses.filter((s) => s.id !== status.id);
    for (const card of moved) card.status_id = fallback.id;
    store.send('del', `/statuses/${status.id}?move_to=${fallback.id}`);
    if (moved.length) toasts.show(`${moved.length} 张卡片已移到“${fallback.name}”`);
  }

  function addStatus() {
    const name = newStatus.trim();
    if (!name) return;
    newStatus = '';
    store.send('post', '/statuses', { name, category: 'backlog' });
  }

  // Labels

  function renameLabel(label: Label, value: string) {
    const name = value.trim();
    if (!name || name === label.name) return;
    label.name = name;
    store.send('patch', `/labels/${label.id}`, { name });
  }

  function deleteLabel(label: Label) {
    store.data!.labels = store.labels.filter((l) => l.id !== label.id);
    for (const card of store.cards) card.label_ids = card.label_ids.filter((id) => id !== label.id);
    store.send('del', `/labels/${label.id}`);
  }

  function addLabel() {
    const name = newLabel.trim();
    if (!name) return;
    newLabel = '';
    store.createLabel(name);
  }

  async function deleteProject() {
    try {
      await api.del(store.base, { confirm: confirmSlug });
      await session.refreshProjects();
      router.go('/');
      toasts.show('项目已删除');
    } catch {
      toasts.error('删除失败，请确认 slug 输入正确');
    }
  }

  const submitOnEnter = (event: KeyboardEvent, run: () => void) => {
    if (event.key === 'Enter' && !event.isComposing) run();
  };
  const blurOnEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') (event.currentTarget as HTMLElement).blur();
  };
</script>

<div class="scroll">
  <div class="sections">
    <section>
      <h3>基本信息</h3>
      <div class="identity">
        <ProjectIcon name={project.name} icon={project.icon} hue={project.hue} size={44} />
        <HuePicker value={project.hue} onchange={(hue) => update({ hue })} />
      </div>
      <div class="grid">
        <Field label="名称">
          <Input value={project.name} onblur={(e) => saveText('name', e.currentTarget.value)} onkeydown={blurOnEnter} />
        </Field>
        <Field label="图标" hint="一个 Emoji，留空则显示首字">
          <Input value={project.icon} maxlength={8} onblur={(e) => saveText('icon', e.currentTarget.value)} onkeydown={blurOnEnter} />
        </Field>
        <Field label="编号前缀" hint="卡片显示为 {project.key}-12">
          <Input value={project.key} maxlength={6} onblur={(e) => saveText('key', e.currentTarget.value)} onkeydown={blurOnEnter} />
        </Field>
        <Field label="简介">
          <Input value={project.description} onblur={(e) => saveText('description', e.currentTarget.value)} onkeydown={blurOnEnter} />
        </Field>
      </div>
    </section>

    <section>
      <h3>公开访问</h3>
      <div class="option">
        <div>
          <strong>公开看板</strong>
          <p>任何人都能通过链接查看看板和更新日志。用户反馈原文、动态和“不做”列始终不公开。</p>
        </div>
        <Switch checked={project.visibility === 'public'} label="公开看板" onchange={setVisibility} />
      </div>
      {#if project.visibility === 'public'}
        <div class="public-link">
          <code>{publicUrl}</code>
          <Button size="sm" icon={Copy} onclick={() => copyLink(publicUrl)}>复制</Button>
          <Button size="sm" onclick={() => window.open(publicUrl, '_blank', 'noopener')}>打开</Button>
        </div>
        <div class="option">
          <div><strong>允许提交建议</strong><p>访客提交的内容只进入你的反馈收件箱，不会直接公开。</p></div>
          <Switch checked={!!project.allow_submissions} label="允许提交建议" onchange={(v) => update({ allow_submissions: v })} />
        </div>
      {/if}
    </section>

    <section>
      <h3>反馈收集</h3>
      <div class="option">
        <div>
          <strong>反馈收集页</strong>
          <p>任何人都能通过链接提交反馈，内容只进入你的收件箱。页面只显示项目名称和图标，看板可以继续保持私有。</p>
        </div>
        <Switch checked={!!project.collect_enabled} label="反馈收集页" onchange={(v) => update({ collect_enabled: v })} />
      </div>
      {#if project.collect_enabled}
        <div class="public-link">
          <code>{collectUrl}</code>
          <Button size="sm" icon={Copy} onclick={() => copyLink(collectUrl)}>复制</Button>
          <Button size="sm" onclick={() => window.open(collectUrl, '_blank', 'noopener')}>打开</Button>
        </div>
      {/if}
    </section>

    <section>
      <h3>工作流状态</h3>
      <div class="rows">
        {#each store.statuses as status, index (status.id)}
          <div class="row">
            <StatusIcon category={status.category} />
            <input class="inline" value={status.name} aria-label="状态名称" onblur={(e) => renameStatus(status, e.currentTarget.value)} onkeydown={blurOnEnter} />
            <Picker items={categoryItems} value={status.category} searchable={false} width={130} placement="bottom-end" onselect={(c) => setCategory(status, c)}>
              {#snippet trigger(props)}
                <Button variant="ghost" size="sm" {...props}>{CATEGORY_LABELS[status.category]}</Button>
              {/snippet}
            </Picker>
            <Button variant="ghost" size="sm" icon={ArrowUp} disabled={index === 0} aria-label="上移" onclick={() => moveStatus(status, -1)} />
            <Button variant="ghost" size="sm" icon={ArrowDown} disabled={index === store.statuses.length - 1} aria-label="下移" onclick={() => moveStatus(status, 1)} />
            <Button variant="ghost" size="sm" icon={Trash2} disabled={store.statuses.length === 1} aria-label="删除状态" onclick={() => deleteStatus(status)} />
          </div>
        {/each}
      </div>
      <div class="adder">
        <Input icon={Plus} bind:value={newStatus} placeholder="新增状态，回车确认" onkeydown={(e) => submitOnEnter(e, addStatus)} />
      </div>
    </section>

    <section>
      <h3>标签</h3>
      <div class="rows">
        {#each store.labels as label (label.id)}
          <div class="row">
            <i style:--h={label.hue}></i>
            <input class="inline" value={label.name} aria-label="标签名称" onblur={(e) => renameLabel(label, e.currentTarget.value)} onkeydown={blurOnEnter} />
            <Button variant="ghost" size="sm" icon={Trash2} aria-label="删除标签" onclick={() => deleteLabel(label)} />
          </div>
        {:else}
          <p class="none">还没有标签。</p>
        {/each}
      </div>
      <div class="adder">
        <Input icon={Plus} bind:value={newLabel} placeholder="新增标签，回车确认" onkeydown={(e) => submitOnEnter(e, addLabel)} />
      </div>
    </section>

    <section class="danger">
      <h3>危险操作</h3>
      <div class="option">
        <div><strong>删除项目</strong><p>卡片、反馈和版本都会被永久删除，无法恢复。</p></div>
        <Button onclick={() => { confirmSlug = ''; deleting = true; }}>删除项目</Button>
      </div>
    </section>
  </div>
</div>

<Dialog bind:open={goingPublic} title="公开这个看板？" description="拿到链接的任何人都能看到卡片标题、描述、标签和更新日志。标记为“仅自己可见”的卡片不会显示，Agent 创建的卡片默认如此，需要你逐张公开。">
  <div></div>
  {#snippet footer()}
    <Button onclick={() => (goingPublic = false)}>取消</Button>
    <Button variant="primary" onclick={() => { goingPublic = false; void update({ visibility: 'public' }); }}>公开看板</Button>
  {/snippet}
</Dialog>

<Dialog bind:open={deleting} title="永久删除项目？" description="请输入 {project.slug} 确认。此操作无法撤销。">
  <Input bind:value={confirmSlug} placeholder={project.slug} aria-label="确认 slug" />
  {#snippet footer()}
    <Button onclick={() => (deleting = false)}>取消</Button>
    <Button variant="danger" disabled={confirmSlug !== project.slug} onclick={deleteProject}>永久删除</Button>
  {/snippet}
</Dialog>

<style>
  .scroll {
    flex: 1;
    min-height: 0;
    padding: 4px 20px 48px;
    overflow-y: auto;
  }
  .sections {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  section {
    padding: 16px 18px 18px;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  h3 {
    margin-bottom: 12px;
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .identity {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 8px 0;
  }
  .option strong {
    font-size: var(--fs-md);
    font-weight: 500;
  }
  .option p {
    max-width: 440px;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }
  .public-link {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0 8px;
    padding: 6px 6px 6px 10px;
    border-radius: var(--r-md);
    background: var(--bg-sunken);
  }
  code {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--mono);
    font-size: var(--fs-sm);
  }
  .rows {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 34px;
  }
  .inline {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--r-sm);
    background: none;
    font-size: var(--fs-md);
  }
  .inline:hover {
    background: var(--surface-hover);
  }
  .inline:focus-visible {
    outline: none;
    background: var(--surface);
  }
  :global(:root[data-keyboard]) .inline:focus-visible {
    border-color: var(--accent);
  }
  i {
    flex: none;
    width: 9px;
    height: 9px;
    margin: 0 2.5px;
    border-radius: 50%;
    background: oklch(var(--dot-l) var(--dot-c) var(--h));
  }
  .adder {
    margin-top: 8px;
  }
  .none {
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
  .danger h3 {
    color: var(--danger);
  }
</style>
