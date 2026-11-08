import { useEffect, useId, useState, type ComponentType } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { notifyHttpError } from "../../../../config/httpFeedback";
import { loadPreferences } from "./loadPreferences";
import { Content, Header, PreferencesDrawer } from "./styles";
import type { PreferencesProps } from "./types";

export default function PreferencesLoader(props: PreferencesProps) {
  const { t } = useTranslation("nodiaAi");
  const titleId = useId();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ Panel?: ComponentType<PreferencesProps>; failed: boolean }>({ failed: false });
  useEffect(() => {
    if (!props.open || state.Panel) return;
    let current = true;
    void loadPreferences().then(module => { if (current) setState({ Panel: module.default, failed: false }); })
      .catch((error: unknown) => { if (current) { setState({ failed: true }); notifyHttpError(error); } });
    return () => { current = false; };
  }, [props.open, attempt, state.Panel]);
  if (state.Panel) return <state.Panel {...props} />;
  return <PreferencesDrawer anchor="right" open={props.open} onClose={props.onClose} slotProps={{ paper: { role: "dialog", "aria-modal": true, "aria-labelledby": titleId } }}>
    <Header><Typography id={titleId} component="h2" variant="h6">{t("preferences.title")}</Typography><Button variant="contained" onClick={props.onClose}>{t("close")}</Button></Header>
    <Content>{state.failed ? <Alert severity="error" action={<Button variant="contained" onClick={() => { setState({ failed: false }); setAttempt(value => value + 1); }}>{t("retry")}</Button>}>{t("preferences.chunk_error")}</Alert> : <Typography role="status">{t("preferences.loading")}</Typography>}</Content>
  </PreferencesDrawer>;
}
