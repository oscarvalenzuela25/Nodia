import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CodexSessionPanel from "../../../../../../../modules/generalSettings/pages/AiProviders/components/CodexSessionPanel";
import {
  codexJobSchema,
  codexSessionSchema,
  type CodexJob,
  type CodexSession,
} from "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession";
import i18n from "../../../../../../../translate";
const mock = vi.hoisted(() => ({
  session: vi.fn(),
  current: vi.fn(),
  start: vi.fn(),
  status: vi.fn(),
  cancel: vi.fn(),
  logout: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock(
  "../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession",
  async (original) => ({
    ...(await original<
      typeof import("../../../../../../../modules/generalSettings/pages/AiProviders/infrastructure/codexSession")
    >()),
    getCodexSession: mock.session,
    getCurrentCodexLogin: mock.current,
    startCodexLogin: mock.start,
    getCodexLogin: mock.status,
    cancelCodexLogin: mock.cancel,
    logoutCodex: mock.logout,
  }),
);
vi.mock("sileo", () => ({
  sileo: { success: mock.success, error: mock.error },
}));
const job: CodexJob = {
  id: "edb7c932-eaac-4e48-8d5b-d52e753a785d",
  state: "waiting_authorization",
  verificationUrl: "https://auth.openai.com/codex/device",
  userCode: "TEST-ONLY",
  reason: null,
};
const session: CodexSession = {
  usageAllowed: null,
  available: true,
  authenticated: false,
  planType: null,
  checkedAt: null,
  reason: "codex_session_required",
  quotas: null,
  lastInferenceAt: null,
};
const label = (key: string) => i18n.t(`ai_providers:codex.${key}`);
const mount = (state = session, disabled = false) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const rendered = render(
    <QueryClientProvider client={client}>
      <CodexSessionPanel providerId="42" session={state} disabled={disabled} />
    </QueryClientProvider>,
  );
  return { client, ...rendered };
};
const open = async () => {
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: label("manage") }));
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: label("connect") }),
    ).toBeEnabled(),
  );
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue(session);
  mock.current.mockResolvedValue(null);
  mock.start.mockResolvedValue(job);
  mock.status.mockResolvedValue(job);
  mock.cancel.mockResolvedValue({
    ...job,
    state: "cancelled",
    verificationUrl: null,
    userCode: null,
  });
  mock.logout.mockResolvedValue({ disconnected: true });
});
describe("Codex session panel", () => {
  it("blocks login for an unavailable runtime and permits connecting only after a successful recheck", async () => {
    const unavailable = { ...session, available: false, authenticated: null, reason: "codex_runtime_unavailable" };
    mock.session.mockResolvedValue(unavailable);
    mount(unavailable);
    expect(screen.getByText(label("runtime_unavailable"))).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: label("manage") }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("button", { name: label("check_status") })).toBeEnabled());
    expect(within(dialog).getByRole("button", { name: label("connect") })).toBeDisabled();
    expect(mock.start).not.toHaveBeenCalled();
    mock.session.mockResolvedValue(session);
    await userEvent.setup().click(within(dialog).getByRole("button", { name: label("check_status") }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: label("connect") })).toBeEnabled());
    await userEvent.setup().click(within(dialog).getByRole("button", { name: label("connect") }));
    expect(await screen.findByText("TEST-ONLY")).toBeVisible();
    expect(mock.start).toHaveBeenCalledOnce();
  });
  it("shows a runtime 503 inside the modal and prevents another POST until the runtime is checked again", async () => {
    mock.start.mockRejectedValueOnce({ isAxiosError: true, response: { status: 503, data: {
      code: "codex_runtime_unavailable", message: "El runtime Codex no está disponible.",
    } } });
    mount();
    await open();
    await userEvent.setup().click(screen.getByRole("button", { name: label("connect") }));
    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("El runtime Codex no está disponible.")).toBeVisible();
    expect(within(dialog).getByText(label("runtime_unavailable"))).toBeVisible();
    expect(within(dialog).getByRole("button", { name: label("connect") })).toBeDisabled();
    expect(mock.error).toHaveBeenCalledWith(expect.objectContaining({ description: "El runtime Codex no está disponible." }));
    expect(mock.start).toHaveBeenCalledOnce();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: label("check_status") })).toBeEnabled());
    await userEvent.setup().click(within(dialog).getByRole("button", { name: label("check_status") }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: label("connect") })).toBeEnabled());
    expect(within(dialog).queryByText("El runtime Codex no está disponible.")).not.toBeInTheDocument();
  });
  it("keeps connect disabled if the session query fails even with previously available health", async () => {
    mock.session.mockRejectedValue(new Error("Synthetic session error"));
    mount();
    await userEvent.setup().click(screen.getByRole("button", { name: label("manage") }));
    await waitFor(() => expect(mock.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: label("connect") })).toBeDisabled();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(mock.start).not.toHaveBeenCalled();
  });
  it("exposes only the official device URL and recovers a pending login for this connection", async () => {
    mock.current.mockResolvedValue(job);
    mount();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("manage") }));
    expect(await screen.findByText("TEST-ONLY")).toBeVisible();
    expect(
      screen.getByRole("link", { name: label("open_login") }),
    ).toHaveAttribute("href", "https://auth.openai.com/codex/device");
    expect(mock.current).toHaveBeenCalledWith("42");
    expect(mock.start).not.toHaveBeenCalled();
  });
  it("preserves the modal after a failed start and allows an explicit retry", async () => {
    mock.start.mockRejectedValueOnce({
      response: { data: { message: "Synthetic server failure" } },
    });
    mount();
    await open();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("connect") }));
    await waitFor(() => expect(mock.error).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeVisible();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("connect") }));
    expect(await screen.findByText("TEST-ONLY")).toBeVisible();
    expect(mock.start).toHaveBeenCalledTimes(2);
  });
  it("retains the code and modal when cancel fails", async () => {
    mock.cancel.mockRejectedValue(new Error("synthetic failure"));
    mount();
    await open();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("connect") }));
    await screen.findByText("TEST-ONLY");
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("cancel") }));
    await waitFor(() => expect(mock.cancel).toHaveBeenCalledWith("42", job.id));
    expect(screen.getByText("TEST-ONLY")).toBeVisible();
    expect(screen.getByRole("dialog")).toBeVisible();
  });
  it("closes only after verified success and refreshes health/models", async () => {
    mock.status.mockResolvedValue({
      ...job,
      state: "succeeded",
      verificationUrl: null,
      userCode: null,
    });
    const { client } = mount();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await open();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("connect") }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["ai-providers-health"],
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["ai-selectable-models"],
    });
  });
  it("preserves disconnect confirmation on failure without reporting success", async () => {
    mock.logout.mockRejectedValue(new Error("synthetic failure"));
    mount({ ...session, authenticated: true });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: label("disconnect") }));
    await userEvent
      .setup()
      .click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: i18n.t("core:confirm"),
        }),
      );
    await waitFor(() => expect(mock.error).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(mock.success).not.toHaveBeenCalled();
  });
  it("shows zero observed usage and leaves unknown figures absent", () => {
    mount({
      ...session,
      quotas: [
        {
          id: "synthetic",
          name: null,
          primary: { usedPercent: 0, windowDurationMins: null, resetsAt: null },
          secondary: null,
        },
      ],
    });
    expect(screen.getByText(/0\s*%/)).toBeVisible();
    expect(screen.queryByText(/100\s*%/)).not.toBeInTheDocument();
  });
  it("does not overwrite fresh parent health with an old modal observation", async () => {
    const connected = { ...session, authenticated: true }; mock.session.mockResolvedValue(connected);
    const { client, rerender } = mount(connected); await open();
    const close = within(screen.getByRole("dialog")).getAllByRole("button").find((button) => button.textContent === label("close"))!;
    await userEvent.setup().click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    rerender(<QueryClientProvider client={client}><CodexSessionPanel providerId="42" session={session} disabled={false} /></QueryClientProvider>);
    expect(screen.getByText(label("session_required"))).toBeVisible();
  });
  it("disables actions during a parent mutation", () => {
    mount(session, true);
    expect(
      screen.getByRole("button", { name: label("manage") }),
    ).toBeDisabled();
  });
  it("rejects foreign URLs, unexpected secret fields and invented quota values", () => {
    expect(
      codexJobSchema.safeParse({
        ...job,
        verificationUrl: "https://attacker.invalid",
      }).success,
    ).toBe(false);
    expect(
      codexJobSchema.safeParse({ ...job, token: "synthetic" }).success,
    ).toBe(false);
    expect(
      codexSessionSchema.safeParse({
        ...session,
        quotas: [
          {
            id: "x",
            name: null,
            primary: {
              usedPercent: 101,
              windowDurationMins: null,
              resetsAt: null,
            },
            secondary: null,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
