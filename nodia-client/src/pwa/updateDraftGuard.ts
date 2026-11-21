export function watchUpdateDrafts(doc: Document, edited: Set<Element>): () => void {
  function mark(event: Event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const field = target.closest("input, select, textarea, [contenteditable]:not([contenteditable='false'])");
    if (field) remember(field);
  }

  function remember(element: Element) {
    for (const previous of edited) {
      if (!previous.isConnected) edited.delete(previous);
    }
    edited.add(element.closest("form, [role='form']") ?? element);
  }

  function markDrop(event: DragEvent) {
    if (event.dataTransfer?.types.includes("Files") && event.target instanceof Element) remember(event.target);
  }

  function reset(event: Event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    queueMicrotask(() => {
      if (!event.defaultPrevented) edited.delete(form);
    });
  }

  doc.addEventListener("input", mark, true);
  doc.addEventListener("change", mark, true);
  doc.addEventListener("reset", reset, true);
  doc.addEventListener("drop", markDrop, true);
  return () => {
    doc.removeEventListener("input", mark, true);
    doc.removeEventListener("change", mark, true);
    doc.removeEventListener("reset", reset, true);
    doc.removeEventListener("drop", markDrop, true);
  };
}

export function hasOpenUpdateDraft(doc: Document, edited: Set<Element>): boolean {
  for (const element of edited) {
    if (!element.isConnected) edited.delete(element);
  }
  // The chat composer can hold a pending recording or files without a native input event.
  return edited.size > 0 || Boolean(doc.querySelector(
    "dialog[open], [role='dialog'][aria-modal='true'], [data-page-layout='conversation']",
  ));
}
