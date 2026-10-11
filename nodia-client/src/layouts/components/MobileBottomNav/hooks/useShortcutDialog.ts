import { useEffect, useRef, useState, type ComponentType } from "react";
import { sileo } from "sileo";
import i18n from "../../../../translate";
import type { MobileShortcutDialogProps } from "../../MobileShortcutDialog/types";
import { loadShortcutDialog } from "../loadShortcutDialog";

export default function useShortcutDialog(scope: string, load = loadShortcutDialog) {
  const [Dialog, setDialog] = useState<ComponentType<MobileShortcutDialogProps> | null>(null);
  const [request, setRequest] = useState<{ scope: string; slotIndex: number; failed: boolean } | null>(null);
  const generation = useRef(0);
  const inFlight = useRef<string | null>(null);

  // Navigation, identity changes and unmount cancel opening, never the page's data.
  useEffect(() => () => {
    generation.current += 1;
    inFlight.current = null;
  }, [scope]);

  const open = async (slotIndex: number, onReady: () => void) => {
    if (inFlight.current === scope) return;
    if (Dialog) { onReady(); return; }
    const attempt = ++generation.current;
    inFlight.current = scope;
    setRequest({ scope, slotIndex, failed: false });
    try {
      const module = await load();
      if (attempt !== generation.current) return;
      setDialog(() => module.default);
      setRequest(null);
      onReady();
    } catch {
      if (attempt !== generation.current) return;
      setRequest({ scope, slotIndex, failed: true });
      sileo.error({ title: i18n.t("layout:mobile_nav.editor_load_error") });
    } finally {
      if (attempt === generation.current) inFlight.current = null;
    }
  };

  const current = request?.scope === scope ? request : null;
  return { Dialog, open, loadingSlot: current && !current.failed ? current.slotIndex : null, failed: Boolean(current?.failed) };
}
