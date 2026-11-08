import { api } from './api';
import type { ProjectStore } from './store.svelte';
import type { Project } from './types';

type Theme = 'system' | 'light' | 'dark';

class Session {
  ready = $state(false);
  signedIn = $state(false);
  projects = $state<Project[]>([]);
  theme = $state<Theme>('system');
  paletteOpen = $state(false);
  shortcutsOpen = $state(false);
  newProjectOpen = $state(false);
  sidebarOpen = $state(false);
  store = $state.raw<ProjectStore | null>(null);

  constructor() {
    try {
      const saved = localStorage.getItem('tane-theme');
      if (saved === 'light' || saved === 'dark') this.theme = saved;
    } catch {
      // Storage can be blocked; the theme simply follows the system.
    }
  }

  private started = false;

  async init() {
    if (this.started) return;
    this.started = true;
    const me = await api.get<{ actor: unknown; projects: Project[] }>('/me').catch(() => ({ actor: null, projects: [] }));
    this.signedIn = !!me.actor;
    this.projects = me.projects;
    this.ready = true;
  }

  async refreshProjects() {
    const { projects } = await api.get<{ projects: Project[] }>('/projects');
    this.projects = projects;
  }

  async login(password: string) {
    await api.post('/login', { password });
    this.signedIn = true;
    await this.refreshProjects();
  }

  async logout() {
    await api.post('/logout');
    this.signedIn = false;
    this.projects = [];
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('tane-theme');
      else localStorage.setItem('tane-theme', theme);
    } catch {
      // Theme still applies for this session.
    }
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }
}

export const session = new Session();
