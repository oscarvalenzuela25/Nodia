import { useEffect, useRef } from "react";
import { useBlocker } from "react-router";
import { sileo } from "sileo";
import { useTranslation } from "react-i18next";
import type { SaleSection } from "./salesTypes";

export function leavesPointOfSale(section: SaleSection, current: { pathname: string }, next: { pathname: string; search: string }): boolean {
  return section === "pos" && (next.pathname !== current.pathname || new URLSearchParams(next.search).get("section") !== "pos");
}

/** A local cart can be discarded only before any uncertain commercial intention exists. */
export function useSaleExitGuard({ section, hasUnsaved, canDiscard, clearForExit }: {
  section: SaleSection; hasUnsaved: boolean; canDiscard: boolean; clearForExit: () => boolean;
}) {
  const { t } = useTranslation("business");
  const exiting = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => leavesPointOfSale(section, currentLocation, nextLocation));
  useEffect(() => {
    if (blocker.state !== "blocked") { exiting.current = false; return; }
    if (hasUnsaved || !canDiscard || exiting.current) return;
    exiting.current = true;
    if (clearForExit()) blocker.proceed?.();
    else { exiting.current = false; sileo.error({ title: t("business:pos.storage_error") }); }
  }, [blocker, hasUnsaved, canDiscard, clearForExit, t]);
  const confirmLeave = () => {
    if (blocker.state !== "blocked" || !canDiscard || exiting.current) return;
    exiting.current = true;
    if (clearForExit()) { sileo.success({ title: t("business:pos.local_sales_discarded") }); blocker.proceed?.(); }
    else { exiting.current = false; sileo.error({ title: t("business:pos.storage_error") }); }
  };
  return { blocker, confirmLeave, showDialog: blocker.state === "blocked" && (hasUnsaved || !canDiscard) };
}
