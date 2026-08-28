import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import Filter from "../../../../src/components/Filter";

describe("Filter", () => {
  it("renders trigger and opens modal on click", async () => {
    const handleFilter = vi.fn();
    const handleClear = vi.fn();
    const user = userEvent.setup();

    render(
      <Filter
        onFilter={handleFilter}
        onClear={handleClear}
        activeCount={2}
        title="Custom Filter Title"
      >
        <div>Filter Content Inside</div>
      </Filter>
    );

    const trigger = screen.getByRole("button", { name: /Abrir filtros/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("Custom Filter Title")).toBeInTheDocument();
    expect(screen.getByText("Filter Content Inside")).toBeInTheDocument();

    // Click filter action
    const applyBtn = screen.getByRole("button", { name: /Filtrar|Filter/i });
    await user.click(applyBtn);

    expect(handleFilter).toHaveBeenCalledTimes(1);
  });

  it("calls onClear when clear button is clicked", async () => {
    const handleFilter = vi.fn();
    const handleClear = vi.fn();
    const user = userEvent.setup();

    render(
      <Filter
        onFilter={handleFilter}
        onClear={handleClear}
        title="Filter Title"
      >
        <div>Filter Content</div>
      </Filter>
    );

    const trigger = screen.getByRole("button", { name: /Abrir filtros/i });
    await user.click(trigger);

    const clearBtn = screen.getByRole("button", { name: /Limpiar filtros|Clear filters/i });
    await user.click(clearBtn);

    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
