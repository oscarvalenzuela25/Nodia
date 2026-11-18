import { describe, expect, it } from "vitest";
import {
  editorValues, listClipboardText, listCommand, listDraftSchema,
} from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/listDraft";
import type { ShoppingListDetail } from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services";

const detail: ShoppingListDetail = {
  id: "list", name: "Compras", version: 3, item_count: 2, is_active: false,
  items: [
    { id: "first", product_id: "9007199254740993", name: "Arroz\n integral", quantity: "999999999.999", available: false, checked: true, position: 0, check_version: 2 },
    { id: "second", product_id: "2", name: "Harina", quantity: "0.125", available: true, checked: false, position: 1, check_version: 1 },
  ],
};

describe("shopping list draft", () => {
  it("normalizes a Chilean decimal without touching retained row identity or bigint IDs", () => {
    const values = editorValues(detail);
    values.items[0].quantity = " 12,500 ";
    expect(listDraftSchema.safeParse(values).success).toBe(true);
    expect(listCommand(values).items[0]).toEqual({
      product_id: "9007199254740993", item_id: "first", quantity: "12.5",
    });
    values.items[0].quantity = "0.0001";
    expect(listDraftSchema.safeParse(values).success).toBe(false);
  });

  it("copies all products in order with localized exact quantities and one line per product", () => {
    expect(listClipboardText(detail, "es-CL")).toBe("Arroz integral × 999999999,999\nHarina × 0,125");
    expect(listClipboardText(detail, "en")).toBe("Arroz integral × 999999999.999\nHarina × 0.125");
  });
});
