import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PaymentMethodButtons from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/PaymentMethodButtons";

describe("PaymentMethodButtons", () => {
  it("exposes four labelled methods, cash selected, and supports keyboard selection", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodButtons value="cash" onChange={onChange} disabled={false} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4); expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Otro" })).not.toBeInTheDocument();
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    buttons[1].focus(); await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("debit_card");
  });
  it("preserves an explicit method and blocks every payment control during a mutation", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodButtons value="bank_transfer" onChange={onChange} disabled />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[3]).toHaveAttribute("aria-pressed", "true");
    for (const button of buttons) expect(button).toBeDisabled();
    await userEvent.tab(); await userEvent.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
