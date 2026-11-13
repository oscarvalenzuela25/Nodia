import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import BlockLearningTools from "../../../../../modules/teacher/components/AdaptiveWorkspace/BlockLearningTools";
import type { Session } from "../../../../../modules/teacher/infrastructure/schemas";
import type { useTeacherCommand } from "../../../../../modules/teacher/infrastructure/useServices";
import { mainInstance } from "../../../../../config/api";
const session = { id: "fixture-session", state: "active", revision: 1, active_attempts: [] } as unknown as Session;
describe("versioned lesson interaction continuity", () => {
  it("renders only the admitted version/block history with no secondary HTTP read", () => {
    const get = vi.spyOn(mainInstance, "get");
    render(<BlockLearningTools session={session} busy={false} command={{} as ReturnType<typeof useTeacherCommand>} onResult={vi.fn()} contentVersionId="version-one" block={{ id: "prediction", kind: "prediction", body_markdown: "Predict the result" }} history={[
      { id: "first", content_version_id: "version-one", block_id: "prediction", kind: "prediction", text: "My original prediction", created_at: "2026-11-11T00:00:00Z" },
      { id: "second", content_version_id: "version-two", block_id: "prediction", kind: "prediction", text: "Other version", created_at: "2026-11-11T00:00:00Z" },
    ]} />);
    expect(screen.getByText("My original prediction")).toBeInTheDocument();
    expect(screen.queryByText("Other version")).not.toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    get.mockRestore();
  });
  it("keeps drafts bound to their original version when a new package arrives", () => {
    const props = { session, busy: false, command: {} as ReturnType<typeof useTeacherCommand>, onResult: vi.fn(), block: { id: "prediction", kind: "prediction", body_markdown: "Predict the result" }, history: [] };
    const { rerender } = render(<BlockLearningTools {...props} contentVersionId="version-one" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Tu predicción" }), { target: { value: "Draft for version one" } });
    rerender(<BlockLearningTools {...props} contentVersionId="version-two" />);
    expect(screen.getByRole("textbox", { name: "Tu predicción" })).toHaveValue("");
    rerender(<BlockLearningTools {...props} contentVersionId="version-one" />);
    expect(screen.getByRole("textbox", { name: "Tu predicción" })).toHaveValue("Draft for version one");
  });
});
