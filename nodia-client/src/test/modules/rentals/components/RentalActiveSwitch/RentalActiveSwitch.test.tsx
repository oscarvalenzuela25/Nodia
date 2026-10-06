import { expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RentalActiveSwitch from "../../../../../modules/rentals/components/RentalActiveSwitch";
it("reports a boolean change and locks interaction when disabled", async () => {
  const change = vi.fn();
  const { rerender } = render(<RentalActiveSwitch checked onChange={change} />);
  await userEvent.click(screen.getByRole("switch"));
  expect(change).toHaveBeenCalledWith(false);
  rerender(<RentalActiveSwitch checked onChange={change} disabled />);
  expect(screen.getByRole("switch")).toBeDisabled();
});

it("requires explicit confirmation before changing an existing record", async () => {
  const change = vi.fn();
  render(
    <RentalActiveSwitch
      checked
      onChange={change}
      confirmChanges
      confirmationMessage="Keeps occupied dates"
    />,
  );
  await userEvent.click(screen.getByRole("switch"));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByText("Keeps occupied dates")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(change).toHaveBeenCalledWith(false);
});
