import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { Alert, Button, IconButton, LinearProgress, Typography } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import RequestRecovery from "../RequestRecovery";
import type { AdaptivePanelProps } from "./types";
import { useRetainedPanelFocus } from "./useRetainedPanelFocus";
import { AdaptiveDrawer, DrawerHeader, PanelTabs } from "./styles";
import { adaptivePanelKeys, loadAdaptivePanel, type AdaptivePanelKey as PanelKey } from "./loadAdaptivePanel";

type Loaded = Partial<Record<PanelKey, ComponentType<AdaptivePanelProps>>>;
type Props = Omit<AdaptivePanelProps, "visible"> & { open: boolean; onClose: () => void };

/** Load secondary workspaces only by intent; hide instead of discarding drafts. */
export default function AdaptiveWorkspace(props: Props) {
  return <WorkspaceDrawer key={props.session.id} {...props} />;
}

function WorkspaceDrawer({ open, onClose, ...props }: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const [active, setActive] = useState<PanelKey | null>(null);
  const panelFocus = useRetainedPanelFocus(open ? active : null);
  const [loaded, setLoaded] = useState<Loaded>({});
  const [failed, setFailed] = useState<PanelKey | null>(null);
  const [loading, setLoading] = useState<PanelKey | null>(null);
  const intent = useRef(0);
  useEffect(() => () => { ++intent.current; }, []);
  const locked = props.command.isPending || Boolean(props.command.uncertain);
  const busy = props.busy || locked;
  const openPanel = async (key: PanelKey) => {
    const turn = ++intent.current;
    setActive(key);
    if (loaded[key]) { setLoading(null); setFailed(null); return; }
    setLoading(key); setFailed(null);
    try {
      const Component = await loadAdaptivePanel(key);
      if (turn === intent.current) setLoaded(current => ({ ...current, [key]: Component }));
    } catch {
      if (turn === intent.current) {
        setFailed(key);
        sileo.error({ title: t("teacher:adaptive.load_failed") });
      }
    }
    finally { if (turn === intent.current) setLoading(null); }
  };
  return <AdaptiveDrawer anchor="right" open={open} onClose={() => { if (!locked) onClose(); }}
    slotProps={{
      root: { keepMounted: true },
      paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId },
      transition: {
        appear: true,
        onEnter: () => { void openPanel("sources"); },
        onEntered: node => {
          if (document.activeElement === node || document.activeElement === document.body) {
            panelFocus.returnToTrigger();
            panelFocus.restoreEditor();
          }
        },
        onExit: () => { ++intent.current; setLoading(null); setActive(null); },
      },
    }}>
    <DrawerHeader>
      <Typography id={titleId} variant="h6" component="h2">{t("teacher:adaptive.workspace")}</Typography>
      <IconButton aria-label={t("core:close")} disabled={locked} onClick={onClose}><CloseOutlined /></IconButton>
    </DrawerHeader>
    {props.command.uncertain && <RequestRecovery command={props.command} onRecovered={props.onResult} />}
    <PanelTabs>
      {adaptivePanelKeys.map(key => <Button key={key} ref={node => panelFocus.setTrigger(key, node)} variant={active === key ? "contained" : "outlined"} disabled={busy || loading === key} aria-expanded={active === key} aria-controls={`teacher-adaptive-${props.session.id}-${key}`} onClick={() => void openPanel(key)}>{t(`teacher:adaptive.tabs.${key}`)}</Button>)}
    </PanelTabs>
    {loading && <LinearProgress aria-label={t("core:loading_route")} />}
    {failed && active === failed && <Alert severity="error" action={<Button variant="outlined" disabled={busy || loading !== null} onClick={() => void openPanel(failed)}>{t("teacher:adaptive.retry")}</Button>}>{t("teacher:adaptive.load_failed")}</Alert>}
    {(Object.entries(loaded) as [PanelKey, ComponentType<AdaptivePanelProps>][]).map(([key, Component]) => <div key={key} id={`teacher-adaptive-${props.session.id}-${key}`} hidden={!open || active !== key} onFocusCapture={event => panelFocus.remember(key, event)} onBlurCapture={event => panelFocus.remember(key, event)}><Component {...props} busy={busy} visible={open && active === key} /></div>)}
  </AdaptiveDrawer>;
}
