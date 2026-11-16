import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConversationHistory from "../../../../../modules/nodiaAi/components/ConversationHistory";
import { conversation } from "../../infrastructure/fixtures";
import type { ConversationHistoryProps } from "../../../../../modules/nodiaAi/components/ConversationHistory/types";
import { DEFAULT_CONVERSATION_FILTERS } from "../../../../../modules/nodiaAi/components/ConversationHistory/types";

const props = (): ConversationHistoryProps => ({ items: [{ ...conversation, title: "Synthetic history" }], selectedId: conversation.conversation_id,
  filters: { search: "", archive: "active", view: "own", pinned: false }, filtersExpanded: false, onToggleFilters: vi.fn(), canViewAll: false, loading: false,
  fetching: false, error: false, disabled: false, hasMore: true, onFilters: vi.fn(), onSelect: vi.fn(), onAction: vi.fn(), onRetry: vi.fn(), onMore: vi.fn() });
describe("Conversation history organization", () => {
  it("distinguishes no conversations from no matching conversations and does not replace errors or initial loading with an empty result", () => {
    const input = props();
    const view = render(<ConversationHistory {...input} items={[]} hasMore={false} />);
    expect(screen.getByText("Todavía no tienes conversaciones. Crea un chat para comenzar.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restablecer filtros de conversaciones" })).not.toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} items={[]} filters={{ ...input.filters, search: "factura" }} />);
    expect(screen.getByText("No hay conversaciones que coincidan con esta búsqueda o estos filtros.")).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no tienes conversaciones/)).not.toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} items={[]} error filters={{ ...input.filters, search: "factura" }} />);
    expect(screen.getByText("No pudimos consultar las conversaciones.")).toBeInTheDocument();
    expect(screen.queryByText("No hay conversaciones que coincidan con esta búsqueda o estos filtros.")).not.toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} items={[]} loading filters={{ ...input.filters, search: "factura" }} />);
    expect(screen.queryByText("No hay conversaciones que coincidan con esta búsqueda o estos filtros.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Todavía no tienes conversaciones/)).not.toBeInTheDocument();
  });
  it("exposes folded filters and resets all four criteria by keyboard without changing conversation selection, returning focus to search", async () => {
    const user = userEvent.setup(), input = props();
    function ControlledHistory() {
      const [filters, setFilters] = useState<ConversationHistoryProps["filters"]>({ search: "factura", archive: "archived", pinned: true, view: "all" });
      return <ConversationHistory {...input} canViewAll items={[]} hasMore={false} filters={filters}
        onFilters={next => { input.onFilters(next); setFilters(next); }} />;
    }
    render(<ControlledHistory />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByText("4 filtros activos")).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Restablecer filtros de conversaciones" });
    reset.focus(); await user.keyboard("{Enter}");
    expect(input.onFilters).toHaveBeenCalledExactlyOnceWith(DEFAULT_CONVERSATION_FILTERS);
    const search = screen.getByRole("textbox", { name: "Buscar por título o texto" });
    expect(search).toHaveValue(""); expect(search).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Restablecer filtros de conversaciones" })).not.toBeInTheDocument();
    expect(screen.getByText("Todavía no tienes conversaciones. Crea un chat para comenzar.")).toBeInTheDocument();
    expect(input.onSelect).not.toHaveBeenCalled(); expect(input.onAction).not.toHaveBeenCalled();
  });
  it("counts only meaningful visible criteria, treating whitespace and an unavailable everyone scope as defaults", () => {
    const input = props(), filters = { ...input.filters, search: "   ", view: "all" as const };
    const view = render(<ConversationHistory {...input} items={[]} filters={filters} />);
    expect(screen.queryByRole("button", { name: "Restablecer filtros de conversaciones" })).not.toBeInTheDocument();
    expect(screen.getByText("Todavía no tienes conversaciones. Crea un chat para comenzar.")).toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} canViewAll filters={filters} />);
    expect(screen.getByText("1 filtro activo")).toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} filters={{ ...input.filters, archive: "all", pinned: true }} />);
    expect(screen.getByText("2 filtros activos")).toBeInTheDocument();
  });
  it("keeps filtered results and their criteria visible during refetch while disabling reset", async () => {
    const input = props();
    const filters = { ...input.filters, search: "factura" };
    const view = render(<ConversationHistory {...input} filters={filters} fetching />);
    expect(screen.getByText("Synthetic history")).toBeInTheDocument();
    expect(screen.getByText("1 filtro activo")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Actualizando" })).toBeInTheDocument();
    const reset = screen.getByRole("button", { name: "Restablecer filtros de conversaciones" });
    expect(reset).toBeDisabled(); fireEvent.click(reset); expect(input.onFilters).not.toHaveBeenCalled();
    view.rerender(<ConversationHistory {...input} filters={filters} />);
    expect(screen.getByRole("button", { name: "Restablecer filtros de conversaciones" })).toBeEnabled();
  });
  it("announces exactly one current conversation in the expanded list and retains keyboard navigation by identity", async () => {
    const user = userEvent.setup(), input = props();
    const second = { ...conversation, conversation_id: "22222222-2222-4222-8222-222222222222", title: "Second conversation" };
    const view = render(<ConversationHistory {...input} items={[...input.items, second]} />);
    const first = screen.getByRole("button", { name: /Synthetic history synthetic-model/i });
    const next = screen.getByRole("button", { name: /Second conversation synthetic-model/i });
    expect(first).toHaveAttribute("aria-current", "page"); expect(next).not.toHaveAttribute("aria-current");
    next.focus(); await user.keyboard("{Enter}");
    expect(input.onSelect).toHaveBeenCalledExactlyOnceWith(second.conversation_id);
    view.rerender(<ConversationHistory {...input} items={[...input.items, second]} selectedId={second.conversation_id} />);
    expect(first).not.toHaveAttribute("aria-current"); expect(next).toHaveAttribute("aria-current", "page");
  });
  it("opens collapsed conversations by keyboard with context and no management menus", async () => {
    const user = userEvent.setup(), input = props(), onToggleCollapsed = vi.fn();
    render(<ConversationHistory {...input} collapsed onToggleCollapsed={onToggleCollapsed} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acciones de Synthetic history" })).not.toBeInTheDocument();
    const chat = screen.getByRole("button", { name: "Synthetic history · synthetic-model" });
    expect(chat).toHaveAttribute("aria-current", "page");
    chat.focus(); await user.keyboard("{Enter}");
    expect(input.onSelect).toHaveBeenCalledExactlyOnceWith(conversation.conversation_id);
    expect(input.onAction).not.toHaveBeenCalled();
    await user.hover(chat);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Synthetic history · synthetic-model");
    await user.click(screen.getByRole("button", { name: "Expandir conversaciones" }));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });
  it("preserves filters while collapsing and removes an open options menu", async () => {
    const user = userEvent.setup(), input = props();
    function Controlled() {
      const [collapsed, setCollapsed] = useState(false);
      const [filters, setFilters] = useState(input.filters);
      return <ConversationHistory {...input} collapsed={collapsed} onToggleCollapsed={() => setCollapsed(value => !value)} filters={filters} onFilters={setFilters} />;
    }
    render(<Controlled />);
    await user.type(screen.getByRole("textbox"), "factura");
    await user.click(screen.getByRole("button", { name: "Acciones de Synthetic history" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Colapsar conversaciones" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expandir conversaciones" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Expandir conversaciones" }));
    expect(screen.getByRole("button", { name: "Colapsar conversaciones" })).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("factura");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(input.onFilters).not.toHaveBeenCalled();
  });
  it("keeps collapsed error recovery, paging and loading controls available without mistaking errors for empty results", async () => {
    const user = userEvent.setup(), input = props();
    const view = render(<ConversationHistory {...input} collapsed error items={[]} />);
    await user.click(screen.getByRole("button", { name: /No pudimos consultar las conversaciones/ }));
    expect(input.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cargar más conversaciones" }));
    expect(input.onMore).toHaveBeenCalledTimes(1);
    view.rerender(<ConversationHistory {...input} collapsed fetching />);
    expect(screen.getByRole("button", { name: "Synthetic history · synthetic-model" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cargar más conversaciones" })).toBeDisabled();
    view.rerender(<ConversationHistory {...input} collapsed items={[{ ...input.items[0], title: null, selection: null }]} />);
    expect(screen.getByRole("button", { name: "Conversación sin título · Sin modelo asignado" })).toBeInTheDocument();
  });
  it("does not reopen a stale menu after a responsive collapse", async () => {
    const user = userEvent.setup(), input = props();
    const view = render(<ConversationHistory {...input} />);
    await user.click(screen.getByRole("button", { name: "Acciones de Synthetic history" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} collapsed />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    view.rerender(<ConversationHistory {...input} />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Acciones de Synthetic history" }));
    expect(screen.getByRole("menuitem", { name: "Renombrar" })).toBeInTheDocument();
  });
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
