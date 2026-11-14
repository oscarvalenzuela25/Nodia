import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SessionForm from "../../../../../modules/teacher/components/SessionForm";
import RequestRecovery from "../../../../../modules/teacher/components/RequestRecovery";
import { useTeacherCommand } from "../../../../../modules/teacher/infrastructure/useServices";
import { readTeacherReceipt, sendTeacher } from "../../../../../modules/teacher/infrastructure/services";
import { forgetRequest } from "../../../../../modules/teacher/infrastructure/recovery";
import useAuthStore from "../../../../../store/authStore";
import type { CommandResult } from "../../../../../modules/teacher/infrastructure/schemas";

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../../../modules/teacher/infrastructure/services", () => ({ sendTeacher: vi.fn(), readTeacherReceipt: vi.fn(), readTeacher: vi.fn(), readTeacherData: vi.fn() }));
beforeEach(() => {
  forgetRequest();
  vi.clearAllMocks();
  useAuthStore.getState().login({ token: "synthetic-never-sent", expiresAt: Date.now() + 900_000, user: { id: "1", name: "Synthetic QA" } });
});
afterEach(() => forgetRequest());

function DialogCommand({ onRecovered }: { onRecovered: (result: CommandResult) => void }) {
  const [open, setOpen] = useState(true);
  const command = useTeacherCommand();
  return <SessionForm open={open} busy={command.blocked} onClose={() => setOpen(false)} recovery={<RequestRecovery command={command} onRecovered={result => { onRecovered(result); setOpen(false); }} />} onSave={async value => { const result = await command.execute("sessions", { ...value }); if (result) setOpen(false); }} />;
}

describe("Teacher modal request reconciliation", () => {
  it("keeps the form open after a lost POST and failed receipt GET, then recovers inside its focus trap without replay", async () => {
    vi.mocked(sendTeacher).mockRejectedValue(new AxiosError("Synthetic lost response", "ERR_NETWORK"));
    const ack = { session_id: "11111111-1111-4111-8111-111111111111", revision: 1 };
    vi.mocked(readTeacherReceipt).mockRejectedValueOnce(new AxiosError("Synthetic receipt unavailable", "ERR_NETWORK")).mockImplementationOnce(async key => ({ request_key: key, operation: "create_session", session_id: ack.session_id, http_status: 201, receipt: ack, completed_at: "2026-11-01T18:00:00.000Z" }));
    const onRecovered = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(<QueryClientProvider client={client}><DialogCommand onRecovered={onRecovered} /></QueryClientProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", { name: "Tema*" }), "Networks");
    await user.type(screen.getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" }), "Explain DNS");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    const dialog = screen.getByRole("dialog");
    const recover = await within(dialog).findByRole("button", { name: "Consultar guardado" });
    expect(recover).toBeEnabled();
    expect(recover).toHaveAttribute("type", "button");
    expect(within(dialog).getByRole("textbox", { name: "Tema*" })).toHaveValue("Networks");
    expect(within(dialog).getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
    await user.click(recover);
    await waitFor(() => expect(recover).toBeEnabled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onRecovered).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("textbox", { name: "¿Qué es lo que quieres aprender?*" })).toHaveValue("Explain DNS");
    await user.click(recover);
    await waitFor(() => expect(onRecovered).toHaveBeenCalledWith(ack));
    expect(sendTeacher).toHaveBeenCalledOnce();
    expect(readTeacherReceipt).toHaveBeenCalledTimes(2);
    const key = vi.mocked(sendTeacher).mock.calls[0][0].requestKey;
    expect(readTeacherReceipt).toHaveBeenNthCalledWith(1, key);
    expect(readTeacherReceipt).toHaveBeenNthCalledWith(2, key);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    client.clear();
  });
});
