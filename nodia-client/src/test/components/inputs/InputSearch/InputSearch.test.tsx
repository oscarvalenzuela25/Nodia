import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import InputSearch from "../../../../../src/components/inputs/InputSearch";

describe("InputSearch", () => {
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

  it("triggers onChange when typed", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <InputSearch
        value=""
        onChange={handleChange}
        placeholder="Buscar..."
      />
    );

    const input = screen.getByPlaceholderText("Buscar...");
    await user.type(input, "a");

    expect(handleChange).toHaveBeenCalledWith("a");
  });

  it("shows clear button when value is present and clears value on click", async () => {
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

    const clearButton = screen.getByLabelText("clear search");
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);
    expect(handleChange).toHaveBeenCalledWith("");
    expect(handleClear).toHaveBeenCalledTimes(1);
  });
});
