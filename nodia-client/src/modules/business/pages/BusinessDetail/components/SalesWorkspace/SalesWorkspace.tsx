import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Alert, Box, Button, Chip, Divider, LinearProgress, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import axios from "axios";
import TextInput from "../../../../../../components/inputs/TextInput";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import { notifyHttpError } from "../../../../../../config/httpFeedback";
import useAuthStore from "../../../../../../store/authStore";
import { useUpdateProduct } from "../../../../infrastructure/useServices";
import { getProduct, getProductByBarcode } from "../../../../infrastructure/salesServices";
import { getProducts } from "../../../../infrastructure/services";
import { addCartProduct, barcodeValue, cartTotal, formatClp, productToCartLine, quantityFromInput, refreshCartPrices, removeCartProduct, setCartQuantity, setCartUnitPrice } from "../../../../infrastructure/salesPolicies";
import { stepSaleQuantity } from "../../../../infrastructure/saleQuantities";
import { useSaleDraft } from "../../../../infrastructure/useSaleDraft";
import { useSaleExitGuard } from "../../../../infrastructure/useSaleExitGuard";
import { useSalePriceEditing } from "../../../../infrastructure/useSalePriceEditing";
import { useSaleTicketPrinting } from "../../../../infrastructure/useSaleTicketPrinting";
import { buildCartTicket } from "../../../../infrastructure/saleTicket";
import type { SaleTicketModel } from "../../../../infrastructure/saleTicket";
import type { ProductEntity } from "../../../../infrastructure/types";
import type { SaleSection } from "../../../../infrastructure/salesTypes";
import SalesRecords from "./SalesRecords";
import SalesReports from "./SalesReports";
import PosProductCatalog from "./PosProductCatalog";
import PaymentMethodButtons from "./PaymentMethodButtons";
import OpenSaleTabs, { saleTabId } from "./OpenSaleTabs";
import SaleLineList from "./SaleLineList";
import { permanentSalePricePatch } from "./SaleLinePrice/priceChange";
import SaleTicket from "./SaleTicket";
import { useSaleLineImages } from "../../../../infrastructure/useSaleLineImages";
import { Actions, CartPanel, CatalogPanel, PointOfSaleGrid, TotalAmount, TotalLabel, TotalRow, Workspace } from "./styles";

export default function SalesWorkspace({ businessId, section, businessName }: { businessId: string; section: SaleSection; businessName?: string }) {
  const { t, i18n } = useTranslation(["business", "core"]);
  const [, setSearchParams] = useSearchParams();
  const draft = useSaleDraft(businessId);
  const priceEditor = useSalePriceEditing(draft.activeId);
  const editingPrice = priceEditor.editingProductId !== null;
  const ticketPrinting = useSaleTicketPrinting(businessId, businessName);
  const lineImages = useSaleLineImages(businessId, draft.lines);
  const { barcode, setBarcode, quantityDrafts, setQuantityDrafts } = draft;
  const panelId = useId();
  const mobile = useMediaQuery(useTheme().breakpoints.down("sm"));
  const [mobilePane, setMobilePane] = useState<"catalog" | "cart">("catalog");
  const [fontScale, setFontScale] = useState(100);
  const [lookup, setLookup] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<ProductEntity | null>(null);
  const [assignConfirm, setAssignConfirm] = useState(false);
  const [confirm, setConfirm] = useState<"complete" | "cancel" | "close" | "refresh" | null>(null);
  const [closingSaleId, setClosingSaleId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const inputContainer = useRef<HTMLFormElement>(null);
  const restoreScanFocus = useRef(true);
  const [focusEpoch, setFocusEpoch] = useState(0);
  const requestScanFocus = () => { restoreScanFocus.current = true; setFocusEpoch((value) => value + 1); };
  useEffect(() => { if (section === "pos") restoreScanFocus.current = true; }, [section, businessId]);
  const active = useRef(true);
  const confirming = useRef(false);
  const priceChanging = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => {
    if (!draft.hasUnsaved) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", prevent); return () => window.removeEventListener("beforeunload", prevent);
  }, [draft.hasUnsaved]);
  const updateProduct = useUpdateProduct();
  const busy = draft.busy || lookup || updateProduct.isPending || ticketPrinting.printing;
  const canLeave = draft.canDiscardWorkspace && !busy;
  const { blocker, confirmLeave, showDialog: showLeaveDialog } = useSaleExitGuard({ section, hasUnsaved: draft.hasUnsaved, canDiscard: canLeave, clearForExit: draft.clearForExit });
  const readonly = Boolean(draft.sale);
  const baseControlsDisabled = busy || Boolean(draft.pending) || draft.storageError || readonly;
  const controlsDisabled = baseControlsDisabled || editingPrice;
  let total: string | null = null;
  try { total = cartTotal(draft.lines); } catch { /* Invalid/overflow totals block persistence and completion. */ }
  const quantityInvalid = draft.lines.some((line) => quantityDrafts[line.product_id] !== undefined && quantityFromInput(quantityDrafts[line.product_id]) !== line.quantity);
  const selectedAssignment = assignment;
  const paymentInvalid = draft.description.trim().length > 500 || (!draft.sale && draft.paymentMethod === "other");
  const canComplete = !busy && !editingPrice && !draft.pending && !draft.storageError && (!draft.sale || draft.sale.status === "draft") && !quantityInvalid && !paymentInvalid && total !== null && BigInt(total) > 0n && draft.lines.length > 0;
  let ticketPreview: SaleTicketModel | null = null;
  if (confirm === "complete") {
    try { ticketPreview = buildCartTicket({ businessName, lines: draft.lines, paymentMethod: draft.paymentMethod, description: draft.description, language: i18n.language, showDetails: true }); }
    catch { /* An invalid cart never becomes a printable or confirmable ticket. */ }
  }
  useEffect(() => {
    if (restoreScanFocus.current && section === "pos" && (!mobile || mobilePane === "catalog") && !busy && !editingPrice && !draft.pending && !draft.storageError && !draft.sale && !unknownBarcode && !assignConfirm && !confirm) {
      restoreScanFocus.current = false;
      const scanner = inputContainer.current?.querySelector("input");
      scanner?.focus();
      if (mobile) scanner?.scrollIntoView?.({ block: "center", inline: "nearest" });
    }
  }, [section, mobile, mobilePane, busy, editingPrice, draft.activeId, draft.pending, draft.storageError, draft.sale, unknownBarcode, assignConfirm, confirm, focusEpoch]);
  const add = (product: ProductEntity) => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    try {
      const next = addCartProduct(draft.lines, product); lineImages.remember(product); draft.setLines(next);
      setQuantityDrafts((values) => { const next = { ...values }; delete next[product.id]; return next; });
      setAnnouncement(t("business:pos.added", { name: product.name }));
      requestScanFocus();
    } catch (error) { sileo.error({ title: t(error instanceof Error && error.message === "cart_limit" ? "business:pos.cart_limit" : "business:pos.product_unavailable") }); }
  };
  const scan = async () => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    let value: string;
    try { value = barcodeValue(barcode); } catch { sileo.error({ title: t("business:pos.invalid_barcode") }); return; }
    setLookup(true); setUnknownBarcode(null);
    try {
      const product = await getProductByBarcode(businessId, value);
      if (!active.current) return;
      const next = addCartProduct(draft.lines, product); lineImages.remember(product); draft.setLines(next); setBarcode("");
      setQuantityDrafts((values) => { const next = { ...values }; delete next[product.id]; return next; });
      setAnnouncement(t("business:pos.added", { name: product.name }));
    } catch (error) {
      if (!active.current) return;
      if (axios.isAxiosError(error) && error.response?.status === 404) { setUnknownBarcode(value); setAssignment(null); sileo.error({ title: t("business:pos.barcode_unknown") }); }
      else if (error instanceof Error && ["unavailable_product", "price_changed", "cart_limit"].includes(error.message)) sileo.error({ title: t(error.message === "cart_limit" ? "business:pos.cart_limit" : "business:pos.product_unavailable") });
      else notifyHttpError(error);
    } finally { if (active.current) { restoreScanFocus.current = true; setLookup(false); } }
  };
  const associate = async () => {
    if (priceEditor.blocksChange()) return;
    if (!selectedAssignment || !unknownBarcode || !selectedAssignment.version) return;
    try {
      await updateProduct.mutateAsync({ id: selectedAssignment.id, payload: { barcode: unknownBarcode, expected_version: selectedAssignment.version } });
      restoreScanFocus.current = true;
      setAssignConfirm(false); setUnknownBarcode(null); setAssignment(null); setAnnouncement(t("business:pos.rescan"));
    } catch (error) {
      if (axios.isAxiosError<{ message?: string }>(error) && error.response?.data.message === "product:version_conflict") {
        try { const current = await getProduct(selectedAssignment.id); if (active.current && current.business_id === businessId) setAssignment(current); } catch (readError) { notifyHttpError(readError); }
      }
      // Keep the assignment and dialog. A refreshed revision still needs another explicit confirmation.
    }
  };
  const changePrice = async (id: string, value: string, permanent: boolean): Promise<boolean> => {
    if (baseControlsDisabled || priceEditor.blocksChange(id) || confirming.current || priceChanging.current) return false;
    const line = draft.lines.find((entry) => entry.product_id === id);
    if (!line) return false;
    priceChanging.current = true;
    if (!permanent) {
      try {
        if (!draft.setLines(setCartUnitPrice(draft.lines, id, value))) return false;
        sileo.success({ title: t("business:pos.price_override_saved") });
        return true;
      } catch { sileo.error({ title: t("business:pos.invalid_manual_price") }); return false; }
      finally { priceChanging.current = false; }
    }
    const actor = useAuthStore.getState();
    const current = () => active.current && useAuthStore.getState().user?.id === actor.user?.id && useAuthStore.getState().sessionVersion === actor.sessionVersion;
    setLookup(true);
    let mutating = false;
    try {
      const product = await getProduct(id);
      if (!current()) return false;
      if (product.business_id !== businessId) throw new Error("price_changed");
      const payload = permanentSalePricePatch(product, line, value);
      mutating = true;
      const saved = await updateProduct.mutateAsync({ id, payload });
      mutating = false;
      if (!current()) return false;
      if (saved.id !== id || saved.business_id !== businessId || saved.version === line.expected_product_version || String(saved.sale_price) !== value || saved.is_offer_enabled !== false) throw new Error("price_changed");
      const updated = productToCartLine(saved);
      lineImages.remember(saved);
      return draft.setLines(draft.lines.map((entry) => entry.product_id === id ? { ...updated, quantity: entry.quantity } : entry));
    } catch (error) {
      if (current() && !mutating) {
        if (error instanceof Error && error.message === "price_changed") sileo.error({ title: t("business:pos.price_changed_review") });
        else if (error instanceof Error && error.message === "invalid_price") sileo.error({ title: t("business:pos.invalid_manual_price") });
        else notifyHttpError(error);
      }
      return false;
    } finally { priceChanging.current = false; if (active.current) setLookup(false); }
  };
  const review = async () => {
    if (priceEditor.blocksChange()) return;
    setLookup(true);
    try {
      const next = await refreshCartPrices(businessId, draft.lines, async (ids) => (await getProducts({ limit: 100, includes: true, q: { business_id_eq: businessId, id_in: ids.join(",") } })).data);
      if (active.current) { draft.setLines(next); setQuantityDrafts({}); setAnnouncement(t("business:pos.prices_reviewed")); setConfirm(null); }
    } catch (error) {
      if (error instanceof Error && error.message === "unit_changed") sileo.error({ title: t("business:pos.unit_changed") });
      else notifyHttpError(error);
    } finally { if (active.current) setLookup(false); }
  };
  const transition = async (printDetails?: boolean) => {
    if (priceEditor.blocksChange()) return;
    if (confirm === "close") {
      if (closingSaleId && draft.closeSale(closingSaleId)) { if (closingSaleId === draft.activeId) clearTransient(); else { setConfirm(null); setClosingSaleId(null); } requestScanFocus(); }
      return;
    }
    if (confirm === "refresh") { await review(); return; }
    if (!confirm) return;
    if (confirming.current || priceChanging.current || (confirm === "complete" && (!canComplete || !ticketPreview))) return;
    confirming.current = true;
    if (confirm === "complete") { setUnknownBarcode(null); setAssignment(null); restoreScanFocus.current = true; }
    try {
      const result = confirm === "complete" && !draft.sale ? await draft.checkout() : await draft.transition(confirm, reason.trim());
      if (result && active.current) {
        setConfirm(null); setReason("");
        if (confirm === "complete" && result.status === "completed") {
          ticketPrinting.remember(result);
          if (printDetails !== undefined) await ticketPrinting.printJustSaved(result, printDetails);
        }
        if (result.status === "cancelled" || result.status === "discarded") ticketPrinting.forget(result.id);
      }
    } finally { confirming.current = false; }
  };
  const clearTransient = () => { setUnknownBarcode(null); setAssignment(null); setAssignConfirm(false); setConfirm(null); setClosingSaleId(null); setReason(""); };
  const newSale = () => { if (!priceEditor.blocksChange() && draft.newSale()) { clearTransient(); setMobilePane("catalog"); requestScanFocus(); } };
  const selectSale = (id: string, source: "pointer" | "keyboard") => {
    if (priceEditor.blocksChange()) return;
    if (!draft.selectSale(id)) return;
    clearTransient();
    restoreScanFocus.current = source === "pointer";
    if (source === "pointer") requestScanFocus();
    setAnnouncement(t("business:pos.sale_number", { number: draft.sessions.find((entry) => entry.id === id)?.number }));
  };
  const closeSale = (id: string) => {
    if (priceEditor.blocksChange()) return;
    const session = draft.sessions.find((entry) => entry.id === id);
    if (!session || session.pending || session.busy) return;
    if (!session.sale && session.lines.length > 0) {
      setClosingSaleId(id); setConfirm("close");
    } else if (draft.closeSale(id)) { if (id === draft.activeId) clearTransient(); requestScanFocus(); }
  };
  const clearQuantityInput = (id: string) => setQuantityDrafts((previous) => { const next = { ...previous }; delete next[id]; return next; });
  const changeQuantity = (id: string, raw: string) => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    const quantity = quantityFromInput(raw);
    setQuantityDrafts((previous) => ({ ...previous, [id]: raw }));
    if (quantity === null) return;
    try {
      draft.setLines(setCartQuantity(draft.lines, id, quantity));
    } catch { sileo.error({ title: t("business:pos.invalid_price") }); }
  };
  const stepQuantity = (id: string, delta: number) => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    const line = draft.lines.find((entry) => entry.product_id === id);
    if (!line) return;
    try { draft.setLines(setCartQuantity(draft.lines, id, stepSaleQuantity(line.quantity, delta))); clearQuantityInput(id); }
    catch { sileo.error({ title: t("business:pos.invalid_quantity") }); }
  };
  const closingSale = draft.sessions.find((entry) => entry.id === closingSaleId);
  const openSales = draft.sessions.map((entry) => {
    let amount: string | null = null;
    try { amount = cartTotal(entry.lines); } catch { /* Do not invent a valid amount. */ }
    return { id: entry.id, number: entry.number, amount, pending: Boolean(entry.pending), busy: entry.busy };
  });
  const currency = (value: string | number) => formatClp(value, i18n.language);
  return <Workspace>
    {ticketPrinting.receipt && ticketPrinting.receipt.id !== draft.sale?.id && <Alert severity="success" sx={{ overflowWrap: "anywhere", flexWrap: "wrap", "& .MuiAlert-message": { minWidth: 0, flex: "1 1 0" }, "& .MuiAlert-action": { alignItems: "center", width: { xs: "100%", sm: "auto" }, m: 0, pl: { xs: 0, sm: 2 } } }} action={<Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1, width: "100%" }}>
      <Button variant="contained" fullWidth sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || editingPrice} onClick={() => { if (!priceEditor.blocksChange()) void ticketPrinting.print(undefined, false); }}>{t("business:ticket.print_summary")}</Button>
      <Button variant="contained" fullWidth sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || editingPrice} onClick={() => { if (!priceEditor.blocksChange()) void ticketPrinting.print(undefined, true); }}>{t("business:ticket.print")}</Button>
    </Box>}>
      {t("business:ticket.last_saved", { total: currency(ticketPrinting.receipt.total_amount) })}<Typography component="p" variant="caption">{ticketPrinting.receipt.id}</Typography>
    </Alert>}
    {draft.pending && <Alert severity="warning" action={<Actions><Button disabled={busy} onClick={() => { restoreScanFocus.current = true; void draft.reconcile(); }}>{t("business:pos.reconcile")}</Button><Button disabled={busy} onClick={() => { restoreScanFocus.current = true; void draft.retry(); }}>{t("business:pos.retry_same")}</Button></Actions>}>{t("business:pos.pending")}</Alert>}
    {draft.storageError && <Alert severity="error" action={<Button disabled={busy} onClick={() => { if (draft.retryStorage()) sileo.success({ title: t("business:pos.storage_restored") }); else sileo.error({ title: t("business:pos.workspace_storage_error") }); }}>{t("business:pos.storage_retry")}</Button>}>{t("business:pos.workspace_storage_error")}</Alert>}
    {section === "reports" && <SalesReports businessId={businessId} />}
    {section === "sales" && <SalesRecords businessId={businessId} onOpen={(sale) => { draft.load(sale); clearTransient(); setMobilePane("cart"); setSearchParams((params) => { params.set("section", "pos"); return params; }); }} />}
    {section === "pos" && <>
      <Actions><Typography component="h2" variant="h5" sx={{ flex: 1, fontWeight: 700 }}>{t("business:pos.sale_number", { number: draft.activeNumber })}</Typography><Button variant="contained" size="large" sx={{ minHeight: 56, px: 3, fontSize: "1rem" }} startIcon={<AddOutlined />} disabled={busy || editingPrice || draft.storageError} onClick={newSale}>{t("business:pos.new_sale")}</Button></Actions>
      <OpenSaleTabs sales={openSales} activeId={draft.activeId} panelId={panelId} disabled={lookup || updateProduct.isPending || editingPrice || draft.storageError || Boolean(confirm) || assignConfirm} onSelect={selectSale} onClose={closeSale} />
      <Box aria-live="polite" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>{announcement}</Box>
      {mobile && <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 1 }}>
        <Button variant={mobilePane === "catalog" ? "contained" : "outlined"} aria-pressed={mobilePane === "catalog"} disabled={busy} onClick={() => { setMobilePane("catalog"); requestScanFocus(); }}>{t("business:pos.selected_products")}</Button>
        <Button variant={mobilePane === "cart" ? "contained" : "outlined"} aria-pressed={mobilePane === "cart"} disabled={busy} onClick={() => setMobilePane("cart")}>{t("business:pos.payment_summary")} ({draft.lines.length}){total !== null ? ` · ${currency(total)}` : ""}</Button>
      </Box>}
      <PointOfSaleGrid role="tabpanel" id={panelId} aria-labelledby={saleTabId(panelId, draft.activeId)}>
        <CatalogPanel sx={{ display: mobile && mobilePane !== "catalog" ? "none" : "flex" }}>
          <Box component="form" ref={inputContainer} onSubmit={(event) => { event.preventDefault(); void scan(); }} sx={{ display: "grid", gap: 1 }}>
            <TextInput label={t("business:pos.scan_label")} value={barcode} onChange={(event) => setBarcode(event.target.value)} disabled={controlsDisabled} />
            <Button type="submit" variant="contained" disabled={controlsDisabled || !barcode}>{t("business:pos.scan_add")}</Button>
            <Typography variant="caption" color="text.secondary">{t(busy ? "business:pos.scan_paused" : "business:pos.scan_ready")}</Typography>
          </Box>
          {unknownBarcode && <Alert severity="warning" sx={{ mt: 2 }}>
            {t("business:pos.barcode_unknown_value", { barcode: unknownBarcode })}
            {selectedAssignment && <Typography sx={{ mt: 1, fontWeight: 600, overflowWrap: "anywhere" }}>{selectedAssignment.name}</Typography>}
            <Button disabled={busy || editingPrice || !selectedAssignment} onClick={() => setAssignConfirm(true)}>{t("business:pos.assign_barcode")}</Button>
            <Button disabled={busy || editingPrice} onClick={() => { setUnknownBarcode(null); setAssignment(null); requestScanFocus(); }}>{t("business:cancel")}</Button>
          </Alert>}
          <PosProductCatalog businessId={businessId} disabled={controlsDisabled} assignmentMode={Boolean(unknownBarcode)} onSelect={(product) => unknownBarcode ? setAssignment(product) : add(product)} />
          <SaleLineList lines={draft.lines} images={lineImages.images} imageLoading={lineImages.isLoading} imageError={lineImages.isError} imageFetching={lineImages.isFetching} retryImages={() => void lineImages.retry()}
            disabled={controlsDisabled} quantityDrafts={quantityDrafts} onStep={stepQuantity} onQuantity={changeQuantity} onReview={!readonly && draft.lines.length ? () => setConfirm("refresh") : undefined}
            fontScale={fontScale} onFontScale={setFontScale} editingScope={draft.activeId} onPrice={readonly ? undefined : changePrice}
            priceDisabled={baseControlsDisabled} editingProductId={priceEditor.editingProductId} onPriceEditingChange={priceEditor.onEditingChange}
            onRemove={readonly ? undefined : (id) => { if (!controlsDisabled && !priceEditor.blocksChange() && draft.setLines(removeCartProduct(draft.lines, id))) { clearQuantityInput(id); sileo.success({ title: t("business:pos.product_removed") }); } }} />
        </CatalogPanel>
        <CartPanel role="region" aria-label={t("business:pos.payment_summary")} sx={{ display: mobile && mobilePane !== "cart" ? "none" : "flex" }}>
          <TotalRow><TotalLabel as="h2">{t("business:pos.total")}</TotalLabel><TotalAmount>{total === null ? "—" : currency(total)}</TotalAmount></TotalRow>
          {total === null && <Alert severity="error">{t("business:pos.invalid_price")}</Alert>}
          <Divider />
          <Box sx={{ display: "grid", gap: 2 }}>
            <PaymentMethodButtons value={draft.paymentMethod} disabled={controlsDisabled} onChange={(method) => { if (!priceEditor.blocksChange()) draft.setPaymentMethod(method); }} />
            {draft.paymentMethod === "other" && (draft.sale ? <Typography variant="body2">{t("business:pos.payment_other")}{draft.description ? ` · ${draft.description}` : ""}</Typography> : <Alert severity="warning">{t("business:pos.legacy_other_select")}</Alert>)}
            <Divider />
            {busy && <LinearProgress />}
            <Actions sx={{ "& > button:not(.MuiButton-sizeLarge)": { minHeight: 44, flex: { xs: "1 1 100%", sm: "1 1 0" } } }}>
              {(!draft.sale || draft.sale.status === "draft") && <Button fullWidth size="large" variant="contained" sx={{ minHeight: 56, fontSize: "1.1rem" }} disabled={!canComplete} onClick={() => setConfirm("complete")}>{t("business:pos.complete")}</Button>}
              {draft.sale?.status === "completed" && <Button variant="contained" color="error" disabled={busy || Boolean(draft.pending)} onClick={() => setConfirm("cancel")}>{t("business:pos.cancel_sale")}</Button>}
              {draft.sale?.status === "completed" && <Button variant="contained" sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || Boolean(draft.pending)} onClick={() => { if (draft.sale) void ticketPrinting.print(draft.sale, false); }}>{t("business:ticket.print_summary")}</Button>}
            </Actions>
            {draft.sale?.status === "completed" && <Button fullWidth variant="contained" sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || Boolean(draft.pending)} onClick={() => { if (draft.sale) void ticketPrinting.print(draft.sale, true); }}>{t("business:ticket.print")}</Button>}
            {draft.sale && <Box sx={{ display: "grid", gap: 1 }}><Chip label={t(draft.sale.status === "draft" ? "business:pos.legacy_unconfirmed" : `business:pos.status_${draft.sale.status}`)} /><Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>{draft.sale.id}</Typography></Box>}
            {draft.sale?.completed_at && <Typography variant="caption">{new Date(draft.sale.completed_at).toLocaleString(i18n.language, { timeZone: "America/Santiago" })} · America/Santiago</Typography>}
            {draft.sale?.cancellation_reason && <Alert severity="warning">{draft.sale.cancellation_reason}</Alert>}
          </Box>
        </CartPanel>
      </PointOfSaleGrid>
    </>}
    <ConfirmDialog open={Boolean(confirm)} onClose={() => { if (!busy) setConfirm(null); }} onConfirm={() => void transition()} isLoading={busy} confirmDisabled={(confirm === "cancel" && !reason.trim()) || (confirm === "complete" && (!canComplete || !ticketPreview)) || (confirm === "close" && (!closingSale || closingSale.busy || Boolean(closingSale.pending) || draft.storageError))} title={t(`business:pos.confirm_${confirm ?? "complete"}`, { number: closingSale?.number })} size={confirm === "complete" ? "md" : "sm"} message={confirm === "close" ? t("business:pos.close_sale_explanation") : confirm === "complete" ? t("business:ticket.review_hint") : t("business:pos.confirm_explanation")}
      additionalActions={confirm === "complete" ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1, minWidth: 0, width: "100%" }}>
        <Button fullWidth variant="contained" startIcon={<PrintOutlined />} disabled={!canComplete || !ticketPreview} onClick={() => void transition(false)}>{t("business:ticket.confirm_and_print_summary")}</Button>
        <Button fullWidth variant="contained" startIcon={<PrintOutlined />} disabled={!canComplete || !ticketPreview} onClick={() => void transition(true)}>{t("business:ticket.confirm_and_print")}</Button>
      </Box> : undefined}>
      {confirm === "cancel" && <TextInput label={t("business:pos.cancellation_reason")} value={reason} onChange={(event) => setReason(event.target.value)} required disabled={busy} />}
      {confirm === "complete" && <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, gap: 2 }}>
        {ticketPreview ? <SaleTicket ticket={ticketPreview} /> : <Alert severity="error">{t("business:ticket.preview_invalid")}</Alert>}
      </Box>}
    </ConfirmDialog>
    <ConfirmDialog open={assignConfirm} onClose={() => { if (!busy) setAssignConfirm(false); }} onConfirm={associate} isLoading={updateProduct.isPending} confirmDisabled={!selectedAssignment?.version || busy} title={t("business:pos.assign_barcode")} message={t("business:pos.assign_confirm", { barcode: unknownBarcode, name: selectedAssignment?.name, previous: selectedAssignment?.barcode ?? t("business:pos.no_barcode") })}>{!selectedAssignment && <Alert severity="error">{t("business:pos.product_unavailable")}</Alert>}</ConfirmDialog>
    <ConfirmDialog open={showLeaveDialog} onClose={() => blocker.reset?.()} onConfirm={confirmLeave} confirmDisabled={!canLeave} title={t("business:pos.leave_title")} message={t(canLeave ? "business:pos.leave_message" : draft.storageError ? "business:pos.leave_storage_message" : "business:pos.leave_pending_message")} />
  </Workspace>;
}
