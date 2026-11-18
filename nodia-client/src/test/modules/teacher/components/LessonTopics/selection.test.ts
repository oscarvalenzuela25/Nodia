import { afterEach, expect, it } from "vitest";
import { readTopicSelection } from "../../../../../modules/teacher/components/LessonTopics/selection";

afterEach(() => { window.getSelection()?.removeAllRanges(); document.body.replaceChildren(); });

it("anchors an exact DOM range to one reading area and rejects a selection crossing into other topics or controls", () => {
  const lesson = document.createElement("div");
  lesson.innerHTML = '<div data-lesson-topic-text="greetings">Say <b>Nice to meet you</b>.</div><button>Save</button><div data-lesson-topic-text="other">Other topic</div>';
  document.body.append(lesson);
  const selection = window.getSelection()!;
  const phrase = lesson.querySelector("b")!.firstChild!;
  const selectTo = (end: Node, offset: number) => {
    const range = document.createRange();
    range.setStart(phrase, 0);
    range.setEnd(end, offset);
    selection.removeAllRanges();
    selection.addRange(range);
  };
  selectTo(phrase, 16);
  const captured = readTopicSelection(selection, lesson);
  expect(captured).toMatchObject({ blockId: "greetings", text: "Nice to meet you" });
  selectTo(lesson.querySelector("button")!.firstChild!, 4);
  expect(readTopicSelection(selection, lesson)).toBeNull();
  selectTo(lesson.lastElementChild!.firstChild!, 5);
  expect(readTopicSelection(selection, lesson)).toBeNull();
  expect(captured?.range.toString()).toBe("Nice to meet you");
});
