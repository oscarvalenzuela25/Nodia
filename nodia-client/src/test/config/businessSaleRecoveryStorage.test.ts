import { beforeEach, describe, expect, it } from "vitest";
import { clearBusinessSaleRecoveryStorage, readSaleJournal, saveSaleJournal, saleJournalKey } from "../../config/businessSaleRecoveryStorage";
describe("sale recovery isolation", () => {
  beforeEach(() => sessionStorage.clear());
  const journal = { actorId: "actor-a", businessId: "business-a", mutation: { operation: "create" as const, command: { request_key: "original-request" } } };
  it("retains the original request across reload and isolates it by actor and business", () => {
    saveSaleJournal(journal);
    expect(readSaleJournal("actor-a", "business-a")).toEqual(journal);
    expect(readSaleJournal("actor-b", "business-a")).toBeNull();
    expect(readSaleJournal("actor-a", "business-b")).toBeNull();
  });
  it("fails explicitly on corrupted/mismatched recovery data", () => {
    sessionStorage.setItem(saleJournalKey("actor-a", "business-a"), JSON.stringify({ ...journal, actorId: "actor-b" }));
    expect(() => readSaleJournal("actor-a", "business-a")).toThrow("invalid_journal");
  });
  it("clears domain recovery on logout without deleting unrelated app data", () => {
    saveSaleJournal(journal); sessionStorage.setItem("unrelated", "preserved"); clearBusinessSaleRecoveryStorage();
    expect(readSaleJournal("actor-a", "business-a")).toBeNull(); expect(sessionStorage.getItem("unrelated")).toBe("preserved");
  });
});
