import { describe, expect, it } from "vitest";
import { contrastRatio, readableColor, readableForeground } from "../../themes/contrast";

describe("theme text contrast", () => {
  it("uses WCAG linear sRGB luminance without rounding away a failing ratio", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478089, 5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
    expect(contrastRatio("#ffffff", "#777777")).toBe(contrastRatio("#777777", "#ffffff"));
  });

  it("preserves readable source text and corrects muted text on every surface", () => {
    const surfaces = ["#ffffff", "#f0f0f0", "#eeeeee"];
    expect(readableColor("#333333", surfaces)).toBe("#333333");
    const adjusted = readableColor("#999999", surfaces);
    expect(adjusted).not.toBe("#999999");
    surfaces.forEach((surface) => expect(contrastRatio(adjusted, surface)).toBeGreaterThanOrEqual(4.6));
  });

  it("preserves a valid branded foreground and replaces unreadable button text", () => {
    expect(readableForeground("#222222", "#fafafa")).toBe("#fafafa");
    expect(readableForeground("#cccccc", "#ffffff")).toBe("#000000");
    expect(readableForeground("#333333", "#000000")).toBe("#ffffff");
  });

  it("rejects unsupported color formats and mutually incompatible surfaces", () => {
    expect(() => contrastRatio("oklch(1 0 0)", "#000000")).toThrow(/sRGB/);
    expect(() => readableColor("#777777", ["#000000", "#ffffff"])).toThrow(/incompatible/);
  });
});
