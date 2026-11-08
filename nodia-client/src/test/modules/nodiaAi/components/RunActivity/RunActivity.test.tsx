import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RunActivity from "../../../../../modules/nodiaAi/components/RunActivity";
import type { NodiaAiEvent, NodiaAiRun } from "../../../../../modules/nodiaAi/infrastructure/types";
import { chatId, messageId, run } from "../../infrastructure/fixtures";

const accepted: NodiaAiEvent = {
  event_id: "synthetic-accepted", conversation_id: chatId, seq: "1", cursor: "synthetic-cursor",
  created_at: run.created_at, run_id: run.run_id, kind: "run_accepted",
  payload: { message_id: messageId, run_revision: 1 },
};
const running: NodiaAiEvent = {
  ...accepted, event_id: "synthetic-running", seq: "2", kind: "run_changed",
  payload: { revision: 2, state: "running", error: null },
};

describe("NodiaAI temporary activity", () => {
  it("shows public steps inside the assistant bubble, preserves the list during updates and ignores another run", () => {
    const { rerender } = render(<RunActivity run={run} events={[accepted]} />);
    const list = screen.getByRole("list", { name: "Pasos del turno" });
    expect(within(list).getByText("Mensaje admitido")).toBeInTheDocument();
    expect(screen.getByText("1 paso")).toBeInTheDocument();
    rerender(<RunActivity run={{ ...run, state: "running" }} events={[accepted, running, { ...accepted, event_id: "other", run_id: "other-run" }]} />);
    expect(screen.getByRole("list")).toBe(list);
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("NodiaAI está trabajando")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("2 pasos")).toBeInTheDocument();
  });

  it.each<NodiaAiRun["state"]>(["completed", "failed", "cancelled", "unknown"])("removes intermediate messages when the run becomes %s", state => {
    const { rerender } = render(<RunActivity run={run} events={[accepted]} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
    rerender(<RunActivity run={{ ...run, state }} events={[accepted, running]} />);
    expect(screen.queryByLabelText("Actividad de NodiaAI")).not.toBeInTheDocument();
    expect(screen.queryByText("Mensaje admitido")).not.toBeInTheDocument();
  });

  it("uses the observed run state while events are absent, without inventing steps", () => {
    render(<RunActivity run={run} events={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("Turno en cola");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ pasos?/)).not.toBeInTheDocument();
  });
});
