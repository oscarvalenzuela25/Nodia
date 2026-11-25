import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Alert, Box, Button, Chip, Divider, IconButton, LinearProgress, Typography, useMediaQuery, useTheme } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import PrintOutlined from "@mui/icons-material/PrintOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import axios from "axios";
import TextInput from "../../../../../../components/inputs/TextInput";
import ConfirmDialog from "../../../../../../components/ConfirmDialog";
import { getHttpErrorMessage, notifyHttpError } from "../../../../../../config/httpFeedback";
import { getServerErrorCode } from "../../../../../../config/axiosInstance";
import useAuthStore from "../../../../../../store/authStore";
import { useUpdateProduct } from "../../../../infrastructure/useServices";
import { getProduct } from "../../../../infrastructure/salesServices";
import { usePosBarcodeLookup } from "../../../../infrastructure/usePosBarcodeLookup";
import { getProducts } from "../../../../infrastructure/services";
import { cartTotal, exceedsObservedStock, formatClp, InsufficientStockError, productToCartLine, quantityFromInput, refreshCartPrices, removeCartProduct, setCartQuantity, setCartUnitPrice } from "../../../../infrastructure/salesPolicies";
import { formatQuantity, stepSaleQuantity } from "../../../../infrastructure/saleQuantities";
import { useSaleDraft } from "../../../../infrastructure/useSaleDraft";
import { useSaleExitGuard } from "../../../../infrastructure/useSaleExitGuard";
import { useSalePriceEditing } from "../../../../infrastructure/useSalePriceEditing";
import { useSaleTicketPrinting } from "../../../../infrastructure/useSaleTicketPrinting";
import { buildCartTicket } from "../../../../infrastructure/saleTicket";
import type { SaleTicketModel } from "../../../../infrastructure/saleTicket";
import type { ProductEntity } from "../../../../infrastructure/types";
import type { CartLine, SaleSection } from "../../../../infrastructure/salesTypes";
import SalesRecords from "./SalesRecords";
import SalesReports from "./SalesReports";
import PosProductCatalog from "./PosProductCatalog";
import PosProductRegistration from "./PosProductRegistration";
import PaymentMethodButtons from "./PaymentMethodButtons";
import OpenSaleTabs, { saleTabId } from "./OpenSaleTabs";
import SaleLineList from "./SaleLineList";
import { permanentSalePricePatch } from "./SaleLinePrice/priceChange";
import SaleTicket from "./SaleTicket";
import { useSaleLineImages } from "../../../../infrastructure/useSaleLineImages";
import { Actions, CartPanel, CatalogPanel, CheckoutColumn, CompleteSaleButton, NewSaleButton, PointOfSaleGrid, SalePanels, ScannerFields, TotalAmount, TotalLabel, TotalRow, Workspace } from "./styles";

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
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down("sm"));
  const wide = useMediaQuery(theme.breakpoints.up("lg"));
  const [fontScale, setFontScale] = useState(100);
  const [lookup, setLookup] = useState(false);
  const [missingBarcode, setMissingBarcode] = useState<{ id: number; scope: string; barcode: string; stage: "prompt" | "register" | "assign" } | null>(null);
  const missingSequence = useRef(0);
  const currentMissing = useRef<typeof missingBarcode>(null);
  const completedRegistration = useRef<number | null>(null);
  const [assignment, setAssignment] = useState<ProductEntity | null>(null);
  const [assignConfirm, setAssignConfirm] = useState(false);
  const [confirm, setConfirm] = useState<"complete" | "cancel" | "close" | "refresh" | null>(null);
  const [catalogReview, setCatalogReview] = useState<CartLine[] | null>(null);
  const [reviewFailed, setReviewFailed] = useState(false);
  const [closingSaleId, setClosingSaleId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const workspace = useRef<HTMLDivElement>(null);
  const [scrollToTopVersion, setScrollToTopVersion] = useState(0);
  const inputContainer = useRef<HTMLFormElement>(null);
  const checkoutPanel = useRef<HTMLDivElement>(null);
  const focusHistoricalCheckout = useRef(false);
  const restoreScanFocus = useRef(true);
  const scrollToScanner = useRef(false);
  const [focusEpoch, setFocusEpoch] = useState(0);
  const requestScanFocus = () => {
    restoreScanFocus.current = true;
    scrollToScanner.current = true;
    setFocusEpoch((value) => value + 1);
  };
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
  const stockFeedback = (error: InsufficientStockError) => sileo.error({
    title: t("business:stock_tracking.insufficient", { stock: formatQuantity(error.available, i18n.language) }),
  });
  const addProductToDraft = (product: ProductEntity, clearBarcode = false) => {
    if (!draft.addProduct(product, { clearBarcode })) return false;
    lineImages.remember(product);
    setAnnouncement(t("business:pos.added", { name: product.name }));
    setScrollToTopVersion((version) => version + 1);
    return true;
  };
  const barcodeLookup = usePosBarcodeLookup({ businessId, context: JSON.stringify([draft.activeId, section]),
    enabled: section === "pos" && !draft.busy && !lookup && !updateProduct.isPending && !ticketPrinting.printing && !editingPrice && !draft.pending && !draft.storageError && !draft.sale,
    onProduct: product => { addProductToDraft(product, true); },
    onMissing: (value, scope) => { setMissingBarcode({ id: ++missingSequence.current, scope, barcode: value, stage: "prompt" }); setAssignment(null); sileo.error({ title: t("business:pos.barcode_unknown") }); },
    onError: error => {
      if (error instanceof Error && error.message === "invalid_barcode") sileo.error({ title: t("business:pos.invalid_barcode") });
      else if (error instanceof InsufficientStockError) stockFeedback(error);
      else if (error instanceof Error && ["unavailable_product", "price_changed", "cart_limit"].includes(error.message)) sileo.error({ title: t(error.message === "cart_limit" ? "business:pos.cart_limit" : "business:pos.product_unavailable") });
      else notifyHttpError(error);
    },
    onFinished: () => { restoreScanFocus.current = true; },
  });
  const unknown = missingBarcode?.scope === barcodeLookup.scope ? missingBarcode : null;
  useLayoutEffect(() => { currentMissing.current = unknown; return () => { currentMissing.current = null; }; }, [unknown]);
  const unknownBarcode = unknown?.barcode ?? null;
  const registrationOverlay = unknown?.stage === "prompt" || unknown?.stage === "register";
  const assigning = assignConfirm && unknown?.stage === "assign";
  const busy = draft.busy || lookup || barcodeLookup.busy || updateProduct.isPending || ticketPrinting.printing;
  const canLeave = draft.canDiscardWorkspace && !busy && !unknownBarcode;
  const { blocker, confirmLeave, showDialog: showLeaveDialog } = useSaleExitGuard({ section, hasUnsaved: draft.hasUnsaved, canDiscard: canLeave, clearForExit: draft.clearForExit });
  const readonly = Boolean(draft.sale);
  const baseControlsDisabled = busy || Boolean(draft.pending) || draft.storageError || readonly;
  const controlsDisabled = baseControlsDisabled || editingPrice || Boolean(unknownBarcode);
  let total: string | null = null;
  try { total = cartTotal(draft.lines); } catch { /* Invalid/overflow totals block persistence and completion. */ }
  const quantityInvalid = draft.lines.some((line) => quantityDrafts[line.product_id] !== undefined && quantityFromInput(quantityDrafts[line.product_id]) !== line.quantity);
  const selectedAssignment = assignment;
  const paymentInvalid = draft.description.trim().length > 500 || (!draft.sale && draft.paymentMethod === "other");
  const stockInvalid = draft.lines.some((line) => exceedsObservedStock(line, line.quantity));
  const canReviewCatalog = (!draft.sale || draft.sale.status === "draft") && draft.lines.length > 0;
  const reviewDisabled = busy || editingPrice || !!unknownBarcode || !!draft.pending || draft.storageError;
  const canComplete = !reviewDisabled && !draft.catalogConflict && !stockInvalid && (!draft.sale || (draft.sale.status === "draft" && !draft.dirty)) && !quantityInvalid && !paymentInvalid && total !== null && BigInt(total) > 0n && draft.lines.length > 0;
  let ticketPreview: SaleTicketModel | null = null;
  if (confirm === "complete") {
    try { ticketPreview = buildCartTicket({ businessName, lines: draft.lines, paymentMethod: draft.paymentMethod, description: draft.description, language: i18n.language, showDetails: true }); }
    catch { /* An invalid cart never becomes a printable or confirmable ticket. */ }
  }
  useEffect(() => {
    if (restoreScanFocus.current && section === "pos" && !busy && !editingPrice && !draft.pending && !draft.storageError && !draft.sale && !unknownBarcode && !assigning && !confirm) {
      restoreScanFocus.current = false;
      const scanner = inputContainer.current?.querySelector("input");
      scanner?.focus({ preventScroll: true });
      if (mobile && scrollToScanner.current) scanner?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      scrollToScanner.current = false;
    }
  }, [section, mobile, busy, editingPrice, draft.activeId, draft.pending, draft.storageError, draft.sale, unknownBarcode, assigning, confirm, focusEpoch]);
  useEffect(() => {
    if (section !== "pos" || !focusHistoricalCheckout.current) return;
    focusHistoricalCheckout.current = false;
    if (mobile) checkoutPanel.current?.focus();
  }, [section, mobile]);
  const add = (product: ProductEntity) => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    try {
      if (addProductToDraft(product)) requestScanFocus();
    } catch (error) {
      if (error instanceof InsufficientStockError) stockFeedback(error);
      else sileo.error({ title: t(error instanceof Error && error.message === "cart_limit" ? "business:pos.cart_limit" : "business:pos.product_unavailable") });
    }
  };
  const scan = async () => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    await barcodeLookup.scan(barcode);
  };
  const dismissUnknown = () => {
    if (!unknown || !barcodeLookup.isCurrent() || currentMissing.current?.id !== unknown.id) return;
    barcodeLookup.resume(); setMissingBarcode(null); setBarcode(""); setAssignment(null); setAssignConfirm(false); requestScanFocus();
  };
  const addRegisteredProduct = async (saved: ProductEntity) => {
    if (!unknown || unknown.stage !== "register" || completedRegistration.current === unknown.id) return;
    const currentIntent = () => barcodeLookup.isCurrent() && currentMissing.current?.id === unknown.id;
    if (!currentIntent()) return;
    completedRegistration.current = unknown.id;
    try {
      if (!saved || typeof saved.id !== "string" || !saved.id.trim() || saved.business_id !== businessId || !Number.isSafeInteger(saved.version) || !saved.version || saved.version < 1) throw new Error("unavailable_product");
      let product = saved;
      // Current mutation responses include catalogPrice. Historical recovery
      // journals can lack that projection; read it exactly, never invent it.
      if (saved.effective_price === undefined || saved.price_source === undefined) {
        product = await getProduct(saved.id);
        if (!currentIntent()) return;
        if (product.id !== saved.id || product.business_id !== businessId || product.version !== saved.version) throw new Error("price_changed");
      }
      if (!addProductToDraft(product)) throw new Error("cart_rejected");
      sileo.success({ title: t("business:pos.added", { name: product.name }) });
    } catch (error) {
      if (!currentIntent()) return;
      const description = error instanceof InsufficientStockError
        ? t("business:stock_tracking.insufficient", { stock: formatQuantity(error.available, i18n.language) })
        : axios.isAxiosError(error) ? getHttpErrorMessage(error) : t("business:pos.registered_not_added_help");
      sileo.error({ title: t("business:pos.registered_not_added"), description });
    }
  };
  const associate = async () => {
    if (priceEditor.blocksChange()) return;
    if (!selectedAssignment || !unknown || !unknownBarcode || !selectedAssignment.version) return;
    const currentIntent = () => barcodeLookup.isCurrent() && currentMissing.current?.id === unknown.id;
    try {
      await updateProduct.mutateAsync({ id: selectedAssignment.id, payload: { barcode: unknownBarcode, expected_version: selectedAssignment.version } });
      if (!currentIntent()) return;
      restoreScanFocus.current = true;
      dismissUnknown(); setAnnouncement(t("business:pos.rescan"));
    } catch (error) {
      if (!currentIntent()) return;
      if (axios.isAxiosError<{ message?: string }>(error) && (getServerErrorCode(error) ?? error.response?.data.message) === "product:version_conflict") {
        try { const current = await getProduct(selectedAssignment.id); if (currentIntent() && current.business_id === businessId) setAssignment(current); } catch (readError) { if (currentIntent()) notifyHttpError(readError); }
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
  const loadCatalogReview = async () => {
    if (reviewDisabled || priceEditor.blocksChange()) return;
    setCatalogReview(null); setReviewFailed(false); setConfirm("refresh");
    const actor = useAuthStore.getState();
    const current = () => active.current && useAuthStore.getState().user?.id === actor.user?.id && useAuthStore.getState().sessionVersion === actor.sessionVersion;
    setLookup(true);
    try {
      const next = await refreshCartPrices(businessId, draft.lines, async (ids) => (await getProducts({ limit: 100, includes: true, q: { business_id_eq: businessId, id_in: ids.join(",") } })).data);
      if (current()) setCatalogReview(next);
    } catch (error) {
      if (!current()) return;
      setReviewFailed(true);
      if (error instanceof Error && error.message === "unit_changed") sileo.error({ title: t("business:pos.unit_changed") });
      else notifyHttpError(error);
    } finally { if (active.current) setLookup(false); }
  };
  const review = async () => {
    if (!catalogReview || reviewDisabled) return;
    if (await draft.reviewCatalog(catalogReview) && active.current) {
      setCatalogReview(null); setConfirm(null); setAnnouncement(t("business:pos.prices_reviewed"));
    }
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
    if (confirm === "complete") { setMissingBarcode(null); setAssignment(null); restoreScanFocus.current = true; }
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
  const clearTransient = () => { setMissingBarcode(null); setAssignment(null); setAssignConfirm(false); setConfirm(null); setClosingSaleId(null); setReason(""); setCatalogReview(null); };
  const newSale = () => { if (!priceEditor.blocksChange() && draft.newSale()) { clearTransient(); requestScanFocus(); } };
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
    } catch (error) {
      if (error instanceof InsufficientStockError) stockFeedback(error);
      else sileo.error({ title: t("business:pos.invalid_price") });
    }
  };
  const stepQuantity = (id: string, delta: number) => {
    if (controlsDisabled || priceEditor.blocksChange()) return;
    const line = draft.lines.find((entry) => entry.product_id === id);
    if (!line) return;
    try { draft.setLines(setCartQuantity(draft.lines, id, stepSaleQuantity(line.quantity, delta))); clearQuantityInput(id); }
    catch (error) {
      if (error instanceof InsufficientStockError) stockFeedback(error);
      else sileo.error({ title: t("business:pos.invalid_quantity") });
    }
  };
  const closingSale = draft.sessions.find((entry) => entry.id === closingSaleId);
  const openSales = draft.sessions.map((entry) => {
    let amount: string | null = null;
    try { amount = cartTotal(entry.lines); } catch { /* Do not invent a valid amount. */ }
    return { id: entry.id, number: entry.number, amount, pending: Boolean(entry.pending), busy: entry.busy };
  });
  const currency = (value: string | number) => formatClp(value, i18n.language);
  const receipt = ticketPrinting.receipt;
  return <Workspace ref={workspace} tabIndex={-1}>
    {receipt && receipt.id !== draft.sale?.id && <Alert
      severity="success"
      sx={{
        overflowWrap: "anywhere",
        flexWrap: "wrap",
        "& .MuiAlert-message": { minWidth: 0, flex: "1 1 0" },
        "& .MuiAlert-action": { alignItems: "center", width: { xs: "100%", sm: "auto" }, m: 0, pl: { xs: 0, sm: 2 } },
      }}
      action={<Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: 1, width: "100%" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1, minWidth: 0 }}>
          <Button variant="contained" fullWidth sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || editingPrice || Boolean(unknownBarcode)} onClick={() => { if (!priceEditor.blocksChange()) void ticketPrinting.print(undefined, false); }}>{t("business:ticket.print_summary")}</Button>
          <Button variant="contained" fullWidth sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || editingPrice || Boolean(unknownBarcode)} onClick={() => { if (!priceEditor.blocksChange()) void ticketPrinting.print(undefined, true); }}>{t("business:ticket.print")}</Button>
        </Box>
        <IconButton
          aria-label={t("core:close")}
          color="inherit"
          disabled={ticketPrinting.printing}
          sx={{ width: 44, height: 44 }}
          onClick={() => {
            ticketPrinting.forget(receipt.id);
            workspace.current?.focus({ preventScroll: true });
          }}
        >
          <CloseOutlined fontSize="small" />
        </IconButton>
      </Box>}
    >
      {t("business:ticket.last_saved", { total: currency(receipt.total_amount) })}
      <Typography component="p" variant="caption">{receipt.id}</Typography>
    </Alert>}
    {draft.pending && <Alert severity="warning" action={<Actions><Button disabled={busy} onClick={() => { restoreScanFocus.current = true; void draft.reconcile(); }}>{t("business:pos.reconcile")}</Button><Button disabled={busy} onClick={() => { restoreScanFocus.current = true; void draft.retry(); }}>{t("business:pos.retry_same")}</Button></Actions>}>{t("business:pos.pending")}</Alert>}
    {draft.storageError && <Alert severity="error" action={<Button disabled={busy} onClick={() => { if (draft.retryStorage()) sileo.success({ title: t("business:pos.storage_restored") }); else sileo.error({ title: t("business:pos.workspace_storage_error") }); }}>{t("business:pos.storage_retry")}</Button>}>{t("business:pos.workspace_storage_error")}</Alert>}
    {section === "reports" && <SalesReports businessId={businessId} />}
    {section === "sales" && <SalesRecords businessId={businessId} onOpen={(sale) => {
      draft.load(sale);
      clearTransient();
      focusHistoricalCheckout.current = true;
      setSearchParams((params) => { params.set("section", "pos"); return params; });
    }} />}
    {section === "pos" && <>
      <Box aria-live="polite" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>{announcement}</Box>
      <PointOfSaleGrid>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" variant="body2" sx={{ fontWeight: 700, mb: 1 }}>{t("business:pos.open_sales")}</Typography>
          <OpenSaleTabs sales={openSales} activeId={draft.activeId} panelId={panelId} orientation={wide ? "vertical" : "horizontal"}
            disabled={busy || editingPrice || draft.storageError || Boolean(confirm) || assigning || unknownBarcode !== null} onSelect={selectSale} onClose={closeSale} />
        </Box>
        <SalePanels role="tabpanel" id={panelId} aria-labelledby={saleTabId(panelId, draft.activeId)}>
          <CatalogPanel>
            <Typography component="h2" variant="h6" sx={{ fontWeight: 700, textAlign: "start", overflowWrap: "anywhere" }}>{t("business:pos.sale_number", { number: draft.activeNumber })}</Typography>
            <Box component="form" ref={inputContainer} onSubmit={(event) => { event.preventDefault(); void scan(); }} sx={{ display: "grid", gap: .75 }}>
              <ScannerFields>
                <TextInput label={t("business:pos.scan_label")} value={barcode} onChange={(event) => setBarcode(event.target.value)} disabled={controlsDisabled} />
                <Button type="submit" variant="outlined" sx={{ minHeight: 44 }} disabled={controlsDisabled || !barcode}>{t("business:pos.scan_add")}</Button>
              </ScannerFields>
              <Typography variant="caption" color="text.secondary">{t(busy ? "business:pos.scan_paused" : "business:pos.scan_ready")}</Typography>
            </Box>
            {unknownBarcode && unknown?.stage === "assign" && <Alert severity="warning" sx={{ mt: 2 }}>
              {t("business:pos.barcode_unknown_value", { barcode: unknownBarcode })}
              {selectedAssignment && <Typography sx={{ mt: 1, fontWeight: 600, overflowWrap: "anywhere" }}>{selectedAssignment.name}</Typography>}
              <Button disabled={busy || editingPrice || !selectedAssignment} onClick={() => setAssignConfirm(true)}>{t("business:pos.assign_barcode")}</Button>
              <Button disabled={busy || editingPrice} onClick={dismissUnknown}>{t("business:cancel")}</Button>
            </Alert>}
            <PosProductCatalog businessId={businessId} disabled={baseControlsDisabled || editingPrice || registrationOverlay || assigning} assignmentMode={unknown?.stage === "assign"} onSelect={(product) => unknown?.stage === "assign" ? setAssignment(product) : add(product)} />
            <SaleLineList lines={draft.lines} images={lineImages.images} imageLoading={lineImages.isLoading} imageError={lineImages.isError} imageFetching={lineImages.isFetching} retryImages={() => void lineImages.retry()}
              disabled={controlsDisabled} quantityDrafts={quantityDrafts} onStep={stepQuantity} onQuantity={changeQuantity} onReview={canReviewCatalog ? () => void loadCatalogReview() : undefined} reviewDisabled={reviewDisabled}
              fontScale={fontScale} onFontScale={setFontScale} editingScope={draft.activeId} onPrice={readonly ? undefined : changePrice} scrollToTopVersion={scrollToTopVersion}
              priceDisabled={baseControlsDisabled || Boolean(unknownBarcode)} editingProductId={priceEditor.editingProductId} onPriceEditingChange={priceEditor.onEditingChange}
              onRemove={readonly ? undefined : (id) => { if (!controlsDisabled && !priceEditor.blocksChange() && draft.setLines(removeCartProduct(draft.lines, id))) { clearQuantityInput(id); sileo.success({ title: t("business:pos.product_removed") }); } }} />
          </CatalogPanel>
          <CheckoutColumn>
            <NewSaleButton fullWidth variant="contained" startIcon={<AddOutlined />} disabled={busy || editingPrice || unknownBarcode !== null || draft.storageError} onClick={newSale}>{t("business:pos.new_sale")}</NewSaleButton>
            <CartPanel ref={checkoutPanel} role="region" aria-label={t("business:pos.payment_summary")} tabIndex={-1}>
              <TotalRow><TotalLabel as="h2">{t("business:pos.checkout_total")}</TotalLabel><TotalAmount>{total === null ? "—" : currency(total)}</TotalAmount></TotalRow>
              {total === null && <Alert severity="error">{t("business:pos.invalid_price")}</Alert>}
              {draft.catalogConflict && <Alert severity="warning" sx={{ flexWrap: "wrap", "& .MuiAlert-action": { pl: 0 } }} action={<Button disabled={reviewDisabled} onClick={() => void loadCatalogReview()}>{t("business:stock_tracking.review_cart")}</Button>}>{t("business:stock_tracking.review_required")}</Alert>}
              <Divider />
              <PaymentMethodButtons value={draft.paymentMethod} disabled={controlsDisabled} onChange={(method) => { if (!priceEditor.blocksChange()) draft.setPaymentMethod(method); }} />
              {draft.paymentMethod === "other" && (draft.sale ? <Typography variant="body2">{t("business:pos.payment_other")}{draft.description ? ` · ${draft.description}` : ""}</Typography> : <Alert severity="warning">{t("business:pos.legacy_other_select")}</Alert>)}
              {busy && <LinearProgress />}
              {(!draft.sale || draft.sale.status === "draft") && <CompleteSaleButton fullWidth variant="contained" color="inherit" startIcon={<CheckOutlined />} disabled={!canComplete} onClick={() => setConfirm("complete")}>{t("business:pos.complete")}</CompleteSaleButton>}
              {draft.sale?.status === "completed" && <>
                <Button variant="contained" color="error" sx={{ minHeight: 44 }} disabled={busy || Boolean(draft.pending)} onClick={() => setConfirm("cancel")}>{t("business:pos.cancel_sale")}</Button>
                <Button variant="contained" sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || Boolean(draft.pending)} onClick={() => { if (draft.sale) void ticketPrinting.print(draft.sale, false); }}>{t("business:ticket.print_summary")}</Button>
                <Button fullWidth variant="contained" sx={{ minHeight: 44 }} startIcon={<PrintOutlined />} disabled={busy || Boolean(draft.pending)} onClick={() => { if (draft.sale) void ticketPrinting.print(draft.sale, true); }}>{t("business:ticket.print")}</Button>
              </>}
              {draft.sale && <Box sx={{ display: "grid", gap: 1 }}><Chip label={t(draft.sale.status === "draft" ? "business:pos.legacy_unconfirmed" : `business:pos.status_${draft.sale.status}`)} /><Typography variant="caption" sx={{ overflowWrap: "anywhere" }}>{draft.sale.id}</Typography></Box>}
              {draft.sale?.completed_at && <Typography variant="caption">{new Date(draft.sale.completed_at).toLocaleString(i18n.language, { timeZone: "America/Santiago" })} · America/Santiago</Typography>}
              {draft.sale?.cancellation_reason && <Alert severity="warning">{draft.sale.cancellation_reason}</Alert>}
            </CartPanel>
          </CheckoutColumn>
        </SalePanels>
      </PointOfSaleGrid>
    </>}
    <ConfirmDialog open={Boolean(confirm)} onClose={() => { if (!busy) { setConfirm(null); setCatalogReview(null); } }} onConfirm={() => void transition()} isLoading={busy} confirmDisabled={(confirm === "cancel" && !reason.trim()) || (confirm === "complete" && (!canComplete || !ticketPreview)) || (confirm === "refresh" && (!catalogReview || !!draft.pending || (readonly && catalogReview.some((line) => exceedsObservedStock(line, line.quantity))))) || (confirm === "close" && (!closingSale || closingSale.busy || Boolean(closingSale.pending) || draft.storageError))} title={t(confirm === "refresh" ? "business:stock_tracking.review_cart" : `business:pos.confirm_${confirm ?? "complete"}`, { number: closingSale?.number })} size={confirm === "complete" ? "md" : "sm"} message={confirm === "close" ? t("business:pos.close_sale_explanation") : confirm === "complete" ? t("business:ticket.review_hint") : confirm === "refresh" ? t("business:stock_tracking.review_hint") : t("business:pos.confirm_explanation")}
      additionalActions={confirm === "complete" ? <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 1, minWidth: 0, width: "100%" }}>
        <Button fullWidth variant="contained" startIcon={<PrintOutlined />} disabled={!canComplete || !ticketPreview} onClick={() => void transition(false)}>{t("business:ticket.confirm_and_print_summary")}</Button>
        <Button fullWidth variant="contained" startIcon={<PrintOutlined />} disabled={!canComplete || !ticketPreview} onClick={() => void transition(true)}>{t("business:ticket.confirm_and_print")}</Button>
      </Box> : undefined}>
      {confirm === "cancel" && <TextInput label={t("business:pos.cancellation_reason")} value={reason} onChange={(event) => setReason(event.target.value)} required disabled={busy} />}
      {confirm === "complete" && <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "minmax(0, 1fr)", minWidth: 0, gap: 2 }}>
        {ticketPreview ? <SaleTicket ticket={ticketPreview} /> : <Alert severity="error">{t("business:ticket.preview_invalid")}</Alert>}
        {draft.catalogConflict && <Alert severity="warning" action={<Button disabled={reviewDisabled} onClick={() => void loadCatalogReview()}>{t("business:stock_tracking.review_cart")}</Button>}>{t("business:stock_tracking.review_required")}</Alert>}
      </Box>}
      {confirm === "refresh" && reviewFailed && <Alert severity="error" action={<Button disabled={reviewDisabled} onClick={() => void loadCatalogReview()}>{t("business:pos.retry")}</Button>}>{t("business:pos.product_unavailable")}</Alert>}
      {confirm === "refresh" && catalogReview && <Box component="ul" sx={{ display: "grid", gap: 1, pl: 2 }}>
        {catalogReview.map((line) => <li key={line.product_id}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>{line.name}</Typography>
          <Typography variant="body2">{currency(line.expected_unit_price)} · {line.stock_available === undefined
            ? t("business:stock_tracking.untracked")
            : t("business:stock_tracking.review_balance", { requested: formatQuantity(line.quantity, i18n.language), stock: formatQuantity(line.stock_available, i18n.language) })}</Typography>
          {line.stock_available !== undefined && exceedsObservedStock(line, line.quantity) && <Typography variant="body2" color="error">{t("business:stock_tracking.insufficient", { stock: formatQuantity(line.stock_available, i18n.language) })}</Typography>}
        </li>)}
      </Box>}
    </ConfirmDialog>
    <ConfirmDialog open={unknown?.stage === "prompt"} onClose={dismissUnknown} onConfirm={() => setMissingBarcode(value => value?.scope === barcodeLookup.scope ? { ...value, stage: "register" } : null)}
      title={t("business:pos.register_product_title")} message={t("business:pos.register_product_description")}
      confirmText={t("business:pos.register_product_confirm")} cancelText={t("business:pos.register_product_decline")}
      additionalActions={<Button variant="outlined" onClick={() => setMissingBarcode(value => value?.scope === barcodeLookup.scope ? { ...value, stage: "assign" } : null)}>{t("business:pos.assign_existing_product")}</Button>}>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap", fontWeight: 600 }}>{unknownBarcode}</Typography>
    </ConfirmDialog>
    {unknown?.stage === "register" && <PosProductRegistration key={`${unknown.scope}:${unknown.id}`} businessId={businessId} barcode={unknown.barcode} onClose={dismissUnknown} onRegistered={addRegisteredProduct} />}
    <ConfirmDialog open={assigning} onClose={() => { if (!busy) setAssignConfirm(false); }} onConfirm={associate} isLoading={updateProduct.isPending} confirmDisabled={!selectedAssignment?.version || busy} title={t("business:pos.assign_barcode")} message={t("business:pos.assign_confirm", { barcode: unknownBarcode, name: selectedAssignment?.name, previous: selectedAssignment?.barcode ?? t("business:pos.no_barcode") })}>{!selectedAssignment && <Alert severity="error">{t("business:pos.product_unavailable")}</Alert>}</ConfirmDialog>
    <ConfirmDialog open={showLeaveDialog} onClose={() => blocker.reset?.()} onConfirm={confirmLeave} confirmDisabled={!canLeave} title={t("business:pos.leave_title")} message={t(canLeave ? "business:pos.leave_message" : draft.storageError ? "business:pos.leave_storage_message" : "business:pos.leave_pending_message")} />
  </Workspace>;
}
