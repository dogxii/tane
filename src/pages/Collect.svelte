<script lang="ts">
  import { onMount } from 'svelte';
  import Check from '@lucide/svelte/icons/check';
  import MessageCircleOff from '@lucide/svelte/icons/message-circle-off';
  import { ApiFailure, api, takePrefetch } from '../lib/api';
  import { Button, Empty, Field, ProjectIcon, Spinner, Textarea } from '../lib/ui';

  type Info = { name: string; icon: string; hue: number; board: boolean };

  let { slug }: { slug: string } = $props();

  let info = $state<Info | null>(null);
  let failure = $state<'missing' | 'network' | null>(null);
  let message = $state('');
  let honeypot = $state('');
  let error = $state('');
  let sending = $state(false);
  let sent = $state(false);

  const ready = $derived(message.trim().length >= 4);

  onMount(async () => {
    try {
      const path = `/collect/${slug}`;
      info = (await (takePrefetch<{ project: Info }>(path) ?? api.get<{ project: Info }>(path))).project;
      document.title = `${info.name} · 反馈`;
    } catch (cause) {
      failure = cause instanceof ApiFailure && cause.status === 404 ? 'missing' : 'network';
    }
  });

  async function send(event?: Event) {
    event?.preventDefault();
    if (!ready || sending) return;
    sending = true;
    error = '';
    try {
      await api.post(`/collect/${slug}`, { body: message.trim(), website: honeypot });
      message = '';
      sent = true;
    } catch (cause) {
      error = cause instanceof ApiFailure ? cause.message : '发送失败，请稍后再试';
    } finally {
      sending = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void send();
  }
</script>

<main style:--hue={info?.hue}>
  {#if failure}
    <Empty
      icon={MessageCircleOff}
      title={failure === 'missing' ? '这个反馈页不存在或已关闭' : '暂时打不开'}
      description={failure === 'missing' ? '请确认链接是否正确。' : '请检查网络后刷新页面。'}
    />
  {:else if !info}
    <Spinner size={18} />
  {:else if sent}
    <div class="sheet done">
      <span class="tick"><Check size={20} strokeWidth={2.4} /></span>
      <h1>收到了，感谢你的反馈</h1>
      <div class="actions">
        <Button onclick={() => (sent = false)}>再写一条</Button>
        {#if info.board}<a href="/p/{slug}">查看公开看板</a>{/if}
      </div>
    </div>
  {:else}
    <form class="sheet" onsubmit={send}>
      <header>
        <ProjectIcon name={info.name} icon={info.icon} hue={info.hue} size={36} />
        <h1>{info.name}</h1>
      </header>
      <Field label="你的反馈或建议" {error}>
        <Textarea bind:value={message} rows={6} maxlength={2000} placeholder="遇到的问题、想要的功能，都可以写在这里" {onkeydown} />
      </Field>
      <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" bind:value={honeypot} />
      <footer>
        <span>内容不会公开显示</span>
        <Button type="submit" variant="primary" size="lg" loading={sending} disabled={!ready}>发送</Button>
      </footer>
    </form>
  {/if}
</main>

<style>
  main {
    display: flex;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
    padding: 24px 16px;
  }
  main > :global(*) {
    margin: auto;
  }
  .sheet {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: min(500px, 100%);
    padding: 24px;
    border-radius: var(--r-xl);
    border: 1px solid var(--border);
    background: var(--surface);
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  h1 {
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: var(--fs-xl);
    font-weight: 620;
    letter-spacing: -0.01em;
  }
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--text-3);
    font-size: var(--fs-sm);
  }
  .trap {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
  .done {
    align-items: center;
    padding-block: 40px;
    text-align: center;
  }
  .tick {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .actions a {
    color: var(--text-2);
    font-size: var(--fs-sm);
  }
  .actions a:hover {
    color: var(--text);
  }
</style>
