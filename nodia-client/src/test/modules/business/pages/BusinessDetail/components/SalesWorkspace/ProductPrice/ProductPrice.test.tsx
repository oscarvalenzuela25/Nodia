import { render, screen } from "@testing-library/react";
import { createTheme, getContrastRatio, ThemeProvider } from "@mui/material/styles";
import { describe, expect, it } from "vitest";
import ProductPrice from "../../../../../../../../modules/business/pages/BusinessDetail/components/SalesWorkspace/ProductPrice";
import i18n from "../../../../../../../../translate";

describe("ProductPrice", () => {
  it("labels selected and regular prices with the same compact measurement notation", () => {
    render(<ProductPrice price="200" regularPrice="100" onOffer measurementUnit="kg" />);
    expect(screen.getByText("$200 x kilo")).toBeInTheDocument();
    expect(screen.getByText(`${i18n.t("business:pos.regular_price")}: $100 x kilo`)).toBeInTheDocument();
  });
  it("shows the selected offer even when higher than the regular price, with the normal amount below", () => {
    render(<ProductPrice price="200" regularPrice={100} onOffer />);
    const amount = screen.getByText("$200");
    const regular = screen.getByText(`${i18n.t("business:pos.regular_price")}: $100`);
    expect(screen.getByText(i18n.t("business:pos.offer"))).toBeInTheDocument();
    expect(amount.compareDocumentPosition(regular) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(regular.closest("s,del")).toBeNull();
  });
  it("keeps real zero selected and regular prices while respecting an inactive offer flag", () => {
    const { rerender } = render(<ProductPrice price={0} regularPrice="0" onOffer />);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText(`${i18n.t("business:pos.regular_price")}: $0`)).toBeInTheDocument();
    rerender(<ProductPrice price="0" regularPrice={900} onOffer={false} />);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("business:pos.offer"))).not.toBeInTheDocument();
    expect(screen.queryByText(/900/)).not.toBeInTheDocument();
  });
  it("does not replace an absent selected price with the regular amount or invent an absent regular amount", () => {
    const { rerender } = render(<ProductPrice price={null} regularPrice={100} onOffer />);
    expect(screen.getByText(i18n.t("business:pos.catalog_price_unavailable"))).toBeInTheDocument();
    expect(screen.getByText(`${i18n.t("business:pos.regular_price")}: $100`)).toBeInTheDocument();
    rerender(<ProductPrice price={undefined} regularPrice={undefined} onOffer={false} />);
    expect(screen.getByText(i18n.t("business:pos.catalog_price_unavailable"))).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });
  it.each(["light", "dark"] as const)("keeps the offer label and selected price readable against %s paper", (mode) => {
    const theme = createTheme({ palette: { mode } });
    const { rerender } = render(<ThemeProvider theme={theme}><ProductPrice price="200" regularPrice="100" onOffer /></ThemeProvider>);
    const offerColor = getComputedStyle(screen.getByText("$200")).color;
    for (const element of [screen.getByText("$200"), screen.getByText(i18n.t("business:pos.offer"))]) {
      expect(getContrastRatio(getComputedStyle(element).color, theme.palette.background.paper)).toBeGreaterThanOrEqual(4.5);
    }
    rerender(<ThemeProvider theme={theme}><ProductPrice price="200" regularPrice="100" onOffer={false} /></ThemeProvider>);
    expect(getComputedStyle(screen.getByText("$200")).color).not.toBe(offerColor);
  });
});
