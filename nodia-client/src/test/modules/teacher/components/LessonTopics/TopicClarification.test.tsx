import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicClarification from "../../../../../modules/teacher/components/LessonTopics/TopicClarification";
import type { Session } from "../../../../../modules/teacher/infrastructure/schemas";
import type { useTeacherCommand } from "../../../../../modules/teacher/infrastructure/useServices";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), thread: vi.fn(), enrichment: vi.fn() }));
vi.mock("@mui/material", async importOriginal => ({ ...await importOriginal<typeof import("@mui/material")>(), useMediaQuery: () => true }));
vi.mock("../../../../../modules/teacher/components/AdaptiveWorkspace/useEnrichment", () => ({ useEnrichment: mocks.enrichment }));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherQuery: mocks.thread }));
vi.mock("../../../../../modules/teacher/components/JobPanel", () => ({ default: () => <div /> }));

const version = "fixture-version";
const block = "greetings";
const selection = "Nice to meet you";
const threadId = "fixture-thread";
const topicThread = { id: threadId, content_version_id: version, block_id: block, selection, created_at: "2026-11-17T12:00:00Z" };
const session = { id: "fixture-session", state: "active", active_attempts: [] } as unknown as Session;
const query = (data?: unknown) => ({ data, refetch: vi.fn(), isError: false, isLoading: false, isFetching: false });
const theme = createTheme();
const view = (open = true, command = {} as ReturnType<typeof useTeacherCommand>) => <ThemeProvider theme={theme}>
  <TopicClarification anchor={selection} open={open} onClose={vi.fn()} session={session} busy={false}
    command={command} contentVersionId={version} blockId={block} />
</ThemeProvider>;
const question = () => screen.getByRole("textbox", { name: "Tu pregunta" });
const send = () => screen.getByRole("button", { name: "Enviar a Teacher" });

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.enrichment.mockReturnValue({
    query: query({ revision: 15, threads: [topicThread, { ...topicThread, id: "unrelated", block_id: "other", selection: "Different topic" }] }),
    execute: mocks.execute, page: 1, setPage: vi.fn(), disabled: false, readDisabled: false,
  });
  mocks.thread.mockImplementation((path: string) => query(path.endsWith(threadId) ? { thread: topicThread, messages: [] } : undefined));
});

describe("clarification inside a lesson topic", () => {
  it("opens without a write, creates only on Send, and retries a failed message using the confirmed thread", async () => {
    mocks.execute.mockResolvedValueOnce({ kind: "clarification", resource_id: threadId, revision: 16 })
      .mockResolvedValueOnce(null).mockResolvedValueOnce({ job_id: "fixture-job" });
    const { rerender } = render(view());
    expect(screen.getAllByText(selection)).toHaveLength(1);
    expect(send()).toBeDisabled();
    expect(mocks.execute).not.toHaveBeenCalled();
    fireEvent.change(question(), { target: { value: "¿Cuándo se usa?" } });
    await userEvent.click(send());
    await waitFor(() => expect(send()).toBeEnabled());
    expect(mocks.execute).toHaveBeenNthCalledWith(1, "thread_create", { content_version_id: version, block_id: block, selection });
    expect(mocks.execute).toHaveBeenNthCalledWith(2, "thread_message", { thread_id: threadId, text: "¿Cuándo se usa?" }, 16);
    rerender(view(false));
    rerender(view());
    expect(question()).toHaveValue("¿Cuándo se usa?");
    await userEvent.click(screen.getByRole("button", { name: "Conversaciones guardadas" }));
    await userEvent.click(screen.getByRole("button", { name: selection }));
    expect(question()).toHaveValue("¿Cuándo se usa?");
    await userEvent.click(send());
    expect(mocks.execute).toHaveBeenNthCalledWith(3, "thread_message", { thread_id: threadId, text: "¿Cuándo se usa?" }, undefined);
    await waitFor(() => expect(question()).toHaveValue(""));
  });

  it("recovers a saved thread without resending and keeps unrelated conversations out of the topic", async () => {
    const command: ReturnType<typeof useTeacherCommand> = {
      execute: vi.fn(), reconcile: vi.fn(), refresh: vi.fn(), blocked: false, isPending: false, uncertain: null, receiptMissing: false,
      lastReconciled: {
        actor: "fixture-actor",
        command: { requestKey: "original-intent", path: `sessions/${session.id}/enrichment/commands`, method: "POST",
          body: { operation: "thread_create", payload: { content_version_id: version, block_id: block, selection } } },
        result: { kind: "clarification", resource_id: threadId, revision: 16 },
      },
    };
    render(view(true, command));
    expect(mocks.execute).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Conversaciones guardadas" }));
    expect(screen.getByRole("button", { name: selection })).toBeVisible();
    expect(screen.queryByText("Different topic")).not.toBeInTheDocument();
    fireEvent.change(question(), { target: { value: "¿Otro ejemplo?" } });
    await userEvent.click(send());
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith("thread_message", { thread_id: threadId, text: "¿Otro ejemplo?" }, undefined);
  });
});
