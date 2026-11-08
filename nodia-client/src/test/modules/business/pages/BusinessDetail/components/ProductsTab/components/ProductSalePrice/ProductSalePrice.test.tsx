import { render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { beforeEach, describe, expect, it } from "vitest";
import ProductSalePrice from "../../../../../../../../../modules/business/pages/BusinessDetail/components/ProductsTab/components/ProductSalePrice";
import i18n from "../../../../../../../../../translate";

beforeEach(async () => { await i18n.changeLanguage("es"); });

describe("ProductSalePrice", () => {
  it("shows an enabled higher offer first in the theme error color and preserves the normal price below", () => {
    const theme = createTheme();
    render(<ThemeProvider theme={theme}><ProductSalePrice salePrice={1500} offerPrice={2000} offerEnabled /></ThemeProvider>);
    const offer = screen.getByText("Oferta: $2.000 x unidad");
    const normal = screen.getByText("Normal: $1.500 x unidad");
    expect(offer.compareDocumentPosition(normal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(offer).toHaveStyle({ color: theme.palette.error.main });
    expect(offer).toHaveStyle({ fontSize: "16px", fontWeight: 700 });
    expect(normal).toHaveStyle({ fontSize: "16px", fontWeight: 700 });
    expect(normal.closest("s,del")).toBeNull();
  });

  it("omits disabled alternate amounts including zero without announcing an offer", () => {
    const { rerender } = render(<ProductSalePrice salePrice={1500} offerPrice={0} offerEnabled={false} />);
    expect(screen.getByText("$1.500 x unidad")).toBeInTheDocument();
    expect(screen.queryByText(/oferta|alternativo|inactivo|\$0/i)).not.toBeInTheDocument();
    rerender(<ProductSalePrice salePrice={1500} offerPrice={2000} offerEnabled={false} />);
    expect(screen.queryByText(/oferta|alternativo|\$2\.000/i)).not.toBeInTheDocument();
  });

  it("preserves a real enabled offer of zero and a real normal price of zero", () => {
    render(<ProductSalePrice salePrice={0} offerPrice={0} offerEnabled />);
    expect(screen.getByText("Oferta: $0 x unidad")).toBeInTheDocument();
    expect(screen.getByText("Normal: $0 x unidad")).toBeInTheDocument();
  });

  it("does not announce missing, invalid or out-of-contract amounts as offers or invent a missing normal price", () => {
    const { rerender } = render(<ProductSalePrice salePrice={null} offerPrice={null} offerEnabled />);
    for (const offerPrice of [null, undefined, NaN, Infinity, -1, 1.5, 2147483648]) {
      rerender(<ProductSalePrice salePrice={null} offerPrice={offerPrice} offerEnabled />);
      expect(screen.queryByText(/oferta|\$/i)).not.toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    }
  });

  it("uses the English label and CLP amount when the language changes", async () => {
    await i18n.changeLanguage("en");
    render(<ProductSalePrice salePrice={100} offerPrice={200} offerEnabled />);
    expect(screen.getByText(/Offer: CLP\s*200 x unit$/)).toBeInTheDocument();
    expect(screen.getByText(/Regular: CLP\s*100 x unit$/)).toBeInTheDocument();
  });
  it("labels the actual sale measurement next to both normal and enabled offer prices", () => {
    render(<ProductSalePrice salePrice={10000} offerPrice={9000} offerEnabled measurementUnit="kg" />);
    expect(screen.getByText("Oferta: $9.000 x kilo")).toBeInTheDocument();
    expect(screen.getByText("Normal: $10.000 x kilo")).toBeInTheDocument();
  });

});
