class Router {
  path = $state(location.pathname);
  search = $state(location.search);

  constructor() {
    window.addEventListener('popstate', () => this.sync());
    // Plain <a href> works everywhere; same-origin clicks just skip the reload.
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const link = (event.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target || link.origin !== location.origin) return;
      event.preventDefault();
      this.go(link.pathname + link.search);
    });
  }

  private sync() {
    this.path = location.pathname;
    this.search = location.search;
  }

  go(to: string, options: { replace?: boolean } = {}) {
    history[options.replace ? 'replaceState' : 'pushState'](null, '', to);
    this.sync();
  }

  query(key: string) {
    return new URLSearchParams(this.search).get(key);
  }

  setQuery(values: Record<string, string | number | null>, options: { replace?: boolean } = {}) {
    const params = new URLSearchParams(this.search);
    for (const [key, value] of Object.entries(values)) {
      if (value === null) params.delete(key);
      else params.set(key, String(value));
    }
    const query = params.toString();
    this.go(this.path + (query ? `?${query}` : ''), options);
  }
}

export const router = new Router();
