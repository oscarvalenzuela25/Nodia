import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConversationHistory from "../../../../../modules/nodiaAi/components/ConversationHistory";
import { conversation } from "../../infrastructure/fixtures";
import type { ConversationHistoryProps } from "../../../../../modules/nodiaAi/components/ConversationHistory/types";

const props = (): ConversationHistoryProps => ({ items: [{ ...conversation, title: "Synthetic history" }], selectedId: conversation.conversation_id,
  filters: { search: "", archive: "active", view: "own", pinned: false }, canViewAll: false, loading: false,
  fetching: false, error: false, disabled: false, hasMore: true, onFilters: vi.fn(), onSelect: vi.fn(), onAction: vi.fn(), onRetry: vi.fn(), onMore: vi.fn() });
describe("Conversation history organization", () => {
  it("opens the selected conversation and exposes a bounded server filter instead of filtering rows locally", async () => {
    const user = userEvent.setup(), input = props(); render(<ConversationHistory {...input} />);
    await user.click(screen.getByRole("button", { name: /Synthetic history synthetic-model/i }));
    expect(input.onSelect).toHaveBeenCalledWith(conversation.conversation_id);
    await user.type(screen.getByRole("textbox", { name: "Buscar por título o texto" }), "ñ");
    expect(input.onFilters).toHaveBeenCalledWith(expect.objectContaining({ search: "ñ" }));
    expect(screen.queryByText("Ámbito")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Sólo fijadas" }));
    expect(input.onFilters).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }));
    await user.click(screen.getByRole("button", { name: "Cargar más conversaciones" }));
    expect(input.onMore).toHaveBeenCalledTimes(1);
  });
  it("opens a named keyboard menu, preserving identity and forbidding read-only actions", async () => {
    const user = userEvent.setup(), input = props(); const view = render(<ConversationHistory {...input} />);
    const trigger = screen.getByRole("button", { name: "Acciones de Synthetic history" });
    trigger.focus(); await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("menuitem", { name: "Renombrar" }));
    expect(input.onAction).toHaveBeenCalledWith(input.items[0], "rename", trigger);
    view.rerender(<ConversationHistory {...input} items={[{ ...input.items[0], read_only: true }]} />);
    expect(screen.getByRole("button", { name: "Acciones de Synthetic history" })).toBeDisabled();
  });
  it("keeps results visible and blocks controls during refetch; an error is not an empty state", () => {
    const input = props(); const view = render(<ConversationHistory {...input} fetching />);
    expect(screen.getByText("Synthetic history")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buscar por título o texto" })).toBeDisabled();
    view.rerender(<ConversationHistory {...input} error items={[]} />);
    expect(screen.getByText("No pudimos consultar las conversaciones.")).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no tienes conversaciones/)).not.toBeInTheDocument();
  });
});
