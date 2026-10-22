import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConversationManagement from "../../../../../modules/nodiaAi/components/ConversationManagement";
import { conversation } from "../../infrastructure/fixtures";

describe("Conversation management exact metadata", () => {
  it("preserves an edited title on failed save and uses a reviewed revision on explicit retry", async () => {
    const user = userEvent.setup(), onApply = vi.fn().mockRejectedValueOnce(new Error("synthetic failure")).mockResolvedValue(undefined), onClose = vi.fn();
    const input = { operation: { chat: conversation, action: "rename" as const }, busy: false, error: null, onApply, onClose, onRefresh: vi.fn() };
    const view = render(<ConversationManagement {...input} />);
    await user.type(screen.getByRole("textbox", { name: "Título de la conversación" }), "Un título corregible");
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox")).toHaveValue("Un título corregible"); expect(onClose).not.toHaveBeenCalled();
    view.rerender(<ConversationManagement {...input} operation={{ ...input.operation, chat: { ...conversation, revision: 2, title: "Changed elsewhere" } }} error="synthetic failure" />);
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(onApply).toHaveBeenLastCalledWith({ expected_conversation_revision: 2, title: "Un título corregible" }));
  });
  it("validates UTF-8 and allows an explicit empty title as null", async () => {
    const user = userEvent.setup(), onApply = vi.fn().mockResolvedValue(undefined);
    render(<ConversationManagement operation={{ chat: conversation, action: "rename" }} busy={false} error={null} onApply={onApply} onClose={vi.fn()} onRefresh={vi.fn()} />);
    await user.type(screen.getByRole("textbox"), "ñ".repeat(129));
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    expect(await screen.findByText("El título admite hasta 256 bytes UTF-8.")).toBeInTheDocument(); expect(onApply).not.toHaveBeenCalled();
    await user.clear(screen.getByRole("textbox"));
    await user.click(screen.getByRole("button", { name: "Guardar título" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith({ expected_conversation_revision: 1, title: null }));
  });
  it.each(["pin", "archive"] as const)("requires a human click for %s and submits only that exact change", async action => {
    const onApply = vi.fn().mockResolvedValue(undefined), user = userEvent.setup();
    render(<ConversationManagement operation={{ chat: conversation, action }} busy={false} error={null} onApply={onApply} onClose={vi.fn()} onRefresh={vi.fn()} />);
    expect(onApply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: action === "pin" ? "Fijar" : "Archivar" }));
    expect(onApply).toHaveBeenCalledWith({ expected_conversation_revision: 1, ...(action === "pin" ? { is_pinned: true } : { is_archived: true }) });
  });
});
