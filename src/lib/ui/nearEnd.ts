function scrollParent(node: HTMLElement) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
}

/** Calls back as a marker at the end of a long list scrolls close, so the list can render more. */
export function nearEnd(node: HTMLElement, callback: () => void) {
  let current = callback;
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.at(-1)!.isIntersecting) return;
      current();
      // The observer only reports changes, so ask again in case the marker is still close.
      observer.unobserve(node);
      requestAnimationFrame(() => observer.observe(node));
    },
    { root: scrollParent(node), rootMargin: '600px' },
  );
  observer.observe(node);
  return {
    update(next: () => void) {
      current = next;
    },
    destroy() {
      observer.disconnect();
    },
  };
}
