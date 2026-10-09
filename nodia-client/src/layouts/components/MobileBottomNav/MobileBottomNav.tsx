import { useState, useSyncExternalStore } from "react";
import { GlobalStyles, Typography } from "@mui/material";
import HomeOutlined from "@mui/icons-material/HomeOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import EditOutlined from "@mui/icons-material/EditOutlined";
import LockOutlined from "@mui/icons-material/LockOutlined";
import LockOpenOutlined from "@mui/icons-material/LockOpenOutlined";
import LinkOffOutlined from "@mui/icons-material/LinkOffOutlined";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import useAuth from "../../../hooks/useAuth";
import useAuthStore, { hasActiveSession } from "../../../store/authStore";
import { useAuthorizationContext } from "../../../services/authorizationService";
import useGeneralSettingsStore from "../../../store/generalSettings/generalSettingsStore";
import { useVisibleModules, getModuleIcon } from "../../../store/generalSettings";
import { shortcutIdentity } from "../../../store/mobileNavigationStore";
import type { ShortcutReference } from "../../../store/mobileNavigationStore";
import MobileShortcutDialog from "../MobileShortcutDialog";
import { buildShortcutCatalog } from "./catalog";
import useMobileNavigation from "./hooks/useMobileNavigation";
import { Dock, EditBadge, HomeLink, LockButton, MOBILE_NAV_RESERVED_HEIGHT, NavRoot, RoundButton, RoundLink, Slot, SlotLabel } from "./styles";

const keyboardSnapshot = () => Boolean(window.visualViewport && window.innerHeight - window.visualViewport.height > 120 &&
  document.activeElement?.matches("input, textarea, select, [contenteditable=true]"));
const subscribeKeyboard = (notify: () => void) => {
  window.visualViewport?.addEventListener("resize", notify);
  document.addEventListener("focusin", notify); document.addEventListener("focusout", notify);
  return () => { window.visualViewport?.removeEventListener("resize", notify); document.removeEventListener("focusin", notify); document.removeEventListener("focusout", notify); };
};
export default function MobileBottomNav() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const context = useAuthorizationContext({ enabled: auth.isSessionActive });
  const isLoaded = useGeneralSettingsStore(state => state.isLoaded);
  const groups = useVisibleModules();
  const catalog = buildShortcutCatalog(groups, i18n.language);
  const { ownerId, sessionVersion, preferences, ready, hydrated, readError, persist } = useMobileNavigation();
  const location = useLocation();
  const [editing, setEditing] = useState<{ slotIndex: number; ownerId: string; sessionVersion: number } | null>(null);
  const keyboardOpen = useSyncExternalStore(subscribeKeyboard, keyboardSnapshot, () => false);
  const busy = !ready || !isLoaded || context.isFetching || context.isError;
  const currentEditing = editing && editing.ownerId === ownerId && editing.sessionVersion === sessionVersion ? editing.slotIndex : null;
  const openEditor = (slotIndex: number) => { if (ready && !context.isFetching && ownerId) setEditing({ slotIndex, ownerId, sessionVersion }); };
  const save = (reference: ShortcutReference | null) => {
    const currentAuth = useAuthStore.getState();
    if (busy || currentEditing === null || !hasActiveSession(currentAuth) || currentAuth.sessionVersion !== sessionVersion) return false;
    const liveCatalog = buildShortcutCatalog(useGeneralSettingsStore.getState().modules, i18n.language);
    if (reference && !liveCatalog.some(option => option.identity === shortcutIdentity(reference))) return false;
    const slots = [...preferences.slots] as typeof preferences.slots;
    slots[currentEditing] = reference;
    return persist({ ...preferences, slots }, reference ? "layout:mobile_nav.saved" : "layout:mobile_nav.removed");
  };
  const renderSlot = (slotIndex: number) => {
    const reference = hydrated ? preferences.slots[slotIndex] : null;
    const option = reference && catalog.find(item => item.identity === shortcutIdentity(reference));
    const locked = hydrated && preferences.locked;
    if (!reference && locked) return <Slot key={slotIndex} aria-hidden="true" />;
    const label = reference ? option?.label ?? t("layout:mobile_nav.unavailable") : t("layout:mobile_nav.add_short");
    const icon = reference ? option ? getModuleIcon(option.reference.moduleKey, option.icon) : <LinkOffOutlined /> : <AddOutlined />;
    const active = Boolean(option && (location.pathname === option.path || location.pathname.startsWith(`${option.path}/`)));
    return <Slot key={slotIndex}>
      {locked && option && !busy ? <RoundLink to={option.path} data-configured="true" aria-label={t("layout:mobile_nav.go", { section: option.label })} aria-current={active ? "page" : undefined}>{icon}</RoundLink> :
        <RoundButton disabled={!ready || context.isFetching || locked} data-configured={Boolean(option)} data-empty={!reference} aria-label={locked ? t("layout:mobile_nav.unavailable") : t(reference ? "layout:mobile_nav.edit_slot" : "layout:mobile_nav.add_slot", { position: t(`layout:mobile_nav.slot_${slotIndex}`), section: option?.label ?? label })}
          onClick={() => openEditor(slotIndex)}>{icon}{reference && !locked && <EditBadge aria-hidden="true"><EditOutlined /></EditBadge>}</RoundButton>}
      <SlotLabel>{label}</SlotLabel>
    </Slot>;
  };
  return <>
    <GlobalStyles styles={theme => ({ [theme.breakpoints.down("sm")]: {
      "[data-sileo-viewport][data-position^=bottom]": { bottom: `calc(${theme.spacing(2)} + ${MOBILE_NAV_RESERVED_HEIGHT})` },
    } })} />
    <NavRoot sx={keyboardOpen ? { display: "none" } : undefined} data-testid="mobile-bottom-nav">
      <Typography variant="caption" sx={{ position: "absolute", top: 18, left: 16, maxWidth: "calc(100% - 80px)", color: readError ? "error.main" : "text.secondary", bgcolor: "background.default", borderRadius: 1, px: .5 }}>
        {t(readError ? "layout:mobile_nav.storage_error_short" : context.isError ? "layout:mobile_nav.permission_error" : busy ? "layout:mobile_nav.loading" : preferences.locked ? "layout:mobile_nav.locked" : "layout:mobile_nav.editing")}
      </Typography>
      <LockButton disabled={!ready || context.isFetching} aria-label={t(preferences.locked ? "layout:mobile_nav.unlock" : "layout:mobile_nav.lock")}
        aria-pressed={ready && preferences.locked} onClick={() => persist({ ...preferences, locked: !preferences.locked }, preferences.locked ? "layout:mobile_nav.unlocked_success" : "layout:mobile_nav.locked_success")}>
        {ready && preferences.locked ? <LockOutlined /> : <LockOpenOutlined />}
      </LockButton>
      <Dock aria-label={t("layout:mobile_nav.navigation")}>
        {renderSlot(0)}{renderSlot(1)}
        <Slot><HomeLink to="/" aria-label={t("layout:mobile_nav.home")} aria-current={location.pathname === "/" ? "page" : undefined}><HomeOutlined /></HomeLink><SlotLabel sx={{ color: "primary.main", fontWeight: 600 }}>{t("layout:menu_home")}</SlotLabel></Slot>
        {renderSlot(2)}{renderSlot(3)}
      </Dock>
    </NavRoot>
    {currentEditing !== null && <MobileShortcutDialog key={`${ownerId}:${sessionVersion}:${currentEditing}`} slotIndex={currentEditing}
      current={preferences.slots[currentEditing]} occupied={preferences.slots.flatMap((reference, slotIndex) => reference && slotIndex !== currentEditing ? [shortcutIdentity(reference)] : [])}
      options={catalog} busy={busy} contextError={context.isError} loading={context.isFetching || !isLoaded && !context.isError}
      onRetry={() => { void context.refetch(); }} onSave={save} onClose={() => setEditing(null)} />}
  </>;
}
