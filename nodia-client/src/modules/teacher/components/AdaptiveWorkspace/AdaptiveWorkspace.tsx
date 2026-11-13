import { useEffect, useRef, useState, type ComponentType } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { AdaptivePanelProps } from "./types";
import { useRetainedPanelFocus } from "./useRetainedPanelFocus";

const loaders = {
  evidence: () => import("./LearningPanel"),
  review: () => import("./ReviewPanel"),
  sources: () => import("./SourcesPanel"),
  activities: () => import("./ActivitiesPanel"),
  concepts: () => import("./ConceptsPanel"),
  clarifications: () => import("./ClarificationPanel"),
} as const;
type PanelKey = keyof typeof loaders;
type Loaded = Partial<Record<PanelKey, ComponentType<AdaptivePanelProps>>>;

/** Load secondary workspaces only by intent; hide instead of discarding drafts. */
export default function AdaptiveWorkspace(props: Omit<AdaptivePanelProps, "visible">) {
  const { t } = useTranslation();
  const [active, setActive] = useState<PanelKey | null>(null);
  const panelFocus = useRetainedPanelFocus(active);
  const [loaded, setLoaded] = useState<Loaded>({});
  const [failed, setFailed] = useState<PanelKey | null>(null);
  const [loading, setLoading] = useState<PanelKey | null>(null);
  const intent = useRef(0);
  useEffect(() => () => { ++intent.current; }, []);
  const open = async (key: PanelKey) => {
    const turn = ++intent.current;
    setActive(key);
    if (loaded[key]) { setLoading(null); setFailed(null); return; }
    setLoading(key); setFailed(null);
    try {
      const module = await loaders[key]();
      if (turn === intent.current) setLoaded(current => ({ ...current, [key]: module.default }));
    } catch { if (turn === intent.current) setFailed(key); }
    finally { if (turn === intent.current) setLoading(null); }
  };
  return <Stack sx={{ gap: 2, minWidth: 0 }}>
    <Typography variant="h6" component="h2">{t("teacher:adaptive.workspace")}</Typography>
    <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, flexWrap: "wrap" }}>
      {(Object.keys(loaders) as PanelKey[]).map(key => <Button key={key} ref={node => panelFocus.setTrigger(key, node)} variant={active === key ? "contained" : "outlined"} disabled={props.busy || loading === key} aria-expanded={active === key} aria-controls={`teacher-adaptive-${props.session.id}-${key}`} onClick={() => void open(key)}>{t(`teacher:adaptive.tabs.${key}`)}</Button>)}
      {active && <Button variant="outlined" onClick={() => { ++intent.current; setLoading(null); panelFocus.returnToTrigger(); setActive(null); }}>{t("teacher:adaptive.hide")}</Button>}
    </Stack>
    {failed && active === failed && <Alert severity="error" action={<Button variant="outlined" disabled={loading !== null} onClick={() => void open(failed)}>{t("teacher:adaptive.retry")}</Button>}>{t("teacher:adaptive.load_failed")}</Alert>}
    {(Object.entries(loaded) as [PanelKey, ComponentType<AdaptivePanelProps>][]).map(([key, Component]) => <div key={key} id={`teacher-adaptive-${props.session.id}-${key}`} hidden={active !== key} onFocusCapture={event => panelFocus.remember(key, event)} onBlurCapture={event => panelFocus.remember(key, event)}><Component {...props} visible={active === key} /></div>)}
  </Stack>;
}
