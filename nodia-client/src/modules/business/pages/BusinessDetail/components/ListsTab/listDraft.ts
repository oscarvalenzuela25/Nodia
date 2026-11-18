import { z } from "zod";
import {
  maxListItems,
  maxListName,
  normalizeListQuantity,
} from "./infrastructure/services";
import type { ShoppingListDetail, ShoppingListDraft } from "./infrastructure/services";

export const listDraftSchema = z.object({
  name: z.string().refine(name => {
    const points = Array.from(name.trim());
    return points.length > 0 && points.length <= maxListName &&
      points.every(character => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);
  }),
  items: z.array(z.object({
    item_id: z.string().optional(),
    product_id: z.string(),
    name: z.string(),
    available: z.boolean(),
    quantity: z.string().refine(quantity => normalizeListQuantity(quantity) !== null),
  })).max(maxListItems),
});

export type ListEditorValues = z.infer<typeof listDraftSchema>;

export const editorValues = (detail?: ShoppingListDetail): ListEditorValues => ({
  name: detail?.name ?? "",
  items: detail?.items.map(({ id, product_id, name, available, quantity }) =>
    ({ item_id: id, product_id, name, available, quantity })) ?? [],
});

export function listCommand(values: ListEditorValues): ShoppingListDraft {
  return {
    name: values.name.trim(),
    items: values.items.map(({ item_id, product_id, quantity }) => {
      const normalized = normalizeListQuantity(quantity);
      if (normalized === null) throw new Error("Invalid shopping list quantity");
      return { item_id, product_id, quantity: normalized };
    }),
  };
}

export const formatListQuantity = (quantity: string, locale: string) => {
  const [whole, decimal] = quantity.split(".");
  if (!decimal) return whole;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  return `${whole}${separator}${decimal}`;
};

export const listClipboardText = (detail: ShoppingListDetail, locale: string) =>
  detail.items.map(item => `${item.name.replace(/\s+/g, " ").trim()} × ${formatListQuantity(item.quantity, locale)}`).join("\n");
