import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SelectMultipleInput from "../../../../../src/components/inputs/SelectMultipleInput";

describe("SelectMultipleInput", () => {
  const options = ["Admin", "User", "Manager", "SuperAdmin"];

  it("uses selected-only labels without removing selections outside the loaded page", async () => {
    const change = vi.fn(); const user = userEvent.setup();
    render(<SelectMultipleInput label="Categories" options={[{ value: "1", label: "Loaded one" }, { value: "2", label: "Loaded two" }]} selectedOptions={[{ value: "99", label: "Outside page" }]} value={["1", "2", "99"]} onChange={change} onSearchChange={vi.fn()} />);
    expect(screen.getByText("Outside page")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Categories" }));
    await user.click(screen.getByRole("checkbox", { name: /Deseleccionar.*cargados|Deselect loaded/ }));
    expect(change).toHaveBeenCalledWith(["99"]);
  });

  it("renders label, placeholder and required indicator", () => {
    render(
      <SelectMultipleInput
        label="Roles"
        required
        options={options}
        value={[]}
        onChange={vi.fn()}
        placeholder="Select roles..."
      />
    );

    expect(screen.getByText("Roles")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Select roles...")).toBeInTheDocument();
  });

  it("opens popover with options on click, allows selecting and filtering", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Roles"
        options={options}
        value={["Admin"]}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("Admin")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /Roles/i });
    await user.click(trigger);

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();

    // Type to search inside popover
    const searchInput = screen.getByPlaceholderText(/Buscar|Search/i);
    await user.type(searchInput, "Man");

    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.queryByText("User")).not.toBeInTheDocument();

    // Clear search button should appear and restore all options
    const clearBtn = screen.getByLabelText("Limpiar búsqueda");
    expect(clearBtn).toBeInTheDocument();
    await user.click(clearBtn);

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();

    // Toggle option
    await user.click(screen.getByText("Manager"));
    expect(handleChange).toHaveBeenCalledWith(["Admin", "Manager"]);
  });

  it("renders select-all checkbox when options >= 2 and selects all options on click", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Roles"
        options={options}
        value={[]}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /Roles/i });
    await user.click(trigger);

    const selectAllCheckbox = screen.getByRole("checkbox", {
      name: /seleccionar todo|select all/i,
    });
    expect(selectAllCheckbox).toBeInTheDocument();
    expect(selectAllCheckbox).not.toBeChecked();

    await user.click(selectAllCheckbox);
    expect(handleChange).toHaveBeenCalledWith(options);
  });

  it("deselects all options when clicked while all options are selected", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Roles"
        options={options}
        value={options}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /Roles/i });
    await user.click(trigger);

    const deselectAllCheckbox = screen.getByRole("checkbox", {
      name: /deseleccionar todo|deselect all/i,
    });
    expect(deselectAllCheckbox).toBeInTheDocument();
    expect(deselectAllCheckbox).toBeChecked();

    await user.click(deselectAllCheckbox);
    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it("shows indeterminate state when only some options are selected and selects all on click", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Roles"
        options={options}
        value={["Admin", "User"]}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /Roles/i });
    await user.click(trigger);

    const selectAllCheckbox = screen.getByRole("checkbox", {
      name: /seleccionar todo|select all/i,
    });
    expect(selectAllCheckbox).toHaveAttribute("data-indeterminate", "true");

    await user.click(selectAllCheckbox);
    expect(handleChange).toHaveBeenCalledWith(options);
  });

  it("does not render select-all checkbox when options length is less than 2", async () => {
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Single Role"
        options={["Admin"]}
        value={[]}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: /Single Role/i });
    await user.click(trigger);

    expect(
      screen.queryByRole("checkbox", {
        name: /seleccionar todo|select all|deseleccionar todo|deselect all/i,
      })
    ).not.toBeInTheDocument();
  });

  it("selects and deselects only filtered options when search term is active", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Roles"
        options={options}
        value={["Admin"]}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /Roles/i });
    await user.click(trigger);

    // Search for "Admin" and "SuperAdmin"
    const searchInput = screen.getByPlaceholderText(/Buscar|Search/i);
    await user.type(searchInput, "Admin");

    // Filtered options are ["Admin", "SuperAdmin"]. "Admin" is selected, "SuperAdmin" is not.
    // Indeterminate select-all checkbox:
    const selectAllCheckbox = screen.getByRole("checkbox", {
      name: /seleccionar todo|select all/i,
    });
    expect(selectAllCheckbox).toHaveAttribute("data-indeterminate", "true");

    // Click select all -> selects SuperAdmin as well while preserving existing
    await user.click(selectAllCheckbox);
    expect(handleChange).toHaveBeenCalledWith(["Admin", "SuperAdmin"]);
  });

  it("deselects only filtered options when search is active and all filtered options are selected", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SelectMultipleInput
        label="Roles"
        options={options}
        value={["Admin", "SuperAdmin", "User"]}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByRole("button", { name: /Roles/i });
    await user.click(trigger);

    const searchInput = screen.getByPlaceholderText(/Buscar|Search/i);
    await user.type(searchInput, "Admin");

    const deselectCheckbox = screen.getByRole("checkbox", {
      name: /deseleccionar todo|deselect all/i,
    });
    expect(deselectCheckbox).toBeChecked();

    await user.click(deselectCheckbox);
    expect(handleChange).toHaveBeenCalledWith(["User"]);
  });
  it("keeps selected values outside remote results when selecting the loaded page", async () => {
    const user = userEvent.setup(), change = vi.fn(), search = vi.fn(), load = vi.fn();
    render(<SelectMultipleInput label="Remote" options={[{ value: "new", label: "New result" }, { value: "other", label: "Other result" }]} value={["previous"]} onChange={change} onSearchChange={search} hasMore onLoadMore={load} />);
    await user.click(screen.getByRole("button", { name: "Remote" }));
    await user.click(screen.getByRole("checkbox", { name: "Seleccionar resultados cargados" }));
    expect(change).toHaveBeenCalledWith(["previous", "new", "other"]);
    await user.click(screen.getByRole("button", { name: "Cargar más" })); expect(load).toHaveBeenCalledOnce();
    await user.type(screen.getByPlaceholderText("Buscar..."), "rare"); expect(search).toHaveBeenLastCalledWith("rare");
  });
});
