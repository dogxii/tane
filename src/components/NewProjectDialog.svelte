<script lang="ts">
  import { ApiFailure, api } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { Button, Dialog, Field, HuePicker, Input } from '../lib/ui';
  import type { Project } from '../lib/types';

  let name = $state('');
  let slug = $state('');
  let slugEdited = $state(false);
  let hue = $state(235);
  let error = $state('');
  let saving = $state(false);
  let fallback = $state('');

  $effect(() => {
    if (!session.newProjectOpen) return;
    name = '';
    slug = '';
    slugEdited = false;
    error = '';
    fallback = `project-${Math.random().toString(36).slice(2, 7)}`;
  });

  // Non-Latin names produce no usable slug, so they get a generated one the user can edit.
  const autoSlug = $derived(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40),
  );
  const finalSlug = $derived(slugEdited ? slug : autoSlug || (name.trim() ? fallback : ''));

  async function submit(event: Event) {
    event.preventDefault();
    if (!name.trim() || !finalSlug || saving) return;
    saving = true;
    error = '';
    try {
      const { project } = await api.post<{ project: Project }>('/projects', { name: name.trim(), slug: finalSlug, hue });
      await session.refreshProjects();
      session.newProjectOpen = false;
      router.go(`/p/${project.slug}`);
    } catch (failure) {
      error = failure instanceof ApiFailure ? failure.message : '创建失败';
    } finally {
      saving = false;
    }
  }
</script>

<Dialog bind:open={session.newProjectOpen} title="新建项目" description="每个项目有独立的看板、反馈和更新日志，默认私有。">
  <form id="new-project" onsubmit={submit}>
    <Field label="名称">
      <!-- svelte-ignore a11y_autofocus -->
      <Input bind:value={name} placeholder="例如：星港物语" autofocus />
    </Field>
    <Field label="链接标识" hint="用于网址和 Agent 操作，只能包含小写字母、数字和连字符" {error}>
      <Input
        value={finalSlug}
        placeholder="star-harbor"
        oninput={(event) => {
          slugEdited = true;
          slug = event.currentTarget.value;
        }}
      />
    </Field>
    <Field label="颜色">
      <HuePicker bind:value={hue} />
    </Field>
  </form>
  {#snippet footer()}
    <Button onclick={() => (session.newProjectOpen = false)}>取消</Button>
    <Button variant="primary" type="submit" form="new-project" loading={saving} disabled={!name.trim() || !finalSlug}>创建项目</Button>
  {/snippet}
</Dialog>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
</style>
