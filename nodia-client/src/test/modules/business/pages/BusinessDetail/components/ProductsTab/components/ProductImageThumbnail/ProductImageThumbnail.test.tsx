import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ProductImageThumbnail from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductImageThumbnail";
import i18n from "../../../../../../../../../translate";

const name = "Producto sintético";
const image = { url: "https://example.test/synthetic-product.jpg" };
const label = () => i18n.t("business:pos.image_preview_product", { name });

describe("ProductImageThumbnail", () => {
  it("opens the existing viewer callback with a 50px thumbnail through native keyboard activation", async () => {
    const onOpen = vi.fn();
    render(<ProductImageThumbnail name={name} image={image} disabled={false} onOpen={onOpen} />);
    const thumbnail = screen.getByAltText("");
    expect(thumbnail).toHaveAttribute("src", image.url);
    expect(thumbnail).toHaveAttribute("width", "50");
    expect(thumbnail).toHaveAttribute("height", "50");
    const button = screen.getByRole("button", { name: label() });
    button.focus();
    await userEvent.setup().keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("keeps the eye action available when there is no image", async () => {
    const onOpen = vi.fn();
    render(<ProductImageThumbnail name={name} image={null} disabled={false} onOpen={onOpen} />);
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: label() }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("falls back after an expired image fails, keeps the viewer usable and accepts a refreshed URL", async () => {
    const onOpen = vi.fn();
    const { rerender } = render(<ProductImageThumbnail name={name} image={image} disabled={false} onOpen={onOpen} />);
    fireEvent.error(screen.getByAltText(""));
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: label() }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    rerender(<ProductImageThumbnail name={name} image={{ url: `${image.url}?refreshed=1` }} disabled={false} onOpen={onOpen} />);
    expect(screen.getByAltText("")).toHaveAttribute("src", `${image.url}?refreshed=1`);
  });

  it("blocks opening while busy without hiding the product thumbnail", () => {
    const onOpen = vi.fn();
    render(<ProductImageThumbnail name={name} image={image} disabled onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: label() });
    expect(button).toBeDisabled();
    button.click();
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByAltText("")).toBeInTheDocument();
  });
});
