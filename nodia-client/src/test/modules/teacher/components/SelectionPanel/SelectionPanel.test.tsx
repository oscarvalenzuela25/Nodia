import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SelectionPanel from "../../../../../modules/teacher/components/SelectionPanel";
import type { ConnectionCatalog } from "../../../../../modules/teacher/infrastructure/selection";
import type { Selection } from "../../../../../modules/teacher/infrastructure/schemas";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../../../../modules/teacher/infrastructure/useServices", () => ({ useTeacherQuery: mocks.query }));
const exact: Selection = { connection_id: "2", mode: "agentic", model_id: "fixture-native-model", effort_id: "high" };
const catalogFixture = (): ConnectionCatalog => ({ items: [
  { connection_id: "1", label: "Other fixture", is_default: false, is_active: true, default_mode: "api_key", modes: [] },
  { connection_id: "2", label: "Default fixture", is_default: true, is_active: true, default_mode: "agentic", modes: [
    { mode: "agentic", configuration: "configured", configured_selection: exact, models: [{ model_id: exact.model_id, label: "Native fixture", efforts: [{ effort_id: "high", label: "high" }] }] },
    { mode: "api_key", configuration: "incomplete", configured_selection: null, models: [{ model_id: "other-fixture-model", label: "Other fixture model", efforts: [] }] },
  ] },
], next_cursor: null });
let catalog: ConnectionCatalog;
let eligible: boolean;
let failed: boolean;
let fetching: boolean;
let observed: Selection;
const onSave = vi.fn(async () => {});
beforeEach(() => {
  catalog = catalogFixture(); eligible = true; failed = false; fetching = false; observed = exact; onSave.mockReset(); onSave.mockResolvedValue(undefined);
  mocks.query.mockImplementation((path: string) => ({ data: path === "connections" ? catalog : { selection: observed, eligible, reason_code: eligible ? null : "adapter_unqualified", checked_at: null }, isLoading: false, isFetching: fetching, isError: failed, refetch: vi.fn() }));
});

describe("Teacher composer selection", () => {
  it("does not qualify or save a grouped model until its intensity is explicitly assigned", async () => {
    const ready = vi.fn();
    catalog.items[1].provider_key = "gemini";
    const initial = { ...exact, model_id: "fixture-next-high", effort_id: null };
    observed = initial;
    catalog.items[1].modes[0].models = ["high", "low"].map(effort => ({ model_id: `fixture-next-${effort}`, label: `Fixture Next (${effort})`, efforts: [{ effort_id: effort, label: effort }] }));
    render(<SelectionPanel presentation="composer" initial={initial} busy={false} onSave={onSave} onReadyChange={ready} />);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Fixture Next");
    expect(ready).toHaveBeenLastCalledWith(false);
    expect(mocks.query).toHaveBeenLastCalledWith("connections/2/eligibility", expect.anything(), { mode: "agentic", model_id: initial.model_id }, false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("groups reported Gemini variants and qualifies the explicit intensity using its real ID", async () => {
    const user = userEvent.setup(); const ready = vi.fn();
    const connection = catalog.items[1]; connection.provider_key = "gemini";
    const high = { ...exact, model_id: "fixture-next-high" };
    const low = { ...exact, model_id: "fixture-next-low", effort_id: "low" };
    connection.modes[0].configured_selection = high;
    connection.modes[0].models = ["high", "medium", "low"].map(effort => ({ model_id: `fixture-next-${effort}`, label: `Fixture Next (${effort})`, efforts: ["high", "medium", "low"].map(effort_id => ({ effort_id, label: effort_id })) }));
    observed = high;
    const { rerender } = render(<SelectionPanel presentation="composer" initial={high} busy={false} onSave={onSave} onReadyChange={ready} />);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Fixture Next");
    await user.click(screen.getByRole("button", { name: "Modelo" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: "Fixture Next" })).toBeVisible();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Esfuerzo" }));
    await user.click(screen.getByRole("option", { name: "low" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(ready).toHaveBeenLastCalledWith(false);
    expect(mocks.query).toHaveBeenLastCalledWith("connections/2/eligibility", expect.anything(), { mode: "agentic", model_id: low.model_id, effort_id: "low" }, true);
    expect(screen.getByRole("button", { name: "Guardar selección" })).toBeDisabled();
    observed = low;
    rerender(<SelectionPanel presentation="composer" initial={high} busy={false} onSave={onSave} onReadyChange={ready} />);
    await user.click(screen.getByRole("button", { name: "Guardar selección" }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(low);
  });

  it("provides four accessible footer selectors without a panel and exposes only persisted readiness", async () => {
    const ready = vi.fn(); const dirty = vi.fn();
    const { rerender } = render(<SelectionPanel presentation="composer" initial={exact} busy={false} onSave={onSave} onReadyChange={ready} onDirtyChange={dirty} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Selección de IA.*Default fixture/ })).not.toBeInTheDocument();
    for (const name of ["Conexión", "Modo", "Modelo", "Esfuerzo"]) expect(screen.getByRole("button", { name })).toBeEnabled();
    await waitFor(() => expect(ready).toHaveBeenLastCalledWith(true));
    expect(dirty).toHaveBeenLastCalledWith(false);
    fetching = true;
    rerender(<SelectionPanel presentation="composer" initial={exact} busy={false} onSave={onSave} onReadyChange={ready} onDirtyChange={dirty} />);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Native fixture");
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveAttribute("aria-disabled", "true");
    expect(ready).toHaveBeenLastCalledWith(false);
  });

  it("requires exact eligibility and explicit apply, preserving changes after a failed write", async () => {
    const ready = vi.fn(); const dirty = vi.fn(); const user = userEvent.setup();
    catalog.items[1].modes[0].models[0].efforts.push({ effort_id: "low", label: "low" });
    const low = { ...exact, effort_id: "low" };
    const { rerender } = render(<SelectionPanel presentation="composer" initial={exact} busy={false} onSave={onSave} onReadyChange={ready} onDirtyChange={dirty} />);
    await user.click(screen.getByRole("button", { name: "Esfuerzo" }));
    await user.click(screen.getByRole("option", { name: "low" }));
    expect(ready).toHaveBeenLastCalledWith(false); expect(dirty).toHaveBeenLastCalledWith(true);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar selección" })).toBeDisabled();
    observed = low;
    rerender(<SelectionPanel presentation="composer" initial={exact} busy={false} onSave={onSave} onReadyChange={ready} onDirtyChange={dirty} />);
    onSave.mockRejectedValueOnce(new Error("fixture rejected write"));
    await user.click(screen.getByRole("button", { name: "Guardar selección" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar selección" })).toBeEnabled());
    expect(screen.getByRole("button", { name: "Esfuerzo" })).toHaveTextContent("low");
    expect(onSave).toHaveBeenCalledExactlyOnceWith(low);
    rerender(<SelectionPanel presentation="composer" initial={exact} busy={false} onSave={onSave} onReadyChange={ready} onDirtyChange={dirty} />);
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Guardar selección" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(ready).toHaveBeenLastCalledWith(false);
    rerender(<SelectionPanel presentation="composer" initial={low} busy={false} onSave={onSave} onReadyChange={ready} onDirtyChange={dirty} />);
    await waitFor(() => expect(ready).toHaveBeenLastCalledWith(true));
    expect(dirty).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole("button", { name: "Guardar selección" })).not.toBeInTheDocument();
  });

  it("allows canceling an unsaved selection without a mutation", async () => {
    const ready = vi.fn(); const user = userEvent.setup();
    render(<SelectionPanel presentation="composer" initial={exact} busy={false} onSave={onSave} onReadyChange={ready} />);
    await user.click(screen.getByRole("button", { name: "Modo" }));
    await user.click(screen.getByRole("option", { name: "API key" }));
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Sin modelo asignado");
    expect(ready).toHaveBeenLastCalledWith(false);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("button", { name: "Modo" })).toHaveTextContent("Agentic");
    expect(ready).toHaveBeenLastCalledWith(true); expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps a missing historical selection unavailable without substituting a default", () => {
    const ready = vi.fn();
    render(<SelectionPanel presentation="composer" initial={{ ...exact, model_id: "retired-fixture-model" }} busy={false} onSave={onSave} onReadyChange={ready} />);
    expect(ready).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("retired-fixture-model");
    expect(screen.getByRole("alert")).toHaveTextContent(/La selección guardada ya no aparece/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not replay a rejected initial default and retains its explicit retry", async () => {
    onSave.mockRejectedValueOnce(new Error("fixture rejected write"));
    const { rerender } = render(<SelectionPanel presentation="composer" initial={null} busy={false} onSave={onSave} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar selección" })).toBeEnabled());
    expect(onSave).toHaveBeenCalledExactlyOnceWith(exact);
    rerender(<SelectionPanel presentation="composer" initial={null} busy={false} onSave={onSave} />);
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Native fixture");
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
const header = () => screen.getByRole("button", { name: /Selección de IA/ });

describe("Teacher exact selection", () => {
  it("provides a qualified configured default to the creation form without a separate save or PATCH", async () => {
    const changed = vi.fn();
    render(<SelectionPanel intent="create" initial={null} busy={false} onSelectionChange={changed} />);
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith({ selection: exact, ready: true }));
    expect(header()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Guardar selección" })).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("keeps creation expanded and not ready when the default is unqualified or missing", async () => {
    const changed = vi.fn(); eligible = false;
    const { rerender } = render(<SelectionPanel intent="create" initial={null} busy={false} onSelectionChange={changed} />);
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith({ selection: exact, ready: false }));
    expect(header()).toHaveAttribute("aria-expanded", "true");
    catalog.items[1].is_default = false; catalog = { ...catalog };
    rerender(<SelectionPanel intent="create" initial={null} busy={false} onSelectionChange={changed} />);
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith({ selection: null, ready: false }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("prefills the persisted designated default and saves it once, including under StrictMode", async () => {
    render(<StrictMode><SelectionPanel initial={null} busy={false} onSave={onSave} /></StrictMode>);
    await waitFor(() => expect(onSave).toHaveBeenCalledExactlyOnceWith(exact));
    expect(screen.getByRole("button", { name: "Modo" })).toHaveTextContent("Agentic");
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Native fixture");
    expect(screen.getByRole("button", { name: "Esfuerzo" })).toHaveTextContent("high");
  });
  it("collapses only after the selection is confirmed by its owner and supports keyboard expansion", async () => {
    const { rerender } = render(<SelectionPanel initial={null} busy={false} onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(header()).toHaveAttribute("aria-expanded", "true");
    rerender(<SelectionPanel initial={exact} busy={false} onSave={onSave} />);
    expect(header()).toHaveAttribute("aria-expanded", "false");
    const user = userEvent.setup(); header().focus(); await user.keyboard("{Enter}");
    expect(header()).toHaveAttribute("aria-expanded", "true");
    await user.click(header()); expect(header()).toHaveAttribute("aria-expanded", "false");
  });
  it("keeps a saved qualified selection collapsed without replacing it with the global default", () => {
    catalog.items[1].is_default = false; catalog.items[0].is_default = true;
    render(<SelectionPanel initial={exact} busy={false} onSave={onSave} />);
    expect(header()).toHaveAttribute("aria-expanded", "false"); expect(header()).toHaveTextContent("Default fixture");
    expect(onSave).not.toHaveBeenCalled();
  });
  it("blocks a historical model missing from discovery instead of selecting a new one", () => {
    render(<SelectionPanel initial={{ ...exact, model_id: "retired-fixture-model" }} busy={false} onSave={onSave} />);
    expect(screen.getByText(/La selección guardada ya no aparece/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar selección" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("retired-fixture-model");
    expect(onSave).not.toHaveBeenCalled();
  });
  it.each(["none", "ambiguous", "disabled", "missing-model", "missing-effort"])("does not invent a usable default when configuration is %s", scenario => {
    if (scenario === "none") catalog.items[1].is_default = false;
    if (scenario === "ambiguous") catalog.items[0].is_default = true;
    if (scenario === "disabled") catalog.items[1].is_active = false;
    if (scenario === "missing-model") catalog.items[1].modes[0].configured_selection = null;
    if (scenario === "missing-effort") catalog.items[1].modes[0].models[0].efforts = [];
    render(<SelectionPanel initial={null} busy={false} onSave={onSave} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Guardar selección" })).toBeDisabled(); expect(onSave).not.toHaveBeenCalled();
  });
  it("expands an unqualified saved selection and never auto-saves it", () => {
    eligible = false;
    render(<SelectionPanel initial={exact} busy={false} onSave={onSave} />);
    expect(header()).toHaveAttribute("aria-expanded", "true"); expect(screen.getByText(/Esta selección aún no/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("preserves the draft after a rejected save and does not automatically retry on refetch", async () => {
    const { rerender } = render(<SelectionPanel initial={null} busy={false} onSave={onSave} />);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    catalog = catalogFixture(); rerender(<SelectionPanel initial={null} busy={false} onSave={onSave} />);
    expect(header()).toHaveAttribute("aria-expanded", "true"); expect(onSave).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar selección" }));
    expect(onSave).toHaveBeenCalledTimes(2); expect(onSave).toHaveBeenLastCalledWith(exact);
  });
  it("does not auto-save while paused/busy, after a read error, or with eligibility for a different selection", () => {
    const { rerender } = render(<SelectionPanel initial={null} busy onSave={onSave} />);
    expect(onSave).not.toHaveBeenCalled(); failed = true;
    rerender(<SelectionPanel initial={null} busy={false} onSave={onSave} />); expect(onSave).not.toHaveBeenCalled();
    failed = false; observed = { ...exact, effort_id: null };
    rerender(<SelectionPanel initial={null} busy={false} onSave={onSave} />); expect(onSave).not.toHaveBeenCalled();
  });
  it("uses the chosen mode's own configured selection and leaves an unconfigured mode empty", async () => {
    render(<SelectionPanel initial={exact} busy={false} onSave={onSave} />);
    const user = userEvent.setup(); await user.click(header());
    await user.click(screen.getByRole("button", { name: "Modo" }));
    await user.click(screen.getByRole("option", { name: "API key" }));
    expect(screen.getByRole("button", { name: "Modelo" })).toHaveTextContent("Sin modelo asignado");
    expect(screen.getByRole("button", { name: "Guardar selección" })).toBeDisabled(); expect(onSave).not.toHaveBeenCalled();
  });
});
