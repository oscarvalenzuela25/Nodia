import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SelectMultipleInput from "../../../../../src/components/inputs/SelectMultipleInput";

describe("SelectMultipleInput", () => {
  const options = ["Admin", "User", "Manager", "SuperAdmin"];

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
    const clearBtn = screen.getByLabelText("clear search");
    expect(clearBtn).toBeInTheDocument();
    await user.click(clearBtn);

    expect(screen.getByText("User")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();

    // Toggle option
    await user.click(screen.getByText("Manager"));
    expect(handleChange).toHaveBeenCalledWith(["Admin", "Manager"]);
  });
});
