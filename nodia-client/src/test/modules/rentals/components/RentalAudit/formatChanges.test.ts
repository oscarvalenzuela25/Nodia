import { expect, it } from "vitest";
import i18n from "../../../../../translate";
import { formatAuditValue } from "../../../../../modules/rentals/components/RentalAudit/formatChanges";
it("shows redaction and preserves null, false, zero and before/after semantics", () => {
  expect(formatAuditValue({ redacted: true }, i18n.t)).toBe(
    i18n.t("rental:redacted"),
  );
  expect(formatAuditValue(false, i18n.t)).toBe("No");
  expect(formatAuditValue(0, i18n.t)).toBe("0");
  expect(formatAuditValue(null, i18n.t)).toBe(i18n.t("rental:not_recorded"));
  expect(
    formatAuditValue({ before: "draft", after: "confirmed" }, i18n.t),
  ).toContain("Antes: Cotización");
});
