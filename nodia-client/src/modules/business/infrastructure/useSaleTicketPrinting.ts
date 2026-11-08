import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import axios from "axios";
import useAuthStore from "../../../store/authStore";
import { notifyHttpError } from "../../../config/httpFeedback";
import { getSale } from "./salesServices";
import { buildSavedSaleTicket } from "./saleTicket";
import { printSaleTicket } from "./printSaleTicket";
import type { Sale } from "./salesTypes";

interface Receipt { scope: string; sale: Sale; businessName?: string; language: string }

/** Printing is separate from checkout: it never persists, retries or reverses a sale. */
export function useSaleTicketPrinting(businessId: string, businessName?: string) {
  const { t, i18n } = useTranslation("business");
  const actorId = useAuthStore((state) => state.user?.id ?? "");
  const sessionVersion = useAuthStore((state) => state.sessionVersion);
  const scope = JSON.stringify([actorId, sessionVersion, businessId]);
  const currentScope = useRef<string | null>(scope);
  const job = useRef<AbortController | null>(null);
  const printDocument = useRef<AbortController | null>(null);
  const [last, setLast] = useState<Receipt | null>(null);
  const [printingScope, setPrintingScope] = useState<string | null>(null);
  useLayoutEffect(() => {
    currentScope.current = scope;
    return () => { currentScope.current = null; job.current?.abort(); printDocument.current?.abort(); job.current = null; printDocument.current = null; };
  }, [scope]);
  const isCurrent = () => currentScope.current === scope && useAuthStore.getState().user?.id === actorId && useAuthStore.getState().sessionVersion === sessionVersion;
  const snapshot = (sale: Sale): Receipt | null => isCurrent() && sale.business_id === businessId && sale.status === "completed"
    ? { scope, sale: structuredClone(sale), businessName, language: i18n.language } : null;
  const remember = (sale: Sale) => { const value = snapshot(sale); if (value) setLast(value); };
  const forget = (saleId: string) => { if (isCurrent()) setLast((previous) => previous?.scope === scope && previous.sale.id === saleId ? null : previous); };
  const requestPrint = async (sale: Sale | undefined, revalidate: boolean, showDetails: boolean) => {
    let value = sale ? snapshot(sale) : last?.scope === scope ? last : null;
    if (!value || !isCurrent() || job.current) return;
    const controller = new AbortController();
    job.current = controller; setPrintingScope(scope); setLast(value);
    try {
      if (revalidate) {
        const current = await getSale(businessId, value.sale.id);
        if (!isCurrent() || controller.signal.aborted) return;
        if (current.id !== value.sale.id || current.business_id !== businessId || current.status !== "completed") {
          forget(value.sale.id); sileo.error({ title: t("business:ticket.print_status_changed") }); return;
        }
        value = { ...value, sale: structuredClone(current) }; setLast(value);
      }
      const ticket = buildSavedSaleTicket({ sale: value.sale, businessName: value.businessName, language: value.language, showDetails });
      await printSaleTicket(ticket, { signal: controller.signal });
      if (isCurrent() && !controller.signal.aborted) {
        // Some browsers return from print() before the preview closes.
        printDocument.current = controller;
        sileo.info({ title: t("business:ticket.print_requested") });
      }
    } catch (error) {
      if (isCurrent() && !controller.signal.aborted) {
        if (axios.isAxiosError(error)) notifyHttpError(error);
        else sileo.error({ title: t("business:ticket.print_failed"), description: t("business:ticket.print_retry_help") });
      }
    } finally {
      if (job.current === controller) { job.current = null; if (isCurrent()) setPrintingScope(null); }
    }
  };
  return { receipt: last?.scope === scope ? last.sale : null, printing: printingScope === scope, remember, forget,
    print: (sale?: Sale, showDetails = true) => requestPrint(sale, true, showDetails),
    printJustSaved: (sale: Sale, showDetails = true) => requestPrint(sale, false, showDetails) };
}
