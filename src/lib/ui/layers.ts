// Escape always closes the topmost floating layer, whatever kind it is.

const stack: { close: () => void }[] = [];

if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !stack.length) return;
      event.preventDefault();
      event.stopPropagation();
      stack[stack.length - 1].close();
    },
    true,
  );
}

export function pushLayer(close: () => void) {
  const entry = { close };
  stack.push(entry);
  return () => {
    const index = stack.indexOf(entry);
    if (index >= 0) stack.splice(index, 1);
  };
}

export const hasLayers = () => stack.length > 0;

/** Moves a node to the body, or into the open <dialog> so it stays in the top layer. */
export function portal(node: HTMLElement, anchor?: HTMLElement | null) {
  const host = anchor?.closest('dialog') ?? document.body;
  host.appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}

export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

export function place(anchor: DOMRect, popup: DOMRect, placement: Placement = 'bottom-start', gap = 6) {
  const margin = 8;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;
  let vertical = placement.split('-')[0];
  const fitsBelow = anchor.bottom + gap + popup.height <= viewportH - margin;
  const fitsAbove = anchor.top - gap - popup.height >= margin;
  if (vertical === 'bottom' && !fitsBelow && fitsAbove) vertical = 'top';
  if (vertical === 'top' && !fitsAbove && fitsBelow) vertical = 'bottom';

  const top = vertical === 'bottom' ? anchor.bottom + gap : anchor.top - gap - popup.height;
  const left = placement.endsWith('end') ? anchor.right - popup.width : anchor.left;
  return {
    top: Math.max(margin, Math.min(top, viewportH - popup.height - margin)),
    left: Math.max(margin, Math.min(left, viewportW - popup.width - margin)),
  };
}
