import { replaceEqualDeep } from "@tanstack/react-query";
import type { ShoppingListDetail, ShoppingListMark } from "./infrastructure/services";

export function mergeListMark(item: ShoppingListDetail["items"][number], mark?: ShoppingListMark) {
  return mark && mark.id === item.id && mark.check_version > item.check_version
    ? { ...item, checked: mark.checked, check_version: mark.check_version }
    : item;
}

export function mergeListDetail(oldData: unknown, newData: unknown) {
  const previous = oldData as ShoppingListDetail | undefined;
  const next = newData as ShoppingListDetail;
  if (!previous || previous.id !== next.id) return next;
  if (previous.version > next.version) return previous;
  const previousItems = new Map(previous.items.map(item => [item.id, item]));
  const items = next.items.map(item => mergeListMark(item, previousItems.get(item.id)));
  return replaceEqualDeep(previous, { ...next, items });
}
