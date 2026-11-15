import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InvoiceAliasReview from "../../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductInvoiceImport/InvoiceAliasReview";
import i18n from "../../../../../../../../../../translate";

const label = (key: string) => i18n.t(`business:${key}`);
describe("OCR alias local review", () => {
  it("keeps the original name read-only and waits for an explicit choice before applying a trimmed alias", async () => {
    const onApply = vi.fn().mockReturnValue(true); const onClose = vi.fn();
    render(<InvoiceAliasReview name="INV ABBREV" alias={null} disabled={false} onApply={onApply} onClose={onClose} />);
    expect(screen.getByText("INV ABBREV")).toBeVisible();
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    const save = screen.getByTestId("save-invoice-alias"); expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(`^${label("product_alias")}`) }), { target: { value: "  Human commercial alias  " } });
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(save);
    expect(onApply).toHaveBeenCalledExactlyOnceWith("Human commercial alias");
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByText("INV ABBREV")).toBeVisible();
  });
  it("copies the original only after the checkbox and Save, and keeps a rejected local draft available", async () => {
    const onApply = vi.fn().mockReturnValue(false); const onClose = vi.fn();
    const view = render(<InvoiceAliasReview name="Original label" alias={null} disabled={false} onApply={onApply} onClose={onClose} />);
    await userEvent.click(screen.getByRole("checkbox", { name: label("product_alias_use_name") }));
    expect(screen.getByRole("textbox", { name: new RegExp(`^${label("product_alias")}`) })).toHaveValue("Original label");
    expect(onApply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId("save-invoice-alias"));
    expect(onApply).toHaveBeenCalledExactlyOnceWith("Original label");
    expect(onClose).not.toHaveBeenCalled();
    view.rerender(<InvoiceAliasReview name="Original label" alias={null} disabled onApply={onApply} onClose={onClose} />);
    expect(screen.getByTestId("save-invoice-alias")).toBeDisabled();
    expect(screen.getByRole("textbox", { name: new RegExp(`^${label("product_alias")}`) })).toHaveValue("Original label");
    fireEvent.submit(screen.getByRole("textbox", { name: new RegExp(`^${label("product_alias")}`) }).closest("form")!);
    expect(onApply).toHaveBeenCalledOnce();
  });
  it("blocks overlong aliases and cancels without applying a value", async () => {
    const onApply = vi.fn(); const onClose = vi.fn();
    render(<InvoiceAliasReview name="Original" alias={"x".repeat(256)} disabled={false} onApply={onApply} onClose={onClose} />);
    expect(screen.getByTestId("save-invoice-alias")).toBeDisabled();
    expect(screen.getByText(label("product_alias_invalid"))).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: i18n.t("core:cancel") }));
    expect(onApply).not.toHaveBeenCalled(); expect(onClose).toHaveBeenCalledOnce();
  });
});
