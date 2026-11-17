import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import PriceDivisionDialog, { PriceDivisionAction } from "../../../components/PriceDivisionDialog";

vi.mock("sileo", () => ({ sileo: { success: vi.fn() } }));

describe("PriceDivisionDialog", () => {
  it("keeps edits local, blocks invalid division and applies a single rounded sale result", async () => {
    const onApply = vi.fn(); const onClose = vi.fn();
    render(<PriceDivisionDialog open value={2889} mode="sale" label="Precio de venta" onApply={onApply} onClose={onClose} />);
    const amount = screen.getByRole("textbox", { name: "Precio a dividir" });
    const divisor = screen.getByRole("textbox", { name: "Dividir entre" });
    const apply = screen.getByRole("button", { name: "Aplicar resultado" });
    expect(amount).toHaveValue("2889");
    fireEvent.change(divisor, { target: { value: "0" } });
    expect(apply).toBeDisabled(); expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(divisor, { target: { value: "2" } });
    await userEvent.setup().click(apply);
    expect(onApply).toHaveBeenCalledExactlyOnceWith(1440);
    expect(onClose).toHaveBeenCalledOnce();
    expect(sileo.success).toHaveBeenCalledWith({ title: "Resultado aplicado al borrador" });
  });
  it("keeps net precision and lets cancel discard without applying", async () => {
    const onApply = vi.fn(); const onClose = vi.fn();
    const props = { open: true, value: 2889, mode: "net" as const, label: "Precio neto", onApply, onClose };
    const { rerender } = render(<PriceDivisionDialog {...props} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Dividir entre" }), { target: { value: "2" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onApply).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledOnce();
    rerender(<PriceDivisionDialog {...props} open={false} />);
    rerender(<PriceDivisionDialog {...props} />);
    expect(screen.getByRole("textbox", { name: "Dividir entre" })).toHaveValue("1");
    fireEvent.change(screen.getByRole("textbox", { name: "Dividir entre" }), { target: { value: "2" } });
    await userEvent.setup().click(screen.getByRole("button", { name: "Aplicar resultado" }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith(1445);
  });
  it("discards an obsolete opening when editing context changes and Enter does not apply", async () => {
    const user = userEvent.setup(); const onApply = vi.fn();
    const { rerender } = render(<PriceDivisionAction value={2889} mode="sale" label="Precio de venta" contextKey="first" onApply={onApply} />);
    await user.click(screen.getByRole("button", { name: "Dividir Precio de venta" }));
    const dialog = screen.getByRole("dialog", { name: "Dividir precio" });
    await user.click(within(dialog).getByRole("textbox", { name: "Dividir entre" }));
    await user.keyboard("{Enter}"); expect(onApply).not.toHaveBeenCalled();
    rerender(<PriceDivisionAction value={4000} mode="sale" label="Precio de venta" contextKey="second" onApply={onApply} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dividir Precio de venta" }));
    expect(screen.getByRole("textbox", { name: "Precio a dividir" })).toHaveValue("4000");
    await user.click(screen.getByRole("button", { name: "Aplicar resultado" }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith(4000);
  });
  it("blocks applying while the owning form is busy but keeps the local cancel available", () => {
    const onApply = vi.fn(); const onClose = vi.fn();
    render(<PriceDivisionDialog open value={1445} mode="sale" label="Precio de venta" disabled onApply={onApply} onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Aplicar resultado" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Precio a dividir" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce(); expect(onApply).not.toHaveBeenCalled();
  });
});
