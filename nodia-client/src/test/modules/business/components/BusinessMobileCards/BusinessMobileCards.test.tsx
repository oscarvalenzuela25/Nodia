import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProductMobileCard } from "../../../../../modules/business/components/BusinessMobileCards/BusinessMobileCards";
import type { ProductEntity, ProductLogEntity } from "../../../../../modules/business/infrastructure/types";
import i18n from "../../../../../translate";

const product: ProductEntity = {
  id: "9007199254740993", business_id: "synthetic-business", code: "SUP-001", name: "Producto sintético",
  barcode: "00012345", cost_price: 1000, cost_price_tax: 1190, sale_price: 1547,
  offer_price: 0, is_offer_enabled: false, has_stock: false, stock: 0, version: 3, is_active: true,
  image: { id: "synthetic-image", url: "https://example.test/synthetic-product.jpg", mime_type: "image/jpeg", width: 480, height: 320, byte_size: 8000 },
};
const historical: ProductLogEntity = {
  ...product, id: "synthetic-log", product_id: product.id, sale_price: 1500,
  created_at: "2026-10-28T12:00:00Z", updated_at: "2026-10-28T12:00:00Z",
};
const callbacks = () => ({ onImage: vi.fn(), onEdit: vi.fn(), onToggle: vi.fn(), onExpand: vi.fn() });
const imageLabel = () => i18n.t("business:pos.image_preview_product", { name: product.name });
const actionsLabel = () => i18n.t("layout:mobile_cards.actions", { name: product.name });
const formatDate = () => "Fecha sintética";

describe("ProductMobileCard image access with the real MobileRecordCard", () => {
  it("opens the exact product from its thumbnail and keeps the name, invoice code and active price clear", async () => {
    const handlers = callbacks();
    render(<ProductMobileCard product={product} expanded={false} disabled={false} formatDate={formatDate} {...handlers} />);
    const card = screen.getByRole("article", { name: product.name });
    expect(within(card).getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(within(card).getByText(product.code!)).toBeInTheDocument();
    expect(within(card).queryByText(product.barcode!)).not.toBeInTheDocument();
    expect(within(card).queryByText("0")).not.toBeInTheDocument();
    expect(within(card).queryByText(/oferta|alternativo/i)).not.toBeInTheDocument();
    expect(within(card).getByText("Fecha sintética")).toBeInTheDocument();
    expect(within(card).getByAltText("")).toHaveAttribute("src", product.image?.url);
    const eye = within(card).getByRole("button", { name: imageLabel() });
    expect(eye).toBeEnabled();
    await userEvent.setup().click(eye);
    expect(handlers.onImage).toHaveBeenCalledExactlyOnceWith(product);
    expect(handlers.onEdit).not.toHaveBeenCalled();
    expect(handlers.onToggle).not.toHaveBeenCalled();
    expect(within(card).getByRole("heading", { name: product.name })).toBeInTheDocument();
  });

  it("allows image access when no image exists and preserves edit, toggle and history actions", async () => {
    const withoutImage = { ...product, image: null };
    const handlers = callbacks();
    const user = userEvent.setup();
    render(<ProductMobileCard product={withoutImage} historical={historical} expanded={false} disabled={false} formatDate={formatDate} {...handlers} />);
    await user.click(screen.getByRole("button", { name: imageLabel() }));
    expect(handlers.onImage).toHaveBeenCalledExactlyOnceWith(withoutImage);
    await user.click(screen.getByRole("button", { name: i18n.t("business:expand_historical_tooltip") }));
    expect(handlers.onExpand).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: actionsLabel() }));
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("business:action_update") }));
    expect(handlers.onEdit).toHaveBeenCalledExactlyOnceWith(withoutImage);
    await user.click(screen.getByRole("button", { name: actionsLabel() }));
    await user.click(await screen.findByRole("menuitem", { name: i18n.t("business:action_deactivate") }));
    expect(handlers.onToggle).toHaveBeenCalledExactlyOnceWith(withoutImage);
  });

  it("disables the image action and existing action surfaces while retaining the product information", () => {
    const handlers = callbacks();
    render(<ProductMobileCard product={product} historical={historical} expanded={false} disabled formatDate={formatDate} {...handlers} />);
    const eye = screen.getByRole("button", { name: imageLabel() });
    expect(eye).toBeDisabled();
    // Native activation of a disabled button must not dispatch the product callback.
    eye.click();
    expect(handlers.onImage).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: actionsLabel() })).toBeDisabled();
    expect(screen.getByRole("button", { name: i18n.t("business:expand_historical_tooltip") })).toBeDisabled();
    expect(screen.getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(screen.getByText(product.code!)).toBeInTheDocument();
    expect(screen.queryByText(product.barcode!)).not.toBeInTheDocument();
  });

  it("uses the same enabled zero-offer summary on mobile without displaying a separate alternate-price field", () => {
    render(<ProductMobileCard product={{ ...product, is_offer_enabled: true }} expanded={false} disabled={false} formatDate={formatDate} {...callbacks()} />);
    expect(screen.getByText(i18n.t("business:product_offer_price", { price: "$0 x unidad" }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("business:product_regular_price", { price: "$1.547 x unidad" }))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("business:pos.alternate_price"))).not.toBeInTheDocument();
  });
  it("keeps a product without supplier code identifiable by its name and displays its measurement", () => {
    render(<ProductMobileCard product={{ ...product, code: null, measurement_unit: "bundle" }} expanded={false} disabled={false} formatDate={formatDate} {...callbacks()} />);
    expect(screen.getByRole("heading", { name: product.name })).toBeInTheDocument();
    expect(screen.getByText("$1.547 x atado")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows both historical measurement prices without comparing a kilogram price with a unit price", () => {
    render(<ProductMobileCard product={{ ...product, measurement_unit: "kg" }} historical={historical} expanded disabled={false} formatDate={formatDate} {...callbacks()} />);
    expect(screen.queryByText(/No comparable|Not comparable/)).not.toBeInTheDocument();
    expect(screen.getByText("$1.547 x kilo")).toBeInTheDocument();
    expect(screen.getByText("$1.500 x unidad")).toBeInTheDocument();
    expect(screen.queryByText(/^[+−]\d+%$/)).not.toBeInTheDocument();
  });

});
