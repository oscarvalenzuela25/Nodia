import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FinanceActiveSwitch from "../../../../../modules/finances/components/FinanceActiveSwitch";

describe("FinanceActiveSwitch", () => {
  it("shows active state and emits the chosen boolean, while disabled prevents changes", async () => {
    const change = vi.fn();
    const { rerender } = render(
      <FinanceActiveSwitch value onChange={change} />,
    );
    const control = screen.getByRole("switch");
    expect(control).toBeChecked();
    await userEvent.setup().click(control);
    expect(change).toHaveBeenCalledWith(false);
    change.mockClear();
    rerender(<FinanceActiveSwitch value={false} onChange={change} disabled />);
    expect(screen.getByRole("switch")).toBeDisabled();
    expect(change).not.toHaveBeenCalled();
  });
});
