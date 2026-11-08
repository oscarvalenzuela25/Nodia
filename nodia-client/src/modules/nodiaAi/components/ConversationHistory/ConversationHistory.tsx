import { useId, useState } from "react";
import { Alert, Button, Collapse, FormControlLabel, IconButton, LinearProgress, List, ListItemButton, ListItemText, Menu, MenuItem, Switch, Typography } from "@mui/material";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import PushPinOutlined from "@mui/icons-material/PushPinOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { NodiaAiConversation } from "../../infrastructure/types";
import type { ConversationHistoryProps, ConversationAction } from "./types";
import { AdditionalFilters, ConversationRow, Filters, Heading, RowActions } from "./styles";

export default function ConversationHistory(props: ConversationHistoryProps) {
  const { t } = useTranslation("nodiaAi");
  const filtersId = useId();
  const menuId = useId();
  const [menu, setMenu] = useState<{ anchor: HTMLElement; chat: NodiaAiConversation } | null>(null);
  const busy = props.disabled || props.fetching;
  const menuChat = props.items.find(chat => chat.conversation_id === menu?.chat.conversation_id);
  const menuDisabled = busy || !menuChat || menuChat.read_only;
  const act = (action: ConversationAction) => {
    if (!menu || !menuChat || menuDisabled) return;
    props.onAction(menuChat, action, menu.anchor);
    setMenu(null);
  };
  return <>
    <Heading>
      <Typography component="h2" variant="subtitle1">{t("conversations")}</Typography>
      <IconButton aria-label={t(props.filtersExpanded ? "organization.hide_filters" : "organization.show_filters")}
        aria-expanded={props.filtersExpanded} aria-controls={filtersId} onClick={props.onToggleFilters}>
        {props.filtersExpanded ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
      </IconButton>
    </Heading>
    <Filters>
      <InputSearch value={props.filters.search} debounceMs={0} onChange={search => props.onFilters({ ...props.filters, search })}
        ariaLabel={t("organization.search")} placeholder={t("organization.search")} disabled={busy} variant="outlined" searchIconPosition="end" />
      <Collapse in={props.filtersExpanded} id={filtersId} unmountOnExit>
        <AdditionalFilters>
      <SelectSingleInput label={t("organization.archive_filter")} value={props.filters.archive} clearable={false} disabled={busy}
        options={["active", "archived", "all"].map(value => ({ value, label: t(`organization.archive_${value}`) }))}
        onChange={value => { if (value === "active" || value === "archived" || value === "all") props.onFilters({ ...props.filters, archive: value }); }} />
      {props.canViewAll && <SelectSingleInput label={t("organization.view")} value={props.filters.view} clearable={false} disabled={busy}
        options={[{ value: "own", label: t("organization.own") }, { value: "all", label: t("organization.everyone") }]}
        onChange={value => { if (value === "own" || value === "all") props.onFilters({ ...props.filters, view: value }); }} />}
      <FormControlLabel control={<Switch checked={props.filters.pinned} disabled={busy}
        onChange={(_, pinned) => props.onFilters({ ...props.filters, pinned })} />} label={t("organization.only_pinned")} />
        </AdditionalFilters>
      </Collapse>
      {new TextEncoder().encode(props.filters.search.trim()).length > 256 && <Alert severity="warning">{t("organization.search_limit")}</Alert>}
    </Filters>
    {props.fetching && !props.loading && <LinearProgress aria-label={t("refreshing")} />}
    {props.error && <Alert severity="error" action={<Button variant="contained" disabled={busy} onClick={props.onRetry}>{t("retry")}</Button>}>{t("list_error")}</Alert>}
    <Skeleton loading={props.loading}>
      {!props.items.length && !props.error ? <Typography color="text.secondary" sx={{ py: 2 }}>{t("empty_conversations")}</Typography> :
        <List disablePadding aria-label={t("conversations")}>
          {props.items.map(chat => <ConversationRow key={chat.conversation_id} disablePadding active={chat.conversation_id === props.selectedId}>
            <ListItemButton selected={chat.conversation_id === props.selectedId} disabled={busy} onClick={() => props.onSelect(chat.conversation_id)}>
              {chat.is_pinned && <PushPinOutlined fontSize="small" aria-label={t("organization.pinned")} sx={{ mr: 1, flexShrink: 0 }} />}
              <ListItemText primary={chat.title ?? t("untitled")} secondary={props.filters.view === "all" ? t("organization.owner", { id: chat.owner_user_id }) : chat.selection?.model_id ?? t("no_selection")}
                slotProps={{ primary: { sx: { overflowWrap: "anywhere" } }, secondary: { sx: { overflowWrap: "anywhere" } } }} />
            </ListItemButton>
            <RowActions><IconButton aria-label={t("organization.actions", { title: chat.title ?? t("untitled") })} disabled={busy || chat.read_only}
              aria-haspopup="menu" aria-expanded={menu?.chat.conversation_id === chat.conversation_id}
              aria-controls={menu?.chat.conversation_id === chat.conversation_id ? menuId : undefined}
              onClick={event => setMenu({ anchor: event.currentTarget, chat })}><MoreHoriz /></IconButton></RowActions>
          </ConversationRow>)}
        </List>}
    </Skeleton>
    {props.hasMore && <Button variant="contained" fullWidth disabled={busy} onClick={props.onMore}>{t("more_conversations")}</Button>}
    <Menu anchorEl={menuChat ? menu?.anchor : null} open={!!menu && !!menuChat} onClose={() => setMenu(null)} slotProps={{ list: { id: menuId } }}>
      <MenuItem disabled={menuDisabled} onClick={() => act("rename")}>{t("organization.rename")}</MenuItem>
      <MenuItem disabled={menuDisabled} onClick={() => act("pin")}>{t(menuChat?.is_pinned ? "organization.unpin" : "organization.pin")}</MenuItem>
      <MenuItem disabled={menuDisabled} onClick={() => act("archive")}>{t(menuChat?.is_archived ? "organization.unarchive" : "organization.archive")}</MenuItem>
      {props.onPreferences && <MenuItem disabled={menuDisabled} onClick={() => {
        if (!menuChat || menuDisabled) return;
        props.onPreferences?.(menuChat.conversation_id);
        setMenu(null);
      }}>{t("organization.saved_preferences")}</MenuItem>}
    </Menu>
  </>;
}
