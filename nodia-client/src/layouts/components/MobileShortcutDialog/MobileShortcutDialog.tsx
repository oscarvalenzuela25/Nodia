import { useState } from "react";
import { Alert, Box, Button, List, ListItemButton, ListItemIcon, ListItemText, Stack, Typography } from "@mui/material";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import { useTranslation } from "react-i18next";
import InputSearch from "../../../components/inputs/InputSearch";
import { getModuleIcon } from "../../../store/generalSettings/moduleIcons";
import { shortcutIdentity } from "../../../store/mobileNavigationStore";
import type { ShortcutReference } from "../../../store/mobileNavigationStore";
import type { ShortcutOption } from "../MobileBottomNav/types";
import { ShortcutSheet } from "./styles";

type Props = {
  slotIndex: number; current: ShortcutReference | null; occupied: string[]; options: ShortcutOption[];
  busy: boolean; contextError: boolean; loading: boolean; onRetry: () => void;
  onClose: () => void; onSave: (reference: ShortcutReference | null) => boolean;
};
export default function MobileShortcutDialog({ slotIndex, current, occupied, options, busy, contextError, loading, onRetry, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(current ? shortcutIdentity(current) : "");
  const [search, setSearch] = useState("");
  const [saveError, setSaveError] = useState(false);
  const choice = options.find(option => option.identity === selected && !occupied.includes(option.identity));
  const visible = options.filter(option => option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const save = (reference: ShortcutReference | null) => {
    if (busy) return;
    if (onSave(reference)) onClose(); else setSaveError(true);
  };
  return <ShortcutSheet open onClose={onClose} title={t(current ? "layout:mobile_nav.change" : "layout:mobile_nav.add")}
    subtitle={t(`layout:mobile_nav.slot_${slotIndex}`)} actions={<Stack sx={{ flexDirection: "row", gap: 1, width: "100%" }}>
      <Button sx={{ flex: 1 }} disabled={busy || !current} onClick={() => save(null)}>{t("layout:mobile_nav.remove")}</Button>
      <Button sx={{ flex: 1 }} variant="contained" disabled={busy || !choice} onClick={() => choice && save(choice.reference)}>{t("core:save")}</Button>
    </Stack>}>
    <Stack spacing={2}>
      {saveError && <Alert severity="error">{t("layout:mobile_nav.storage_error")}</Alert>}
      {contextError && <Alert severity="error" action={<Button color="inherit" disabled={loading} onClick={onRetry}>{t("core:retry")}</Button>}>{t("core:auth_context_error_message")}</Alert>}
      {loading && <Typography role="status">{t("layout:mobile_nav.loading")}</Typography>}
      <InputSearch value={search} onChange={setSearch} placeholder={t("layout:mobile_nav.search")} disabled={busy} fullWidth />
      {!loading && !contextError && !visible.length && <Typography role="status">{t(options.length ? "layout:mobile_nav.no_matches" : "layout:mobile_nav.empty")}</Typography>}
      <List aria-label={t("layout:mobile_nav.sections")} role="radiogroup" disablePadding onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[role=radio]:not(:disabled)"));
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        if (index < 0 || !buttons.length) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
          (index + (["ArrowUp", "ArrowLeft"].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next].focus(); buttons[next].click();
      }}>
        {visible.map(option => <ListItemButton key={option.identity} component="button" type="button" role="radio"
          aria-checked={selected === option.identity} selected={selected === option.identity} disabled={busy || occupied.includes(option.identity)}
          sx={{ width: "100%", borderRadius: 2, minHeight: 52, mb: 1, border: "1px solid", borderColor: "divider" }} onClick={() => setSelected(option.identity)}>
          <ListItemIcon>{getModuleIcon(option.reference.moduleKey, option.icon)}</ListItemIcon>
          <ListItemText primary={option.label} secondary={occupied.includes(option.identity) ? t("layout:mobile_nav.already_added") : undefined} />
          {selected === option.identity && <Box sx={{ display: "flex" }}><CheckOutlined color="primary" /></Box>}
        </ListItemButton>)}
      </List>
    </Stack>
  </ShortcutSheet>;
}
