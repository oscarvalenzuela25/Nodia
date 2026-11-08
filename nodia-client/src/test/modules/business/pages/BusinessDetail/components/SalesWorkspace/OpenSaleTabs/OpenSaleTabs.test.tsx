import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import OpenSaleTabs from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/OpenSaleTabs";

const sales = [
  { id: "a", number: 1, amount: "1200", pending: false, busy: false },
  { id: "b", number: 3, amount: "2400", pending: false, busy: false },
];
describe("OpenSaleTabs", () => {
  it("preserves sale numbers and announces the active cart and its total", () => {
    render(<OpenSaleTabs sales={sales} activeId="b" panelId="cart" disabled={false} onSelect={vi.fn()} onClose={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[0]).toHaveAttribute("tabindex", "-1");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("aria-controls", "cart");
    expect(tabs[1]).toHaveTextContent("Venta 3");
    expect(tabs[1]).toHaveTextContent("2.400");
  });
  it("supports arrow wrap, Home and End without moving focus into the scanner", async () => {
    const onSelect = vi.fn();
    render(<OpenSaleTabs sales={sales} activeId="a" panelId="cart" disabled={false} onSelect={onSelect} onClose={vi.fn()} />);
    const tabs = screen.getAllByRole("tab"); tabs[0].focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(onSelect).toHaveBeenLastCalledWith("b", "keyboard"); expect(tabs[1]).toHaveFocus();
    await userEvent.keyboard("{Home}"); expect(tabs[0]).toHaveFocus();
    await userEvent.keyboard("{End}"); expect(tabs[1]).toHaveFocus();
    await userEvent.keyboard("{ArrowRight}"); expect(tabs[0]).toHaveFocus();
  });
  it("closes the requested inactive cart without selecting it", async () => {
    const onSelect = vi.fn(), onClose = vi.fn();
    render(<OpenSaleTabs sales={sales} activeId="a" panelId="cart" disabled={false} onSelect={onSelect} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Cerrar Venta 3" }));
    expect(onClose).toHaveBeenCalledWith("b"); expect(onSelect).not.toHaveBeenCalled();
  });
  it("allows consulting a pending cart but prevents discarding it or an in-flight cart", () => {
    const pending = sales.map((sale, index) => ({ ...sale, pending: index === 0, busy: index === 1 }));
    render(<OpenSaleTabs sales={pending} activeId="a" panelId="cart" disabled={false} onSelect={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getAllByRole("tab")[0]).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar Venta 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cerrar Venta 3" })).toBeDisabled();
    expect(screen.getByText("Resultado pendiente")).toBeInTheDocument();
  });
});
