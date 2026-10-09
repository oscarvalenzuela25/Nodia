import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import InputSearch from "../../../../../src/components/inputs/InputSearch";

describe("InputSearch", () => {
  it("disables clearing along with the search input while fetching, preserving the draft", async () => {
    const change = vi.fn();
    render(<InputSearch value="Reservas" onChange={change} disabled />);
    const clear = screen.getByRole("button", { name: "Limpiar búsqueda" });
    expect(clear).toBeDisabled();
    await userEvent.tab();
    expect(clear).not.toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("Reservas");
    expect(change).not.toHaveBeenCalled();
  });
  it("provides an accessible translated search name and permits a specific label", () => {
    const view = render(<InputSearch value="" onChange={vi.fn()} placeholder="Buscar sección" />);
    expect(screen.getByRole("textbox", { name: "Buscar sección" })).toBeInTheDocument();
    view.rerender(<InputSearch value="" onChange={vi.fn()} placeholder="Buscar sección" ariaLabel="Secciones" />);
    expect(screen.getByRole("textbox", { name: "Secciones" })).toBeInTheDocument();
  });
  it("renders with placeholder and value", () => {
    render(
      <InputSearch
        value="Juan"
        onChange={vi.fn()}
        placeholder="Buscar..."
      />
    );

    const input = screen.getByPlaceholderText("Buscar...");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Juan");
  });

  it("updates input display immediately and triggers onChange after debounce when typed", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <InputSearch
        value=""
        onChange={handleChange}
        placeholder="Buscar..."
        debounceMs={150}
      />
    );

    const input = screen.getByPlaceholderText("Buscar...");
    await user.type(input, "hello");

    // Input display is updated immediately
    expect(input).toHaveValue("hello");

    // Before debounce time finishes, handleChange is not yet called with full word
    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("hello");
    });
  });

  it("triggers onChange immediately when debounceMs is 0", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <InputSearch
        value=""
        onChange={handleChange}
        placeholder="Buscar..."
        debounceMs={0}
      />
    );

    const input = screen.getByPlaceholderText("Buscar...");
    await user.type(input, "a");

    expect(handleChange).toHaveBeenCalledWith("a");
  });

  it("shows clear button when value is present and clears value immediately on click", async () => {
    const handleChange = vi.fn();
    const handleClear = vi.fn();
    const user = userEvent.setup();

    render(
      <InputSearch
        value="test"
        onChange={handleChange}
        onClear={handleClear}
        placeholder="Buscar..."
      />
    );

    const clearButton = screen.getByLabelText("Limpiar búsqueda");
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith("");
    expect(handleClear).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const input = screen.getByPlaceholderText("Buscar...");
      expect(input).toHaveFocus();
    });
  });

  it("retains focus on input after search is executed via debounce", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <InputSearch
        value=""
        onChange={handleChange}
        placeholder="Buscar..."
        debounceMs={50}
      />
    );

    const input = screen.getByPlaceholderText("Buscar...");
    await user.type(input, "admin");

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("admin");
    });

    expect(input).toHaveFocus();
  });

  it("restores focus when temporarily disabled and then re-enabled", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <InputSearch
        value=""
        onChange={vi.fn()}
        placeholder="Buscar..."
        disabled={false}
      />
    );

    const input = screen.getByPlaceholderText("Buscar...");
    await user.click(input);
    expect(input).toHaveFocus();

    // Temporarily disabled (e.g. during a mutation)
    rerender(
      <InputSearch
        value=""
        onChange={vi.fn()}
        placeholder="Buscar..."
        disabled={true}
      />
    );

    // Re-enabled
    rerender(
      <InputSearch
        value=""
        onChange={vi.fn()}
        placeholder="Buscar..."
        disabled={false}
      />
    );

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("renders with fullWidth by default to fill container width", () => {
    const { container } = render(
      <InputSearch
        value=""
        onChange={vi.fn()}
        placeholder="Buscar..."
      />
    );

    expect(container.querySelector(".MuiFormControl-fullWidth")).toBeInTheDocument();
  });

  it("allows disabling fullWidth when fullWidth={false}", () => {
    const { container } = render(
      <InputSearch
        value=""
        onChange={vi.fn()}
        placeholder="Buscar..."
        fullWidth={false}
      />
    );

    expect(container.querySelector(".MuiFormControl-fullWidth")).not.toBeInTheDocument();
  });
});

