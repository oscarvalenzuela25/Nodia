import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import IconSelect from "../../../../../src/components/inputs/IconSelect";

describe("IconSelect", () => {
  it("renders label, placeholder, and default fallback preview when value is null", () => {
    render(
      <IconSelect
        label="Ícono de Módulo"
        value={null}
        onChange={vi.fn()}
        placeholder="Por defecto"
      />
    );

    expect(screen.getByText("Ícono de Módulo")).toBeInTheDocument();
    expect(screen.getByText("Por defecto")).toBeInTheDocument();
    expect(screen.getByTestId("icon-select-trigger")).toBeInTheDocument();
  });

  it("opens popover on click and shows icon list", async () => {
    const user = userEvent.setup();
    render(
      <IconSelect
        label="Ícono"
        value={null}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByTestId("icon-select-trigger");
    await user.click(trigger);

    expect(screen.getByTestId("icon-select-options")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Buscar ícono/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-select-default-option")).toBeInTheDocument();
  });

  it("filters icons by search term and selects an icon", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <IconSelect
        label="Ícono"
        value={null}
        onChange={handleChange}
      />
    );

    const trigger = screen.getByTestId("icon-select-trigger");
    await user.click(trigger);

    const searchInput = screen.getByTestId("icon-select-search").querySelector("input")!;
    await user.type(searchInput, "Usuarios");

    const optionBtn = screen.getByTestId("icon-select-option-PeopleOutlined");
    expect(optionBtn).toBeInTheDocument();

    await user.click(optionBtn);

    expect(handleChange).toHaveBeenCalledWith("PeopleOutlined");
    await waitFor(() => {
      expect(screen.queryByTestId("icon-select-options")).not.toBeInTheDocument();
    });
  });

  it("displays selected value and allows clearing via clear button", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <IconSelect
        label="Ícono"
        value="PeopleOutlined"
        onChange={handleChange}
        clearable={true}
      />
    );

    expect(screen.getByText(/Usuarios \(PeopleOutlined\)/i)).toBeInTheDocument();

    const clearBtn = screen.getByTestId("icon-select-clear");
    await user.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it("allows selecting 'Usar ícono por defecto' to reset selection to null", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <IconSelect
        label="Ícono"
        value="DashboardOutlinedIcon"
        onChange={handleChange}
      />
    );

    const trigger = screen.getByTestId("icon-select-trigger");
    await user.click(trigger);

    const defaultOption = screen.getByTestId("icon-select-default-option");
    await user.click(defaultOption);

    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it("does not open popover when disabled", async () => {
    const user = userEvent.setup();

    render(
      <IconSelect
        label="Ícono"
        value={null}
        onChange={vi.fn()}
        disabled={true}
      />
    );

    const trigger = screen.getByTestId("icon-select-trigger");
    await user.click(trigger);

    expect(screen.queryByTestId("icon-select-options")).not.toBeInTheDocument();
  });

  it("supports keyboard navigation: Enter opens, Escape closes", async () => {
    const user = userEvent.setup();

    render(
      <IconSelect
        label="Ícono"
        value={null}
        onChange={vi.fn()}
      />
    );

    const trigger = screen.getByTestId("icon-select-trigger");
    trigger.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("icon-select-options")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByTestId("icon-select-options")).not.toBeInTheDocument();
    });
  });
});
