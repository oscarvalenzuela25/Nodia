import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSalePriceEditing } from "../../../../modules/business/infrastructure/useSalePriceEditing";

describe("sale price editing ownership", () => {
  it("blocks other changes immediately while allowing only the active price editor", () => {
    const { result } = renderHook(() => useSalePriceEditing("sale-1"));
    expect(result.current.blocksChange()).toBe(false);
    act(() => {
      result.current.onEditingChange("product-1", true);
      expect(result.current.blocksChange()).toBe(true);
      expect(result.current.blocksChange("product-1")).toBe(false);
      expect(result.current.blocksChange("product-2")).toBe(true);
    });
    expect(result.current.editingProductId).toBe("product-1");
    act(() => result.current.onEditingChange("product-2", true));
    expect(result.current.editingProductId).toBe("product-1");
    act(() => result.current.onEditingChange("product-2", false));
    expect(result.current.blocksChange()).toBe(true);
    act(() => result.current.onEditingChange("product-1", false));
    expect(result.current.editingProductId).toBeNull();
    expect(result.current.blocksChange()).toBe(false);
  });

  it("ignores stale cleanup from a previous sale, including the same product ID", () => {
    const { result, rerender } = renderHook(({ scope }) => useSalePriceEditing(scope), { initialProps: { scope: "sale-1" } });
    act(() => result.current.onEditingChange("product-1", true));
    const oldCleanup = result.current.onEditingChange;
    rerender({ scope: "sale-2" });
    expect(result.current.editingProductId).toBeNull();
    expect(result.current.blocksChange()).toBe(false);
    act(() => result.current.onEditingChange("product-1", true));
    act(() => oldCleanup("product-1", false));
    expect(result.current.editingProductId).toBe("product-1");
    expect(result.current.blocksChange()).toBe(true);
    act(() => result.current.onEditingChange("product-1", false));
    expect(result.current.blocksChange()).toBe(false);
  });
});
