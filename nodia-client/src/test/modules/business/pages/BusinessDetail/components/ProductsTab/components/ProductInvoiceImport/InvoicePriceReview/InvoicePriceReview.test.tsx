import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InvoicePriceReview from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoicePriceReview";
import i18n from "../../../../../../../../../../translate";

const priceInput = () => screen.getByRole("spinbutton", { name: new RegExp(`^${i18n.t("business:product_sale_price")}`) });

describe("OCR sale price local review", () => {
  it("starts unknown prices empty, blocks invalid CLP and applies a real zero only after Save", async () => {
    const onApply = vi.fn().mockReturnValue(true); const onClose = vi.fn();
    render(<InvoicePriceReview price={Number.NaN} disabled={false} onApply={onApply} onClose={onClose} />);
    const input = priceInput(); const save = screen.getByTestId("save-invoice-price");
    expect(input).toHaveValue(null);
    expect(save).toBeDisabled();
    for (const value of ["-1", "1.5", "2147483648", ""]) {
      fireEvent.change(input, { target: { value } });
      await waitFor(() => expect(save).toBeDisabled());
      fireEvent.submit(input.closest("form")!);
    }
    await waitFor(() => expect(onApply).not.toHaveBeenCalled());
    fireEvent.change(input, { target: { value: "0" } });
    await waitFor(() => expect(save).toBeEnabled());
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(save);
    await waitFor(() => expect(onApply).toHaveBeenCalledExactlyOnceWith(0));
    expect(onClose).toHaveBeenCalledOnce();
  });
  it("keeps the edited value when application is rejected and blocks submitting while busy", async () => {
    const onApply = vi.fn().mockReturnValue(false); const onClose = vi.fn();
    const view = render(<InvoicePriceReview price={155} disabled={false} onApply={onApply} onClose={onClose} />);
    fireEvent.change(priceInput(), { target: { value: "199" } });
    await waitFor(() => expect(screen.getByTestId("save-invoice-price")).toBeEnabled());
    await userEvent.click(screen.getByTestId("save-invoice-price"));
    await waitFor(() => expect(onApply).toHaveBeenCalledExactlyOnceWith(199));
    expect(onClose).not.toHaveBeenCalled();
    expect(priceInput()).toHaveValue(199);
    view.rerender(<InvoicePriceReview price={155} disabled onApply={onApply} onClose={onClose} />);
    expect(priceInput()).toBeDisabled();
    expect(screen.getByTestId("save-invoice-price")).toBeDisabled();
    fireEvent.submit(priceInput().closest("form")!);
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce());
    expect(priceInput()).toHaveValue(199);
  });
  it("accepts the maximum CLP integer and cancels without changing the row", async () => {
    const onApply = vi.fn(); const onClose = vi.fn();
    render(<InvoicePriceReview price={2147483647} disabled={false} onApply={onApply} onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId("save-invoice-price")).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: i18n.t("core:cancel") }));
    expect(onApply).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledOnce();
  });
});
