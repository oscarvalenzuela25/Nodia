import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConversationHistory from "../../../../../modules/nodiaAi/components/ConversationHistory";
import { conversation } from "../../infrastructure/fixtures";
import type { ConversationHistoryProps } from "../../../../../modules/nodiaAi/components/ConversationHistory/types";

const props = (): ConversationHistoryProps => ({ items: [{ ...conversation, title: "Synthetic history" }], selectedId: conversation.conversation_id,
  filters: { search: "", archive: "active", view: "own", pinned: false }, filtersExpanded: false, onToggleFilters: vi.fn(), canViewAll: false, loading: false,
  fetching: false, error: false, disabled: false, hasMore: true, onFilters: vi.fn(), onSelect: vi.fn(), onAction: vi.fn(), onRetry: vi.fn(), onMore: vi.fn() });
describe("Conversation history organization", () => {
  it("opens the selected conversation and exposes a bounded server filter instead of filtering rows locally", async () => {
    const user = userEvent.setup(), input = props(); render(<ConversationHistory {...input} />);
    await user.click(screen.getByRole("button", { name: /Synthetic history synthetic-model/i }));
    expect(input.onSelect).toHaveBeenCalledWith(conversation.conversation_id);
    await user.type(screen.getByRole("textbox", { name: "Buscar por título o texto" }), "ñ");
    expect(input.onFilters).toHaveBeenCalledWith(expect.objectContaining({ search: "ñ" }));
    expect(screen.queryByText("Ámbito")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cargar más conversaciones" }));
    expect(input.onMore).toHaveBeenCalledTimes(1);
  });
  it("starts with search only, expands by keyboard and preserves applied filters when folded", async () => {
    const user = userEvent.setup();
    const input = props();
    function ControlledHistory() {
      const [expanded, setExpanded] = useState(false);
      const [filters, setFilters] = useState(input.filters);
      return <ConversationHistory {...input} canViewAll filters={filters} onFilters={value => { input.onFilters(value); setFilters(value); }}
        filtersExpanded={expanded} onToggleFilters={() => setExpanded(value => !value)} />;
    }
    render(<ControlledHistory />);
    const search = screen.getByRole("textbox", { name: "Buscar por título o texto" });
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ámbito" })).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: "Mostrar filtros de conversaciones" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    toggle.focus(); await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Sólo fijadas" }));
    expect(input.onFilters).toHaveBeenCalledWith(expect.objectContaining({ pinned: true }));
    await user.click(screen.getByRole("button", { name: "Conversaciones" }));
    await user.click(screen.getByRole("option", { name: "Archivadas" }));
    await user.click(screen.getByRole("button", { name: "Ámbito" }));
    await user.click(screen.getByRole("option", { name: "Todas las personas" }));
    await user.type(search, "factura");
    vi.mocked(input.onFilters).mockClear();
    await user.click(screen.getByRole("button", { name: "Ocultar filtros de conversaciones" }));
    await waitFor(() => expect(screen.queryByRole("switch")).not.toBeInTheDocument());
    expect(search).toHaveValue("factura");
    expect(input.onFilters).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Mostrar filtros de conversaciones" }));
    expect(screen.getByRole("switch", { name: "Sólo fijadas" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Conversaciones" })).toHaveTextContent("Archivadas");
    expect(screen.getByRole("button", { name: "Ámbito" })).toHaveTextContent("Todas las personas");
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
  it("keeps the menu within the conversation tile without nesting controls or selecting the chat", async () => {
    const user = userEvent.setup(), input = props(); render(<ConversationHistory {...input} />);
    const selected = screen.getByRole("button", { name: /Synthetic history synthetic-model/i });
    const trigger = screen.getByRole("button", { name: "Acciones de Synthetic history" });
    expect(trigger.closest("li")).toBe(selected.closest("li"));
    expect(selected).not.toContainElement(trigger);
    trigger.focus(); await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(input.onSelect).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("opens saved preferences for the menu conversation without selecting it or requesting a management action", async () => {
    const user = userEvent.setup(), input = props();
    const onPreferences = vi.fn();
    render(<ConversationHistory {...input} onPreferences={onPreferences} />);
    await user.click(screen.getByRole("button", { name: "Acciones de Synthetic history" }));
    await user.click(await screen.findByRole("menuitem", { name: "Preferencias guardadas" }));
    expect(onPreferences).toHaveBeenCalledExactlyOnceWith(conversation.conversation_id);
    expect(input.onSelect).not.toHaveBeenCalled();
    expect(input.onAction).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });
  it("blocks an open menu after the conversation becomes read-only", async () => {
    const user = userEvent.setup(), input = props();
    const onPreferences = vi.fn();
    const view = render(<ConversationHistory {...input} onPreferences={onPreferences} />);
    await user.click(screen.getByRole("button", { name: "Acciones de Synthetic history" }));
    view.rerender(<ConversationHistory {...input} onPreferences={onPreferences} items={[{ ...input.items[0], read_only: true }]} />);
    expect(screen.getByRole("menuitem", { name: "Renombrar" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Preferencias guardadas" })).toHaveAttribute("aria-disabled", "true");
    expect(input.onAction).not.toHaveBeenCalled();
    expect(onPreferences).not.toHaveBeenCalled();
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
