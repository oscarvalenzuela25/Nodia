import { describe, expect, it } from "vitest";
import { mergeListDetail, mergeListMark } from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/listMarks";
import type { ShoppingListDetail, ShoppingListItem } from "../../../../../../../modules/business/pages/BusinessDetail/components/ListsTab/infrastructure/services";

const item: ShoppingListItem = {
  id: "item-1", product_id: "17", name: "Arroz", quantity: "1", position: 0,
  available: true, checked: false, check_version: 1,
};
const list: ShoppingListDetail = { id: "list", name: "Compras", version: 1, item_count: 1, is_active: true, items: [item] };

describe("shopping list checklist revisions", () => {
  it("keeps the latest confirmed mark when a stale read arrives after a write", () => {
    const marked = mergeListMark(item, { id: item.id, checked: true, check_version: 2 });
    const result = mergeListDetail({ ...list, items: [marked] }, {
      ...list, name: "Compra semanal", version: 2, items: [{ ...item, quantity: "2" }],
    });
    expect(result).toMatchObject({
      name: "Compra semanal",
      version: 2,
      items: [{ id: item.id, checked: true, check_version: 2, quantity: "2" }],
    });
  });

  it("drops a removed item's mark when the same product is re-added under another identity", () => {
    const marked = mergeListMark(item, { id: item.id, checked: true, check_version: 3 });
    const oldList = { ...list, items: [marked] };
    const replacement = { ...item, id: "item-2" };
    const newList = { ...list, version: 2, items: [replacement] };
    expect(mergeListDetail(oldList, newList)).toEqual(newList);
    expect(mergeListDetail(newList, oldList)).toBe(newList);
    expect(mergeListMark(replacement, marked)).toBe(replacement);
  });
});
