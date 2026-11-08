<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = HTMLTextareaAttributes & {
    value?: string;
    bare?: boolean;
    el?: HTMLTextAreaElement;
  };

  let { value = $bindable(''), bare = false, el = $bindable(), class: className = '', rows = 1, ...rest }: Props = $props();

  // Grow with the content so long text never scrolls inside a tiny box.
  function fit() {
    if (!el) return false;
    el.style.height = 'auto';
    if (!el.scrollHeight) return false;
    el.style.height = `${el.scrollHeight + (bare ? 0 : 2)}px`;
    return true;
  }

  // Inside a dialog that has not opened yet there is no layout to measure, so try again next frame.
  $effect(() => {
    void value;
    if (!fit()) requestAnimationFrame(fit);
  });
</script>

<textarea bind:this={el} bind:value {rows} class="{className}" class:bare {...rest}></textarea>

<style>
  textarea {
    display: block;
    width: 100%;
    resize: none;
    overflow: hidden;
    padding: 7px 10px;
    border-radius: var(--r-md);
    border: 1px solid var(--border);
    background: var(--surface);
    font-size: var(--fs-md);
    line-height: 1.6;
    transition:
      border-color var(--fast),
      box-shadow var(--fast);
  }
  textarea:hover {
    border-color: var(--border-strong);
  }
  textarea:focus-visible {
    outline: none;
  }
  :global(:root[data-keyboard]) textarea:not(.bare):focus-visible {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .bare,
  .bare:hover,
  .bare:focus-visible {
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
    border-radius: 0;
  }
</style>
