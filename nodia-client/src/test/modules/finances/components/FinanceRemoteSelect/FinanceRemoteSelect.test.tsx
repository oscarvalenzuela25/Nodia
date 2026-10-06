import {
  financeMock,
  resetFinanceMocks,
  category,
} from "../FinanceCatalogModal/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceRemoteSelect, {
  FinanceRemoteMultiSelect,
} from "../../../../../modules/finances/components/FinanceRemoteSelect";

describe("FinanceRemoteSelect", () => {
  beforeEach(resetFinanceMocks);
  it("reports existing option labels for filter chips without extra record reads", async () => {
    const onOptionsResolved = vi.fn();
    render(<FinanceRemoteMultiSelect resource="categories" label="Categories" value={[category.id]} onChange={vi.fn()} onOptionsResolved={onOptionsResolved} />);
    await waitFor(() => expect(onOptionsResolved).toHaveBeenCalledWith(expect.arrayContaining([category])));
    expect(financeMock.record).not.toHaveBeenCalled();
  });
  it("hydrates a single selected category by ID without replacing its identity", () => {
    financeMock.record.mockReturnValue({
      data: {
        ...category,
        id: "99",
        name: "Historical category",
        is_active: false,
      },
      isFetching: false,
      isError: false,
    });
    const change = vi.fn();
    render(
      <FinanceRemoteSelect
        resource="categories"
        label="Category"
        value="99"
        onChange={change}
      />,
    );
    expect(screen.getByText("Historical category")).toBeInTheDocument();
    expect(financeMock.record).toHaveBeenCalledWith("categories", "99", true);
    expect(change).not.toHaveBeenCalled();
  });
  it("blocks unresolved required selection without changing the value", async () => {
    financeMock.record.mockReturnValue({
      data: undefined,
      isFetching: false,
      isError: true,
    });
    const change = vi.fn();
    const state = vi.fn();
    render(
      <FinanceRemoteSelect
        resource="categories"
        label="Category"
        value="99"
        required
        onChange={change}
        onSelectionStateChange={state}
      />,
    );
    await waitFor(() =>
      expect(state).toHaveBeenLastCalledWith({ busy: false, invalid: true }),
    );
    expect(change).not.toHaveBeenCalled();
  });
  it("debounces server search and fetches an additional page", async () => {
    const more = vi.fn();
    financeMock.options.mockReturnValue({
      data: { pages: [{ data: [category] }] },
      isFetching: false,
      hasNextPage: true,
      fetchNextPage: more,
    });
    const user = userEvent.setup();
    render(
      <FinanceRemoteSelect
        resource="categories"
        label="Category"
        value={null}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Category" }));
    await user.click(
      screen.getByRole("button", { name: /Cargar más|Load more/ }),
    );
    expect(more).toHaveBeenCalledTimes(1);
    await user.type(screen.getByPlaceholderText(/Buscar|Search/), "home");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 280));
    });
    expect(financeMock.options).toHaveBeenLastCalledWith(
      "categories",
      "home",
      true,
      "active",
    );
  });
  it("keeps historical labels separate from select loaded actions", async () => {
    financeMock.options.mockReturnValue({
      data: {
        pages: [
          { data: [category, { ...category, id: "11", name: "Housing" }] },
        ],
      },
      isFetching: false,
      hasNextPage: false,
    });
    const change = vi.fn();
    const user = userEvent.setup();
    render(
      <FinanceRemoteMultiSelect
        resource="categories"
        label="Categories"
        value={["99", "10", "11"]}
        selectedOptions={[{ id: "99", name: "Historical" }]}
        onChange={change}
      />,
    );
    expect(screen.getByText("Historical")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    await user.click(
      screen.getByRole("checkbox", {
        name: /Deseleccionar.*cargados|Deselect loaded/,
      }),
    );
    expect(change).toHaveBeenCalledWith(["99"]);
  });
  it("permits unresolved filter IDs after remount but does not permit unresolved form selections", async () => {
    const filterState = vi.fn();
    const { rerender } = render(
      <FinanceRemoteMultiSelect
        resource="categories"
        label="Categories"
        value={["99"]}
        onChange={vi.fn()}
        allowUnresolved
        active="all"
        onSelectionStateChange={filterState}
      />,
    );
    await waitFor(() =>
      expect(filterState).toHaveBeenLastCalledWith({
        busy: false,
        invalid: false,
      }),
    );
    expect(financeMock.options).toHaveBeenLastCalledWith(
      "categories",
      "",
      true,
      "all",
    );
    rerender(
      <FinanceRemoteMultiSelect
        resource="categories"
        label="Categories"
        value={["99"]}
        onChange={vi.fn()}
        onSelectionStateChange={filterState}
      />,
    );
    await waitFor(() =>
      expect(filterState).toHaveBeenLastCalledWith({
        busy: false,
        invalid: true,
      }),
    );
  });
});
