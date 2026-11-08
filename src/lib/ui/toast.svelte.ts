export type Toast = {
  id: number;
  message: string;
  tone: 'default' | 'error';
  action?: { label: string; run: () => void };
};

let nextId = 1;

class Toasts {
  items = $state<Toast[]>([]);

  show(message: string, options: { tone?: Toast['tone']; action?: Toast['action']; duration?: number } = {}) {
    const id = nextId++;
    this.items = [...this.items.slice(-2), { id, message, tone: options.tone ?? 'default', action: options.action }];
    setTimeout(() => this.dismiss(id), options.duration ?? (options.action ? 6000 : 3200));
  }

  error(message: string) {
    this.show(message, { tone: 'error', duration: 5000 });
  }

  dismiss(id: number) {
    this.items = this.items.filter((toast) => toast.id !== id);
  }
}

export const toasts = new Toasts();
