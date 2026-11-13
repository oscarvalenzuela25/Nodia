import { useLayoutEffect, useRef, type FocusEvent } from "react";

type Editor = HTMLInputElement | HTMLTextAreaElement;
type SavedFocus = { node: Editor; start: number | null; end: number | null };
/** A hidden editor retains its DOM, draft and caret; closing returns focus to its trigger. */
export function useRetainedPanelFocus<Key extends string>(active: Key | null) {
  const editors = useRef(new Map<Key, SavedFocus>());
  const triggers = useRef<Partial<Record<Key, HTMLButtonElement | null>>>({});
  const remember = (key: Key, event: FocusEvent<HTMLElement>) => {
    const node = event.target;
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) editors.current.set(key, { node, start: node.selectionStart, end: node.selectionEnd });
  };
  useLayoutEffect(() => {
    if (active === null) return;
    const saved = editors.current.get(active);
    if (!saved || !saved.node.isConnected || saved.node.closest("[hidden]")) return;
    const restore = () => {
      const focused = document.activeElement;
      if (saved.node.disabled || !saved.node.isConnected || saved.node.closest("[hidden]") || (focused !== triggers.current[active] && focused !== document.body && focused !== saved.node)) return;
      saved.node.focus({ preventScroll: true });
      if (saved.start !== null && saved.end !== null) saved.node.setSelectionRange(saved.start, saved.end);
    };
    if (!saved.node.disabled) { restore(); return; }
    // Reopening revalidates the panel. Restore after that field is enabled, unless
    // the person already chose another control; never steal their newer focus.
    const observer = new MutationObserver(() => { if (!saved.node.disabled) { observer.disconnect(); restore(); } });
    observer.observe(saved.node, { attributes: true, attributeFilter: ["disabled"] });
    return () => observer.disconnect();
  }, [active]);
  return { remember, setTrigger: (key: Key, node: HTMLButtonElement | null) => { triggers.current[key] = node; }, returnToTrigger: () => { if (active !== null) triggers.current[active]?.focus({ preventScroll: true }); } };
}
