import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import QuantityStepper, { type QuantityStepperProps } from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/QuantityStepper";
import i18n from "../../../../../../../../translate";

const makeProps = (overrides: Partial<QuantityStepperProps> = {}): QuantityStepperProps => ({ name: "Synthetic product", quantity: 1, disabled: false,
  onInputChange: vi.fn(), onIncrement: vi.fn(), onDecrement: vi.fn(), ...overrides });
const increase = () => screen.getByRole("button", { name: i18n.t("business:pos.increase_quantity", { name: "Synthetic product" }) });
const decrease = () => screen.getByRole("button", { name: i18n.t("business:pos.decrease_quantity", { name: "Synthetic product" }) });
const input = () => screen.getByRole("textbox", { name: "Cantidad" });
function EditableStepper({ initialValue, onChange }: { initialValue: string; onChange: (raw: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <QuantityStepper {...makeProps()} inputValue={value} onInputChange={(next) => { setValue(next); onChange(next); }} />;
}

describe("QuantityStepper controlled callbacks", () => {
  it("shows zero, blocks decrement at zero and emits one keyboard increment without submitting its surrounding form", async () => {
    const props = makeProps({ quantity: 0 }); const submit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={submit}><QuantityStepper {...props} /></form>);
    expect(input()).toHaveValue("0"); expect(decrease()).toBeDisabled(); expect(increase()).toBeEnabled();
    expect(input()).toHaveAccessibleDescription("Synthetic product");
    expect(screen.getByRole("group")).toHaveStyle({ position: "relative" });
    const user = userEvent.setup(); increase().focus(); await user.keyboard("{Enter}");
    expect(props.onIncrement).toHaveBeenCalledTimes(1); expect(props.onDecrement).not.toHaveBeenCalled(); expect(props.onInputChange).not.toHaveBeenCalled();
    input().focus(); await user.keyboard("{Enter}");
    expect(submit).not.toHaveBeenCalled(); expect(props.onIncrement).toHaveBeenCalledTimes(1);
  });
  it("permits decrementing one and leaves the zero row ownership to the parent", async () => {
    const props = makeProps(); render(<QuantityStepper {...props} />);
    await userEvent.setup().click(decrease());
    expect(props.onDecrement).toHaveBeenCalledTimes(1); expect(props.onInputChange).not.toHaveBeenCalled(); expect(props.onIncrement).not.toHaveBeenCalled();
    expect(input()).toHaveValue("1");
  });
  it("distinguishes an explicit zero, an empty draft and a fractional draft without coercing the last valid quantity", () => {
    const props = makeProps({ quantity: 3 }); const { rerender } = render(<QuantityStepper {...props} />);
    fireEvent.change(input(), { target: { value: "0" } });
    fireEvent.change(input(), { target: { value: "" } });
    fireEvent.change(input(), { target: { value: "1.5" } });
    expect(vi.mocked(props.onInputChange).mock.calls.map(([raw]) => raw)).toEqual(["0", "", "1.5"]);
    expect(props.onIncrement).not.toHaveBeenCalled(); expect(props.onDecrement).not.toHaveBeenCalled();
    rerender(<QuantityStepper {...props} inputValue="" />);
    expect(input()).toHaveValue(""); expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(i18n.t("business:pos.invalid_quantity"))).not.toBeInTheDocument();
    expect(input()).toHaveAccessibleDescription("Synthetic product");
    expect(increase()).toBeEnabled(); expect(decrease()).toBeEnabled();
  });
  it("blocks disabled controls and honours explicit per-direction locks while keeping manual correction available", () => {
    const props = makeProps({ disabled: true }); const { rerender } = render(<QuantityStepper {...props} />);
    expect(input()).toBeDisabled(); expect(increase()).toBeDisabled(); expect(decrease()).toBeDisabled();
    fireEvent.click(increase()); fireEvent.click(decrease());
    expect(props.onIncrement).not.toHaveBeenCalled(); expect(props.onDecrement).not.toHaveBeenCalled();
    rerender(<QuantityStepper {...props} disabled={false} incrementDisabled decrementDisabled />);
    expect(input()).toBeEnabled(); expect(increase()).toBeDisabled(); expect(decrease()).toBeDisabled();
    fireEvent.change(input(), { target: { value: "2" } }); expect(props.onInputChange).toHaveBeenCalledWith("2");
  });
  it("blocks increment at the server quantity maximum without losing its exact editable value", () => {
    render(<QuantityStepper {...makeProps({ quantity: 2147483647 })} />);
    expect(input()).toHaveValue("2147483647"); expect(increase()).toBeDisabled(); expect(decrease()).toBeEnabled();
  });
  it("keeps large three-decimal drafts fully editable without a length limit and silently flags excess precision", () => {
    const props = makeProps();
    const { rerender } = render(<QuantityStepper {...props} inputValue="2147483646.999" />);
    expect(input()).toHaveValue("2147483646.999");
    expect(input()).not.toHaveAttribute("maxlength");
    expect(input()).toHaveAttribute("inputmode", "decimal");
    expect(input()).toHaveAttribute("aria-invalid", "false");
    rerender(<QuantityStepper {...props} inputValue="0.0001" />);
    expect(input()).toHaveValue("0.0001");
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText(i18n.t("business:pos.invalid_quantity"))).not.toBeInTheDocument();
    fireEvent.change(input(), { target: { value: "2147483647" } });
    expect(props.onInputChange).toHaveBeenLastCalledWith("2147483647");
  });
  it.each([["1", ".", "0."], ["1", ",", "0,"], ["", ".", "0."]])("starts an editable decimal from %j with %j and preserves precision validation", async (initialValue, separator, prefix) => {
    const change = vi.fn(); const user = userEvent.setup();
    render(<EditableStepper initialValue={initialValue} onChange={change} />);
    input().focus();
    expect(input()).toHaveFocus();
    expect((input() as HTMLInputElement).selectionStart).toBe(0);
    expect((input() as HTMLInputElement).selectionEnd).toBe(initialValue.length);
    await user.keyboard(separator);
    expect(input()).toHaveValue(prefix);
    expect(change).toHaveBeenLastCalledWith(prefix);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    await user.keyboard("125");
    expect(input()).toHaveValue(`${prefix}125`);
    expect(change).toHaveBeenLastCalledWith(`${prefix}125`);
    expect(input()).toHaveAttribute("aria-invalid", "false");
    await user.keyboard("4");
    expect(input()).toHaveValue(`${prefix}1254`);
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toBeEnabled();
  });
});
