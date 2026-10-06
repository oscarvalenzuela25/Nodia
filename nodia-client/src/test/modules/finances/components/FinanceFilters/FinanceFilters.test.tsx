import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import FinanceFilters from "../../../../../modules/finances/components/FinanceFilters";
import type { SelectSingleInputProps } from "../../../../../components/inputs/SelectSingleInput/types";
import type { FinanceQuery } from "../../../../../modules/finances/types";
import type { FinanceRemoteMultiSelectProps } from "../../../../../modules/finances/components/FinanceRemoteSelect/types";
vi.mock(
  "../../../../../modules/finances/components/FinanceRemoteSelect",
  () => ({
    default: ({ label }: { label: string }) => <span>{label}</span>,
    FinanceRemoteMultiSelect: ({ label, onChange, onOptionsResolved }: FinanceRemoteMultiSelectProps) => (
      <button onClick={() => {
        onOptionsResolved?.([{ id: "1", name: "Comida", key: "food" }]);
        onChange(["1"]);
      }}>{label}</button>
    ),
  }),
);
vi.mock("../../../../../components/inputs/SelectSingleInput", () => ({
  default: ({
    label,
    value,
    options,
    onChange,
    disabled,
  }: SelectSingleInputProps) => (
    <label>
      {label}
      <select
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="" />
        {options.map((option) =>
          typeof option === "string" ? (
            <option key={option}>{option}</option>
          ) : (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ),
        )}
      </select>
    </label>
  ),
}));

describe("FinanceFilters", () => {
  it("starts active, applies explicit inactive, and clear returns active", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FinanceFilters
        resource="movements"
        query={{ active: "active", limit: 25 }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    expect(screen.getByLabelText("Visibilidad")).toHaveValue("active");
    await user.selectOptions(
      screen.getByLabelText("Visibilidad"),
      "inactive",
    );
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ active: "inactive", page: 1, limit: 25 }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(onChange).toHaveBeenLastCalledWith({
      active: "active",
      page: 1,
      limit: 25,
    });
  });

  it("builds an inclusive Santiago calendar period and rejects inverted dates", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FinanceFilters
        resource="movements"
        query={{ active: "active" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    await user.type(
      screen.getByLabelText("Creado desde"),
      "2026-04-01",
    );
    await user.type(screen.getByLabelText("Creado hasta"), "2026-03-31");
    expect(
      screen.getByRole("button", { name: "Filtrar" }),
    ).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Creado hasta"));
    await user.type(screen.getByLabelText("Creado hasta"), "2026-04-01");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        q: {
          created_at_gteq: "2026-04-01T03:00:00.000Z",
          created_at_lt: "2026-04-02T03:00:00.000Z",
        },
      }),
    );
  });

  it("resets discarded draft to applied query on reopen and clears incompatible status", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FinanceFilters
        resource="movements"
        query={{
          active: "active",
          q: { type_eq: "expense", status_eq: "paid" },
        }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    await user.selectOptions(
      screen.getByLabelText("Visibilidad"),
      "all",
    );
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    expect(screen.getByLabelText("Visibilidad")).toHaveValue("active");
    await user.selectOptions(screen.getByLabelText("Tipo"), "income");
    expect(screen.getByLabelText("Estado")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: { type_eq: "income" } }),
    );
  });

  it("shows a removable active chip below the trigger and counts only applied filters", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const props = { resource: "categories" as const, query: { active: "active" as const, page: 3, limit: 25 }, onChange };
    const { rerender } = render(<FinanceFilters {...props} />);
    const trigger = screen.getByRole("button", { name: "Abrir filtros" });
    expect(within(trigger).getByText("Filtro")).toBeInTheDocument();
    expect(within(trigger).getByText("1")).toBeInTheDocument();
    const remove = screen.getByRole("button", { name: "Quitar filtro: Solo activos" });
    expect(trigger.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(remove);
    expect(onChange).toHaveBeenLastCalledWith({ active: "all", page: 1, limit: 25 });
    rerender(<FinanceFilters {...props} query={{ active: "all", limit: 25 }} />);
    expect(screen.queryByText("Solo activos")).not.toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Abrir filtros" })).queryByText("1")).not.toBeInTheDocument();
  });

  it("counts every visible chip and removes only its predicate or selection while retaining search", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const query: FinanceQuery = {
      active: "inactive", page: 4, limit: 25,
      category_ids: ["1", "2"], category_group_ids: ["3"], obligation_id: "4",
      q: { name_cont: "rent", type_eq: "expense", status_eq: "paid", created_at_gteq: "2026-04-01T03:00:00.000Z", created_at_lt: "2026-04-02T03:00:00.000Z" },
    };
    render(<FinanceFilters resource="movements" query={query} onChange={onChange} />);
    expect(within(screen.getByRole("button", { name: "Abrir filtros" })).getByText("9")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Quitar filtro:/ })).toHaveLength(9);
    expect(screen.getByText("Creado hasta: 2026-04-01")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Quitar filtro: Tipo: Gasto" }));
    const remainingPredicates = { ...query.q };
    delete remainingPredicates.type_eq;
    expect(onChange).toHaveBeenLastCalledWith({ ...query, page: 1, q: remainingPredicates });
    await user.click(screen.getByRole("button", { name: "Quitar filtro: Categoría: #1" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...query, page: 1, category_ids: ["2"] });
    await user.click(screen.getByRole("button", { name: "Quitar filtro: Grupos de categorías: #3" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...query, page: 1, category_group_ids: [] });
    await user.click(screen.getByRole("button", { name: "Quitar filtro: Préstamo o deuda: #4" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...query, page: 1, obligation_id: undefined });
  });

  it("blocks removing filters while the section is busy", async () => {
    const onChange = vi.fn();
    render(<FinanceFilters resource="categories" query={{ active: "active" }} onChange={onChange} disabled />);
    expect(screen.getByRole("button", { name: "Abrir filtros" })).toBeDisabled();
    const remove = screen.getByRole("button", { name: "Quitar filtro: Solo activos" });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps selected category names after applying and closing the filter modal", async () => {
    const user = userEvent.setup();
    function ControlledFilters() {
      const [query, setQuery] = useState<FinanceQuery>({ active: "active" });
      return <FinanceFilters resource="movements" query={query} onChange={setQuery} />;
    }
    render(<ControlledFilters />);
    await user.click(screen.getByRole("button", { name: "Abrir filtros" }));
    await user.click(screen.getByRole("button", { name: "Categorías" }));
    await user.click(screen.getByRole("button", { name: "Filtrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Quitar filtro: Categoría: Comida (food)" })).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Abrir filtros" })).getByText("2")).toBeInTheDocument();
  });
});
