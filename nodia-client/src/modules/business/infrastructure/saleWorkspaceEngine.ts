import axios from "axios";
import { sileo } from "sileo";
import i18n from "../../../translate";
import useAuthStore from "../../../store/authStore";
import { claimHttpErrorNotification, getHttpErrorMessage } from "../../../config/httpFeedback";
import { readSaleJournal, removeSaleJournal, type SaleJournal } from "../../../config/businessSaleRecoveryStorage";
import { loadSaleWorkspace, writeSaleWorkspace, type SaleWorkspaceSession, type SaleWorkspaceSnapshot } from "../../../config/businessSaleWorkspaceStorage";
import { getSaleReceipt, mutateSale } from "./salesServices";
import { cartTotal, quantityFromInput, saleToCart } from "./salesPolicies";
import type { PaymentMethod, Sale, SaleMutation } from "./salesTypes";

const freshSession = (number: number): SaleWorkspaceSession => ({ id: crypto.randomUUID(), number, sale: null, lines: [], paymentMethod: "cash", description: "", dirty: false, pending: null, quantityDrafts: {}, barcode: "" });
const emptyWorkspace = (actorId: string, businessId: string): SaleWorkspaceSnapshot => {
  const session = freshSession(1);
  return { version: 2, actorId, businessId, activeId: session.id, nextNumber: 2, sessions: [session] };
};
const safeEmpty = (entry: SaleWorkspaceSession) => !entry.sale && !entry.pending && !entry.dirty && entry.lines.length === 0 && !entry.description && !entry.barcode && Object.keys(entry.quantityDrafts).length === 0 && entry.paymentMethod === "cash";
const orderedJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(orderedJson);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, orderedJson(entry)]));
  return value;
};
const sameIntention = (left: unknown, right: unknown) => JSON.stringify(orderedJson(left)) === JSON.stringify(orderedJson(right));
const errorFeedback = (error: unknown) => {
  if (claimHttpErrorNotification(error)) sileo.error({ title: i18n.t("core:server_error_toast"), description: getHttpErrorMessage(error) });
};
interface EngineState { workspace: SaleWorkspaceSnapshot; storageError: boolean; busyIds: string[] }

/** Local domain state; every durable update commits carts and recovery identities together. */
export class SaleWorkspaceEngine {
  private state: EngineState;
  private listeners = new Set<() => void>();
  private locks = new Set<string>();
  private mounted = false;
  private lease = 0;
  private readBlocked = false;
  private legacyNeedsRemoval = false;
  private actorId: string;
  private businessId: string;
  private sessionVersion: number;
  private invalidate: () => Promise<void>;
  constructor(actorId: string, businessId: string, sessionVersion: number, invalidate: () => Promise<void>) {
    this.actorId = actorId; this.businessId = businessId; this.sessionVersion = sessionVersion; this.invalidate = invalidate;
    let workspace = emptyWorkspace(actorId, businessId);
    try { if (actorId && businessId) workspace = this.restore(); }
    catch { this.readBlocked = true; }
    this.state = { workspace, storageError: this.readBlocked, busyIds: [] };
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  mount = () => {
    this.mounted = true; this.lease++;
    if (!this.readBlocked && this.current()) this.commit(this.state.workspace);
    return () => { this.mounted = false; this.lease++; };
  };
  private current(lease = this.lease) {
    const auth = useAuthStore.getState();
    return this.mounted && lease === this.lease && Boolean(this.actorId) && Boolean(this.businessId) && auth.user?.id === this.actorId && auth.sessionVersion === this.sessionVersion;
  }
  private publish(workspace = this.state.workspace, storageError = this.state.storageError) {
    this.state = { workspace, storageError, busyIds: [...this.locks] };
    for (const listener of this.listeners) listener();
  }
  private restore(): SaleWorkspaceSnapshot {
    let workspace = loadSaleWorkspace(this.actorId, this.businessId) ?? emptyWorkspace(this.actorId, this.businessId);
    const legacy = readSaleJournal(this.actorId, this.businessId);
    if (legacy) {
      const matching = workspace.sessions.find((entry) => entry.pending?.mutation.command.request_key === legacy.mutation.command.request_key);
      if (matching && !sameIntention(matching.pending, legacy)) throw new Error("invalid_workspace");
      if (!matching) {
        const unused = workspace.sessions.find(safeEmpty);
        const entry = unused ?? freshSession(workspace.nextNumber);
        const restored = { ...entry, pending: legacy, paymentMethod: legacy.mutation.command.payment_method ?? "cash", description: legacy.mutation.command.payment_method_description ?? "" };
        workspace = { ...workspace, activeId: entry.id, nextNumber: unused ? workspace.nextNumber : workspace.nextNumber + 1,
          sessions: unused ? workspace.sessions.map((item) => item.id === entry.id ? restored : item) : [...workspace.sessions, restored] };
      }
      this.legacyNeedsRemoval = true;
    }
    return workspace;
  }
  private commit(workspace: SaleWorkspaceSnapshot, keepLocalOnFailure = false): boolean {
    if (!this.current() || this.readBlocked) return false;
    try {
      writeSaleWorkspace(workspace);
      if (this.legacyNeedsRemoval) { removeSaleJournal(this.actorId, this.businessId); this.legacyNeedsRemoval = false; }
      this.publish(workspace, false); return true;
    } catch {
      this.publish(keepLocalOnFailure ? workspace : this.state.workspace, true); return false;
    }
  }
  retryStorage(): boolean {
    if (!this.current() || this.locks.size) return false;
    if (this.readBlocked) {
      try { const workspace = this.restore(); this.readBlocked = false; return this.commit(workspace); }
      catch { this.publish(this.state.workspace, true); return false; }
    }
    return this.commit(this.state.workspace);
  }
  private session(id: string) { return this.state.workspace.sessions.find((entry) => entry.id === id); }
  private editable(id: string) { return this.current() && !this.state.storageError && !this.locks.has(id) && Boolean(this.session(id)) && !this.session(id)?.pending; }
  private replace(id: string, update: (entry: SaleWorkspaceSession) => SaleWorkspaceSession, keepLocalOnFailure = false) {
    const workspace = this.state.workspace;
    return this.commit({ ...workspace, sessions: workspace.sessions.map((entry) => entry.id === id ? update(entry) : entry) }, keepLocalOnFailure);
  }
  edit(id: string, patch: Partial<Pick<SaleWorkspaceSession, "lines" | "paymentMethod" | "description" | "dirty" | "barcode" | "quantityDrafts">>) {
    if (!this.editable(id)) return false;
    return this.replace(id, (entry) => ({ ...entry, ...patch }), true);
  }
  setPaymentMethod(id: string, value: PaymentMethod) {
    const entry = this.session(id);
    // Original Other remains valid for history/recovery; new manual selections have four methods.
    if (value === "other" && entry?.paymentMethod !== "other") return false;
    return this.edit(id, { paymentMethod: value, dirty: true });
  }
  setQuantityDrafts(id: string, value: Record<string, string> | ((previous: Record<string, string>) => Record<string, string>)) {
    const entry = this.session(id);
    if (!entry) return false;
    return this.edit(id, { quantityDrafts: typeof value === "function" ? value(entry.quantityDrafts) : value });
  }
  newSale(): string | null {
    if (!this.current() || this.state.storageError || !Number.isSafeInteger(this.state.workspace.nextNumber + 1)) return null;
    const workspace = this.state.workspace, session = freshSession(workspace.nextNumber);
    return this.commit({ ...workspace, sessions: [...workspace.sessions, session], activeId: session.id, nextNumber: workspace.nextNumber + 1 }) ? session.id : null;
  }
  selectSale(id: string): boolean {
    return this.current() && !this.state.storageError && Boolean(this.session(id)) && this.commit({ ...this.state.workspace, activeId: id });
  }
  private without(id: string): SaleWorkspaceSnapshot {
    const workspace = this.state.workspace, sessions = workspace.sessions.filter((entry) => entry.id !== id);
    if (!sessions.length) return emptyWorkspace(this.actorId, this.businessId);
    const index = workspace.sessions.findIndex((entry) => entry.id === id);
    return { ...workspace, sessions, activeId: workspace.activeId === id ? sessions[Math.min(index, sessions.length - 1)].id : workspace.activeId };
  }
  closeSale(id: string): boolean {
    if (!this.editable(id) || !this.session(id)) return false;
    return this.commit(this.without(id));
  }
  reset(id: string): boolean {
    if (!this.editable(id)) return false;
    return this.replace(id, (entry) => ({ ...freshSession(entry.number), id: entry.id }));
  }
  /** Never discard an in-flight or uncertain commercial intention. */
  clearForExit(): boolean {
    if (!this.current() || this.state.storageError || this.locks.size || this.state.workspace.sessions.some((entry) => entry.pending)) return false;
    return this.commit(emptyWorkspace(this.actorId, this.businessId));
  }
  load(value: Sale): string | null {
    if (!this.current() || this.state.storageError || value.business_id !== this.businessId) return null;
    const workspace = this.state.workspace;
    const existing = workspace.sessions.find((entry) => entry.sale?.id === value.id);
    if (existing && (existing.pending || existing.dirty || this.locks.has(existing.id))) return this.selectSale(existing.id) ? existing.id : null;
    const reusable = existing ?? workspace.sessions.find((entry) => safeEmpty(entry) && !this.locks.has(entry.id));
    const entry = reusable ?? freshSession(workspace.nextNumber);
    const loaded = { ...entry, sale: value, lines: saleToCart(value), paymentMethod: value.payment_method, description: value.payment_method_description ?? "", dirty: false, quantityDrafts: {}, barcode: "" };
    return this.commit({ ...workspace, activeId: entry.id, nextNumber: reusable ? workspace.nextNumber : workspace.nextNumber + 1,
      sessions: reusable ? workspace.sessions.map((item) => item.id === entry.id ? loaded : item) : [...workspace.sessions, loaded] }) ? entry.id : null;
  }
  private async accept(id: string, value: Sale, mutation: SaleMutation, lease: number): Promise<boolean> {
    if (!this.current(lease) || this.session(id)?.pending?.mutation.command.request_key !== mutation.command.request_key) return false;
    const number = this.session(id)!.number;
    const closesCart = mutation.operation === "checkout" || mutation.operation === "complete";
    if (value.business_id !== this.businessId || (mutation.saleId && value.id !== mutation.saleId) ||
      ((mutation.operation === "checkout" || mutation.operation === "complete") && (value.status !== "completed" || !value.completed_at))) throw new Error(i18n.t("business:pos.checkout_invalid_result"));
    const next = closesCart ? this.without(id) : {
      ...this.state.workspace, sessions: this.state.workspace.sessions.map((entry) => entry.id === id ? {
        ...entry, sale: value, lines: saleToCart(value), paymentMethod: value.payment_method, description: value.payment_method_description ?? "", dirty: false, pending: null, quantityDrafts: {}, barcode: "",
      } : entry),
    };
    if (!this.commit(next)) throw new Error(i18n.t("business:pos.storage_error"));
    await this.invalidate();
    if (!this.current(lease)) return false;
    sileo.success({ title: closesCart ? i18n.t("business:pos.sale_saved_tab", { number }) : i18n.t("business:pos.saved") });
    return true;
  }
  private async dispatch(id: string, mutation: SaleMutation): Promise<Sale | null> {
    if (!this.current() || this.state.storageError || this.locks.has(id) || !this.session(id)) return null;
    const pending = this.session(id)?.pending;
    if (pending && !sameIntention(pending.mutation, mutation)) return null;
    const lease = this.lease;
    this.locks.add(id); this.publish();
    try {
      const journal: SaleJournal = { actorId: this.actorId, businessId: this.businessId, mutation };
      if (!this.replace(id, (entry) => ({ ...entry, pending: journal }))) throw new Error(i18n.t("business:pos.storage_error"));
      const result = await mutateSale(this.businessId, mutation);
      return await this.accept(id, result, mutation, lease) ? result : null;
    } catch (error) {
      if (!this.current(lease)) return null;
      const conflict = axios.isAxiosError<{ message?: unknown }>(error) && [error.response?.data?.message].flat().some((message) => message === "business:sale_request_conflict" || message === "business:sale_request_pending");
      if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 408 && !conflict) {
        this.replace(id, (entry) => ({ ...entry, pending: null }));
      }
      errorFeedback(error); return null;
    } finally { this.locks.delete(id); this.publish(); }
  }
  private command(entry: SaleWorkspaceSession) {
    return { request_key: crypto.randomUUID(), items: entry.lines.map(({ product_id, quantity, expected_product_version, expected_unit_price, unit_price_override }) => ({ product_id, quantity, expected_product_version, expected_unit_price, ...(unit_price_override == null ? {} : { unit_price_override }) })), payment_method: entry.paymentMethod, payment_method_description: entry.description.trim() || null };
  }
  save(id: string): Promise<Sale | null> {
    const entry = this.session(id);
    if (!entry || entry.pending) return Promise.resolve(null);
    return this.dispatch(id, { operation: entry.sale ? "update" : "create", saleId: entry.sale?.id, command: { ...this.command(entry), ...(entry.sale ? { expected_version: entry.sale.version } : {}) } });
  }
  checkout(id: string): Promise<Sale | null> {
    const entry = this.session(id);
    if (!entry || entry.sale || entry.pending) return Promise.resolve(null);
    try {
      if (!entry.lines.length || entry.paymentMethod === "other" || BigInt(cartTotal(entry.lines)) <= 0n || entry.description.trim().length > 500 || entry.lines.some((line) => entry.quantityDrafts[line.product_id] !== undefined && quantityFromInput(entry.quantityDrafts[line.product_id]) !== line.quantity)) throw new Error("invalid_checkout");
    } catch { sileo.error({ title: i18n.t("business:pos.checkout_invalid") }); return Promise.resolve(null); }
    const lines = entry.lines.filter((line) => line.quantity > 0);
    if (lines.length !== entry.lines.length && !this.edit(id, { lines, quantityDrafts: Object.fromEntries(Object.entries(entry.quantityDrafts).filter(([productId]) => lines.some((line) => line.product_id === productId))), dirty: true })) return Promise.resolve(null);
    return this.dispatch(id, { operation: "checkout", command: this.command({ ...entry, lines }) });
  }
  transition(id: string, operation: "complete" | "cancel" | "discard", cancellationReason?: string): Promise<Sale | null> {
    const entry = this.session(id);
    if (!entry?.sale || entry.pending || entry.dirty) return Promise.resolve(null);
    return this.dispatch(id, { operation, saleId: entry.sale.id, command: { request_key: crypto.randomUUID(), expected_version: entry.sale.version, ...(cancellationReason ? { cancellation_reason: cancellationReason } : {}) } });
  }
  retry(id: string): Promise<Sale | null> { const entry = this.session(id); return entry?.pending ? this.dispatch(id, entry.pending.mutation) : Promise.resolve(null); }
  async reconcile(id: string): Promise<Sale | null> {
    const pending = this.session(id)?.pending;
    if (!pending || !this.current() || this.state.storageError || this.locks.has(id)) return null;
    const lease = this.lease;
    this.locks.add(id); this.publish();
    try {
      const receipt = await getSaleReceipt(this.businessId, pending.mutation.command.request_key);
      if (receipt.status === "completed" && receipt.sale) return await this.accept(id, receipt.sale, pending.mutation, lease) ? receipt.sale : null;
      if (this.current(lease)) sileo.info({ title: i18n.t("business:pos.unconfirmed") });
      return null;
    } catch (error) { if (this.current(lease)) errorFeedback(error); return null; }
    finally { this.locks.delete(id); this.publish(); }
  }
}
