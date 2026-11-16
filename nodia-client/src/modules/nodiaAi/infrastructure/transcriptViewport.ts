/** The visible message and its offset survive a change in transcript width. */
export interface TranscriptAnchor {
  messageId: string;
  offset: number;
}

export function captureTranscriptAnchor(viewport: HTMLElement): TranscriptAnchor | null {
  const bounds = viewport.getBoundingClientRect();
  for (const message of viewport.querySelectorAll<HTMLElement>("[data-message-id]")) {
    const rect = message.getBoundingClientRect();
    if (rect.bottom > bounds.top && rect.top < bounds.bottom && message.dataset.messageId) {
      return { messageId: message.dataset.messageId, offset: rect.top - bounds.top };
    }
  }
  return null;
}

export function restoreTranscriptAnchor(viewport: HTMLElement, anchor: TranscriptAnchor | null): void {
  if (!anchor) return;
  const message = [...viewport.querySelectorAll<HTMLElement>("[data-message-id]")]
    .find(item => item.dataset.messageId === anchor.messageId);
  if (message) viewport.scrollTop += message.getBoundingClientRect().top
    - viewport.getBoundingClientRect().top - anchor.offset;
}
