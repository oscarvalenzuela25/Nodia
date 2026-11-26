import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createTheme, getContrastRatio, ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import PaymentMethodButtons from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/PaymentMethodButtons";
import { darkPalette, lightPalette } from "../../../../../../../../theme/palette";

describe("PaymentMethodButtons", () => {
  it("exposes three labelled methods, cash selected, and supports keyboard selection", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodButtons value="cash" onChange={onChange} disabled={false} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3); expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(within(buttons[0]).getByTestId("PaymentsOutlinedIcon")).toBeInTheDocument();
    expect(within(buttons[0]).getByTestId("CheckCircleOutlinedIcon")).toBeInTheDocument();
    expect(within(buttons[0]).getByText("Seleccionado")).toBeVisible();
    expect(buttons[0]).toHaveAccessibleName("Efectivo");
    expect(within(buttons[1]).queryByTestId("CheckCircleOutlinedIcon")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Otro" })).not.toBeInTheDocument();
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    buttons[1].focus(); await userEvent.keyboard("{Enter}");
    expect(buttons[1]).toHaveAccessibleName("Tarjeta");
    expect(onChange).toHaveBeenCalledWith("card");
  });
  it.each([lightPalette, darkPalette])("sets distinct readable colors in the $mode Nodia palette", (palette) => {
    const theme = createTheme({ palette });
    const onChange = vi.fn();
    const { rerender } = render(<ThemeProvider theme={theme}><PaymentMethodButtons value="other" onChange={onChange} disabled={false} /></ThemeProvider>);
    const inactive = screen.getAllByRole("button").map((button) => getComputedStyle(button).backgroundColor);
    expect(new Set(inactive).size).toBe(3);
    for (const [index, value] of (["cash", "card", "bank_transfer"] as const).entries()) {
      rerender(<ThemeProvider theme={theme}><PaymentMethodButtons value={value} onChange={onChange} disabled={false} /></ThemeProvider>);
      const states = screen.getAllByRole("button");
      expect(within(states[index]).getByText("Seleccionado")).toBeVisible();
      for (const [buttonIndex, button] of states.entries()) {
        const style = getComputedStyle(button);
        if (buttonIndex === index) expect(style.backgroundColor).not.toBe(inactive[index]);
        expect(getContrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(buttonIndex === index ? 7 : 4.5);
      }
    }
  });
  it("preserves an explicit method and blocks every payment control during a mutation", async () => {
    const onChange = vi.fn();
    render(<PaymentMethodButtons value="bank_transfer" onChange={onChange} disabled />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[2]).toHaveAttribute("aria-pressed", "true");
    for (const button of buttons) expect(button).toBeDisabled();
    await userEvent.tab(); await userEvent.keyboard("{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });
  it("groups historical debit and credit in Tarjeta and exposes the checked switch for combined selection", async () => {
    const onChange = vi.fn();
    const onCombineChange = vi.fn();
    const { rerender } = render(<PaymentMethodButtons value="debit_card" onChange={onChange} onCombineChange={onCombineChange} disabled={false} />);
    expect(screen.getByRole("button", { name: "Tarjeta" })).toHaveAttribute("aria-pressed", "true");
    const toggle = screen.getByRole("switch", { name: "Combinar pagos" });
    expect(toggle).not.toBeChecked();
    await userEvent.click(toggle);
    expect(onCombineChange).toHaveBeenCalledExactlyOnceWith(true);
    rerender(<PaymentMethodButtons value="credit_card" combined={["card", "bank_transfer"]} onChange={onChange} onCombineChange={onCombineChange} disabled={false} />);
    expect(toggle).toBeChecked();
    expect(screen.getByRole("button", { name: "Tarjeta" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Transferencia" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Efectivo" })).toHaveAttribute("aria-pressed", "false");
  });
});
