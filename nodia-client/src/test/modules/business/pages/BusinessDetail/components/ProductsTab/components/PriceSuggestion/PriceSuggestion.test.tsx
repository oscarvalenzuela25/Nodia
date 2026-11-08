import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sileo } from "sileo";
import userEvent from "@testing-library/user-event";
import PriceSuggestion from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/PriceSuggestion";
import i18n from "../../../../../../../../../translate";

vi.mock("sileo", () => ({ sileo: { success: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const markupInput = () => screen.getByTestId("product-suggested-markup-input").querySelector("input")!;

describe("local product price suggestion", () => {
  it.each([['es', '13.000'], ['en', '13,000']])("shows a grouped integer without currency in %s and applies its numeric value", async (language, expected) => {
    await i18n.changeLanguage(language);
    const apply = vi.fn();
    render(<PriceSuggestion costPriceTax={10000} onApply={apply} />);
    expect(screen.getByRole("status")).toHaveTextContent(expected);
    expect(screen.getByRole("status").textContent?.trim()).toBe(expected);
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(apply).toHaveBeenCalledExactlyOnceWith(13000);
  });
  it("starts at thirty percent and applies only on explicit confirmation, including decimal markup", () => {
    const apply = vi.fn();
    const { rerender } = render(<PriceSuggestion costPriceTax={1190} onApply={apply} />);
    expect(markupInput()).toHaveValue("30");
    expect(apply).not.toHaveBeenCalled();
    fireEvent.change(markupInput(), { target: { value: "2,5" } });
    rerender(<PriceSuggestion costPriceTax={1000} onApply={apply} />);
    expect(markupInput()).toHaveValue("2,5");
    expect(apply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    expect(apply).toHaveBeenCalledExactlyOnceWith(1025);
    expect(sileo.success).toHaveBeenCalledTimes(1);
  });
  it("keeps a real zero applicable while empty, invalid and overflowing inputs remain unavailable", () => {
    const apply = vi.fn();
    const { rerender } = render(<PriceSuggestion costPriceTax={0} onApply={apply} />);
    fireEvent.click(screen.getByRole("button"));
    expect(apply).toHaveBeenCalledExactlyOnceWith(0);
    for (const value of ["", "-1"]) {
      fireEvent.change(markupInput(), { target: { value } });
      expect(screen.getByRole("button")).toBeDisabled();
    }
    fireEvent.change(markupInput(), { target: { value: "30" } });
    for (const costPriceTax of [null, Number.NaN, -1, 2147483647]) {
      rerender(<PriceSuggestion costPriceTax={costPriceTax} onApply={apply} />);
      expect(screen.getByRole("button")).toBeDisabled();
      fireEvent.click(screen.getByRole("button"));
    }
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it("disables both local controls while the owning editor is busy", () => {
    const apply = vi.fn();
    render(<PriceSuggestion costPriceTax={1190} onApply={apply} disabled />);
    expect(markupInput()).toBeDisabled();
    expect(screen.getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button"));
    expect(apply).not.toHaveBeenCalled();
    expect(sileo.success).not.toHaveBeenCalled();
  });
  it("describes the small percentage field and exposes the apply icon tooltip to keyboard users", async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    render(<PriceSuggestion costPriceTax={269} onApply={apply} />);
    expect(markupInput()).toHaveAccessibleName("Incremento");
    expect(markupInput()).toHaveAccessibleDescription("Incremento sugerido %");
    await user.tab();
    await user.tab();
    const button = screen.getByRole("button", { name: "Usar precio sugerido" });
    expect(button).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Usar precio sugerido");
    await user.keyboard("{Enter}");
    expect(apply).toHaveBeenCalledExactlyOnceWith(350);
  });
  it("keeps calculator Enter from submitting the owning product form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn(event => event.preventDefault());
    const apply = vi.fn();
    render(<form onSubmit={submit}><PriceSuggestion costPriceTax={269} onApply={apply} /><button type="submit">Save fixture</button></form>);
    await user.click(markupInput());
    await user.clear(markupInput());
    await user.type(markupInput(), "40{Enter}");
    expect(submit).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Usar precio sugerido" }));
    expect(apply).toHaveBeenCalledExactlyOnceWith(377);
    expect(submit).not.toHaveBeenCalled();
  });
});
