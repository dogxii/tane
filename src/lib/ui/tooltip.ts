import { place } from './layers';

let bubble: HTMLDivElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastHidden = 0;

function show(target: HTMLElement, label: string) {
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.setAttribute('role', 'tooltip');
    bubble.style.cssText = `position:fixed;z-index:1000;pointer-events:none;padding:3px 8px;
      border-radius:var(--r-sm);background:var(--inverse);color:var(--on-inverse);
      font-size:var(--fs-xs);line-height:1.5;white-space:nowrap;box-shadow:var(--shadow-md);`;
  }
  (target.closest('dialog') ?? document.body).appendChild(bubble);
  bubble.textContent = label;
  const { top, left } = place(target.getBoundingClientRect(), bubble.getBoundingClientRect(), 'bottom-start', 5);
  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
}

function hide() {
  clearTimeout(timer);
  if (bubble?.isConnected) {
    bubble.remove();
    lastHidden = Date.now();
  }
}

/** `use:tip={'文本'}`: one shared bubble, instant when moving between neighbours. */
export function tip(node: HTMLElement, label: string | undefined) {
  let current = label;
  const enter = () => {
    if (!current) return;
    const delay = Date.now() - lastHidden < 300 ? 0 : 420;
    timer = setTimeout(() => show(node, current!), delay);
  };
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', hide);
  node.addEventListener('pointerdown', hide);
  return {
    update(next: string | undefined) {
      current = next;
    },
    destroy() {
      hide();
      node.removeEventListener('pointerenter', enter);
      node.removeEventListener('pointerleave', hide);
      node.removeEventListener('pointerdown', hide);
    },
  };
}
