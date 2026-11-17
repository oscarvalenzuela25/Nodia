import { describe, expect, it } from "vitest";
import {
  categoryFields,
  changedFields,
  movementFields,
} from "../../../../../../../../modules/business/pages/BusinessDetail/components/CashTab/CashEditors/fields";

describe("cash fields", () => {
  it("normalizes category text and counts Unicode code points", () => {
    const fields = categoryFields.parse({
      name: " \u0085 Ｃaja ",
      description: " " + "💵".repeat(500),
      is_active: false,
    });
    expect(fields.name).toBe("Caja");
    expect([...fields.description]).toHaveLength(500);
    expect(fields.is_active).toBe(false);
    expect(categoryFields.safeParse({ ...fields, name: "💵".repeat(121) }).success).toBe(false);
    expect(categoryFields.safeParse({ ...fields, description: "Nota\u0000" }).success).toBe(false);
  });

  it("preserves exact CLP strings and rejects noncanonical amounts and invalid civil dates", () => {
    const fields = {
      category_id: "9223372036854775807",
      amount: "9999999999999",
      occurred_on: "2024-02-29",
      description: "Ingreso",
      is_active: true,
    };
    expect(movementFields.parse(fields)).toEqual(fields);
    for (const amount of ["0", "1.2", "1e3", "01", "10000000000000"])
      expect(movementFields.safeParse({ ...fields, amount }).success).toBe(false);
    expect(
      movementFields.safeParse({ ...fields, category_id: "9223372036854775808" }).success,
    ).toBe(false);
    expect(movementFields.safeParse({ ...fields, occurred_on: "2025-02-29" }).success).toBe(false);
    expect(changedFields({ ...fields, is_active: false }, fields)).toEqual({ is_active: false });
  });
});
