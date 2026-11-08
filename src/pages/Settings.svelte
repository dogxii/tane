<script lang="ts">
  import { onMount } from 'svelte';
  import Bot from '@lucide/svelte/icons/bot';
  import Copy from '@lucide/svelte/icons/copy';
  import Menu from '@lucide/svelte/icons/menu';
  import Trash2 from '@lucide/svelte/icons/trash-2';
  import { ApiFailure, api } from '../lib/api';
  import { relativeTime } from '../lib/format';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { Button, Dialog, Input, Segmented, toasts } from '../lib/ui';
  import type { Token } from '../lib/types';

  let tokens = $state<Token[]>([]);
  let name = $state('');
  let created = $state<string | null>(null);
  let revoking = $state<Token | null>(null);

  onMount(async () => {
    tokens = (await api.get<{ tokens: Token[] }>('/tokens')).tokens;
  });

  async function create(event: Event) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      const response = await api.post<{ token: Token; secret: string }>('/tokens', { name: name.trim() });
      tokens = [response.token, ...tokens];
      created = response.secret;
      name = '';
    } catch (failure) {
      toasts.error(failure instanceof ApiFailure ? failure.message : '创建失败');
    }
  }

  async function revoke() {
    if (!revoking) return;
    const target = revoking;
    revoking = null;
    await api.del(`/tokens/${target.id}`);
    tokens = tokens.filter((t) => t.id !== target.id);
    toasts.show('Token 已撤销');
  }

  async function logout() {
    await session.logout();
    router.go('/login');
  }

  const themes = [
    { value: 'system' as const, label: '跟随系统' },
    { value: 'light' as const, label: '浅色' },
    { value: 'dark' as const, label: '深色' },
  ];
  const agentPrompt = $derived(`读取 ${location.origin}/agent.md 了解如何操作我的看板。Token：${created}`);
</script>

<div class="page">
  <header>
    <span class="mobile"><Button variant="ghost" icon={Menu} aria-label="打开导航" onclick={() => (session.sidebarOpen = true)} /></span>
    <h1>设置</h1>
  </header>

  <div class="sections">
    <section>
      <h2>外观</h2>
      <Segmented items={themes} value={session.theme} label="主题" onchange={(theme) => session.setTheme(theme)} />
    </section>

    <section>
      <h2>Agent Token</h2>
      <p class="lead">把 Token 发给电脑上的 Agent，它就能读写看板。Token 可以修改卡片和收集反馈，但不能公开项目或卡片、发布版本、删除项目。</p>

      <form onsubmit={create}>
        <Input bind:value={name} placeholder="Token 名称，例如 claude-code" maxlength={40} aria-label="Token 名称" />
        <Button type="submit" variant="primary" disabled={!name.trim()}>创建</Button>
      </form>

      {#if created}
        <div class="created">
          <strong>复制这句话发给 Agent，Token 之后不会再显示</strong>
          <div class="secret">
            <code>{agentPrompt}</code>
            <Button size="sm" icon={Copy} onclick={() => { navigator.clipboard?.writeText(agentPrompt); toasts.show('已复制'); }}>复制</Button>
          </div>
        </div>
      {/if}

      <div class="tokens">
        {#each tokens as token (token.id)}
          <div class="token">
            <Bot size={15} strokeWidth={1.9} />
            <span class="token-name">{token.name}</span>
            <code>{token.prefix}…</code>
            <span class="spacer"></span>
            <span class="meta">{token.last_used_at ? `${relativeTime(token.last_used_at)}使用` : '从未使用'}</span>
            <Button variant="ghost" size="sm" icon={Trash2} aria-label="撤销 {token.name}" onclick={() => (revoking = token)} />
          </div>
        {/each}
      </div>
    </section>

    <section>
      <h2>账户</h2>
      <Button onclick={logout}>退出登录</Button>
    </section>
  </div>
</div>

<Dialog bind:open={() => revoking !== null, (value) => { if (!value) revoking = null; }} title="撤销这个 Token？" description="使用它的 Agent 会立即失去访问权限。">
  <div></div>
  {#snippet footer()}
    <Button onclick={() => (revoking = null)}>取消</Button>
    <Button variant="danger" onclick={revoke}>撤销</Button>
  {/snippet}
</Dialog>

<style>
  .page {
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    padding: 0 28px 40px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 72px;
    max-width: 640px;
    margin: 0 auto;
  }
  h1 {
    font-size: var(--fs-xl);
    font-weight: 620;
  }
  .mobile {
    display: none;
  }
  .sections {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 640px;
    margin: 0 auto;
  }
  section {
    padding: 16px 18px 18px;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  h2 {
    margin-bottom: 10px;
    font-size: var(--fs-md);
    font-weight: 600;
  }
  .lead {
    margin-top: -4px;
    margin-bottom: 12px;
    color: var(--text-2);
    font-size: var(--fs-sm);
  }
  form {
    display: flex;
    gap: 8px;
  }
  form :global(span:first-child) {
    flex: 1;
  }
  code {
    font-family: var(--mono);
    font-size: var(--fs-sm);
  }
  .created {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    border-radius: var(--r-md);
    background: var(--accent-soft);
    font-size: var(--fs-sm);
  }
  .secret {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .secret code {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tokens {
    margin-top: 10px;
  }
  .token {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 38px;
    color: var(--text-2);
  }
  .token-name {
    color: var(--text);
    font-weight: 500;
  }
  .token code {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  .spacer {
    flex: 1;
  }
  .meta {
    color: var(--text-3);
    font-size: var(--fs-xs);
  }
  @media (max-width: 800px) {
    .page {
      padding-inline: 14px;
    }
    .mobile {
      display: inline-flex;
      margin-left: -6px;
    }
  }
</style>
