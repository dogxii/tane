<script lang="ts">
  import { ApiFailure } from '../lib/api';
  import { router } from '../lib/router.svelte';
  import { session } from '../lib/session.svelte';
  import { Button, Field, Input, Logo } from '../lib/ui';

  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(event: Event) {
    event.preventDefault();
    if (!password || busy) return;
    busy = true;
    error = '';
    try {
      await session.login(password);
      router.go(router.query('next') ?? '/', { replace: true });
    } catch (failure) {
      error = failure instanceof ApiFailure ? failure.message : '登录失败';
    } finally {
      busy = false;
    }
  }
</script>

<main>
  <form onsubmit={submit}>
    <Logo size={36} />
    <h1>登录 Tane</h1>
    <Field label="管理员密码" {error}>
      <!-- svelte-ignore a11y_autofocus -->
      <Input type="password" bind:value={password} invalid={!!error} autofocus aria-label="管理员密码" />
    </Field>
    <Button type="submit" variant="primary" size="lg" loading={busy} disabled={!password}>登录</Button>
  </form>
</main>

<style>
  main {
    display: grid;
    place-items: center;
    flex: 1;
    min-height: 100%;
    padding: 24px;
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: min(340px, 100%);
  }
  h1 {
    font-size: var(--fs-xl);
    font-weight: 620;
    letter-spacing: -0.01em;
  }
</style>
