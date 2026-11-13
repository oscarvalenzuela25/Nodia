import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { useRetainedPanelFocus } from "../../../../../modules/teacher/components/AdaptiveWorkspace/useRetainedPanelFocus";

function Harness({ disabled = false }: { disabled?: boolean }) {
  const [active, setActive] = useState<"source" | null>("source");
  const panel = useRetainedPanelFocus(active);
  return <>
    <button ref={node => panel.setTrigger("source", node)} onClick={() => setActive("source")}>Open</button>
    {active && <button onClick={() => { panel.returnToTrigger(); setActive(null); }}>Hide</button>}
    <div hidden={active !== "source"} onFocusCapture={event => panel.remember("source", event)} onBlurCapture={event => panel.remember("source", event)}><textarea aria-label="Draft" defaultValue="Draft text preserved" disabled={disabled} /></div>
  </>;
}
describe("retained panel focus", () => {
  it("returns focus to the trigger and restores the same editor, draft and caret on reopening", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const editor = screen.getByRole("textbox", { name: "Draft" }) as HTMLTextAreaElement;
    editor.focus(); editor.setSelectionRange(3, 7);
    fireEvent.blur(editor);
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(editor).toHaveFocus();
    expect(editor).toHaveValue("Draft text preserved");
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([3, 7]);
  });
  it("restores after revalidation enables the field without stealing a newer focus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    const editor = screen.getByRole("textbox", { name: "Draft" }) as HTMLTextAreaElement;
    editor.focus(); editor.setSelectionRange(2, 5);
    await user.click(screen.getByRole("button", { name: "Hide" }));
    rerender(<Harness disabled />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(editor).not.toHaveFocus();
    rerender(<Harness disabled={false} />);
    await waitFor(() => expect(editor).toHaveFocus());
    expect([editor.selectionStart, editor.selectionEnd]).toEqual([2, 5]);
  });
});
