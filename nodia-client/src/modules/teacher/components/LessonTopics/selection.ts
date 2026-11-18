export function readTopicSelection(selection: Selection | null, lesson: HTMLElement | null) {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1 || !lesson) return null;
  const range = selection.getRangeAt(0);
  const node = range.startContainer;
  const textArea = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>("[data-lesson-topic-text]");
  const blockId = textArea?.dataset.lessonTopicText;
  const text = selection.toString();
  if (!blockId || !lesson.contains(textArea) || !textArea.contains(range.endContainer) || !text.trim() || text.length > 2000) return null;
  return { blockId, text, range: range.cloneRange() };
}
