import type { SaleMutation } from "../modules/business/infrastructure/salesTypes";
const PREFIX = "nodia:sale-recovery:";
export interface SaleJournal { actorId: string; businessId: string; mutation: SaleMutation }
export const saleJournalKey = (actorId: string, businessId: string) => `${PREFIX}${encodeURIComponent(actorId)}:${encodeURIComponent(businessId)}`;
export const readSaleJournal = (actorId: string, businessId: string): SaleJournal | null => {
  const raw = sessionStorage.getItem(saleJournalKey(actorId, businessId));
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || !("actorId" in value) || !("businessId" in value) || !("mutation" in value) || value.actorId !== actorId || value.businessId !== businessId) throw new Error("invalid_journal");
    const entry = value as SaleJournal;
    if (!entry.mutation.command.request_key || !["create", "update", "checkout", "complete", "cancel", "discard"].includes(entry.mutation.operation)) throw new Error("invalid_journal");
    return entry;
  } catch { throw new Error("invalid_journal"); }
};
export const saveSaleJournal = (journal: SaleJournal) => sessionStorage.setItem(saleJournalKey(journal.actorId, journal.businessId), JSON.stringify(journal));
export const removeSaleJournal = (actorId: string, businessId: string) => sessionStorage.removeItem(saleJournalKey(actorId, businessId));
export const clearBusinessSaleRecoveryStorage = () => {
  try { for (let index = sessionStorage.length - 1; index >= 0; index--) { const key = sessionStorage.key(index); if (key?.startsWith(PREFIX) || key?.startsWith("nodia:product-image-recovery:")) sessionStorage.removeItem(key); } } catch { /* Storage unavailable: no credential or domain data is copied elsewhere. */ }
};
