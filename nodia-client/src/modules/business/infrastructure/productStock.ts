import { formatQuantity, quantityFromInput, quantityThousandths } from "./saleQuantities";

export const isStockQuantity = (value: unknown): value is number =>
  typeof value === "number" && quantityThousandths(value) !== null;

export const parseStockQuantity = (value: string): number | null =>
  quantityFromInput(value.trim());

export const formatStock = (product: { track_stock?: boolean | null; stock: number }, language: string) =>
  product.track_stock === true && isStockQuantity(product.stock)
    ? formatQuantity(product.stock, language)
    : "—";
