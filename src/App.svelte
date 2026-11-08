<script lang="ts">
  import { onMount } from 'svelte';
  import { prefetch } from './lib/api';
  import { router } from './lib/router.svelte';
  import { session } from './lib/session.svelte';
  import { Spinner, Toaster, hasLayers } from './lib/ui';
  import Sidebar from './components/Sidebar.svelte';

  const pages = {
    collect: () => import('./pages/Collect.svelte'),
    home: () => import('./pages/Home.svelte'),
    login: () => import('./pages/Login.svelte'),
    project: () => import('./pages/Project.svelte'),
    settings: () => import('./pages/Settings.svelte'),
  };

  const projectSlug = $derived(router.path.match(/^\/p\/([^/]+)/)?.[1] ?? null);
  const collectSlug = $derived(router.path.match(/^\/f\/([^/]+)/)?.[1] ?? null);
  const isPublicRoute = $derived(projectSlug !== null || collectSlug !== null || router.path === '/ui');
  const isLogin = $derived(router.path === '/login');

  // A page's code and first data load side by side rather than one after the other.
  onMount(() => {
    if (collectSlug) {
      void pages.collect();
      prefetch(`/collect/${collectSlug}`);
    } else if (projectSlug) {
      void pages.project();
      prefetch(`/projects/${projectSlug}`);
    }
  });

  // The feedback page shows nothing that depends on who is looking.
  $effect(() => {
    if (!collectSlug) void session.init();
  });

  $effect(() => {
    if (!session.signedIn) return;
    const timer = setTimeout(() => Object.values(pages).forEach((load) => void load()), 1200);
    return () => clearTimeout(timer);
  });

  // Everything except public boards needs a session.
  $effect(() => {
    if (!session.ready) return;
    if (!session.signedIn && !isPublicRoute && !isLogin) {
      const next = router.path === '/' ? '' : `?next=${encodeURIComponent(router.path + router.search)}`;
      router.go(`/login${next}`, { replace: true });
    } else if (session.signedIn && isLogin) {
      router.go('/', { replace: true });
    }
  });

  function onkeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && session.signedIn) {
      event.preventDefault();
      session.paletteOpen = !session.paletteOpen;
      return;
    }
    const target = event.target as HTMLElement;
    if (event.key === '?' && !collectSlug && !target.matches('input, textarea') && !hasLayers()) {
      session.shortcutsOpen = true;
    }
  }

  const showShell = $derived(session.signedIn && !isLogin && !collectSlug && router.path !== '/ui');
</script>

<svelte:window {onkeydown} />

{#if !session.ready && !collectSlug}
  <div class="boot"><Spinner size={18} /></div>
{:else}
  <div class="app">
    {#if showShell}<Sidebar />{/if}
    <div class="main">
      {#if collectSlug}
        {#key collectSlug}
          {#await pages.collect() then { default: Collect }}<Collect slug={collectSlug} />{/await}
        {/key}
      {:else if isLogin}
        {#await pages.login() then { default: Login }}<Login />{/await}
      {:else if router.path === '/ui'}
        {#await import('./pages/Gallery.svelte') then { default: Gallery }}
          <Gallery />
        {/await}
      {:else if projectSlug}
        {#key projectSlug}
          {#await pages.project() then { default: Project }}<Project slug={projectSlug} />{/await}
        {/key}
      {:else if session.signedIn && router.path === '/settings'}
        {#await pages.settings() then { default: Settings }}<Settings />{/await}
      {:else if session.signedIn}
        {#await pages.home() then { default: Home }}<Home />{/await}
      {/if}
    </div>
  </div>
  {#if session.signedIn}
    {#await import('./components/CommandPalette.svelte') then { default: Palette }}<Palette />{/await}
    {#await import('./components/NewProjectDialog.svelte') then { default: NewProject }}<NewProject />{/await}
  {/if}
  {#if session.shortcutsOpen}
    {#await import('./components/ShortcutsDialog.svelte') then { default: Shortcuts }}<Shortcuts />{/await}
  {/if}
{/if}
<Toaster />

<style>
  .boot {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--text-3);
  }
  .app {
    display: flex;
    height: 100%;
  }
  .main {
    flex: 1;
    display: flex;
    min-width: 0;
    height: 100%;
  }
</style>
