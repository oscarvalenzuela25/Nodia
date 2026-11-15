import { describe, expect, it } from "vitest";
import { normalizeProductAlias, productAliasFits, productAliasUsesName, resolveProductAlias } from "../../../../modules/business/infrastructure/productAliases";

describe("Product alias choices", () => {
  it("keeps optional blanks null and copies the current name only when explicitly chosen", () => {
    for (const alias of [undefined, null, "", " \t "]) {
      expect(normalizeProductAlias(alias)).toBeNull();
      expect(productAliasUsesName("Original", alias)).toBe(true);
    }
    expect(productAliasUsesName("Original", " Original ")).toBe(true);
    expect(productAliasUsesName("Original", "Commercial")).toBe(false);
    expect(resolveProductAlias(" New name ", "Commercial", true)).toBe("New name");
    expect(resolveProductAlias("Original", " Commercial ", false)).toBe("Commercial");
    expect(resolveProductAlias("Original", "  ", false)).toBeNull();
  });
  it("counts the persisted 255-character limit by Unicode code points", () => {
    expect(productAliasFits("🧾".repeat(255))).toBe(true);
    expect(productAliasFits("🧾".repeat(256))).toBe(false);
  });
});
