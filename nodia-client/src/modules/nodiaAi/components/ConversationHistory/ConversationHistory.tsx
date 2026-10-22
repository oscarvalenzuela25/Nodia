import { useState } from "react";
import { Alert, Button, Checkbox, FormControlLabel, IconButton, LinearProgress, List, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import PushPinOutlined from "@mui/icons-material/PushPinOutlined";
import { Skeleton } from "boneyard-js/react";
import { useTranslation } from "react-i18next";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import type { NodiaAiConversation } from "../../infrastructure/types";
import type { ConversationHistoryProps, ConversationAction } from "./types";
import { Filters, RowActions } from "./styles";

export default function ConversationHistory(props: ConversationHistoryProps) {
  const { t } = useTranslation("nodiaAi");
  const [menu, setMenu] = useState<{ anchor: HTMLElement; chat: NodiaAiConversation } | null>(null);
  const busy = props.disabled || props.fetching;
  const act = (action: ConversationAction) => {
    if (!menu || busy || menu.chat.read_only) return;
    props.onAction(menu.chat, action, menu.anchor);
    setMenu(null);
  };
  return <>
    <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>{t("conversations")}</Typography>
    <Filters>
      <InputSearch value={props.filters.search} debounceMs={0} onChange={search => props.onFilters({ ...props.filters, search })}
        ariaLabel={t("organization.search")} placeholder={t("organization.search")} disabled={busy} variant="outlined" />
      <SelectSingleInput label={t("organization.archive_filter")} value={props.filters.archive} clearable={false} disabled={busy}
        options={["active", "archived", "all"].map(value => ({ value, label: t(`organization.archive_${value}`) }))}
        onChange={value => { if (value === "active" || value === "archived" || value === "all") props.onFilters({ ...props.filters, archive: value }); }} />
      {props.canViewAll && <SelectSingleInput label={t("organization.view")} value={props.filters.view} clearable={false} disabled={busy}
        options={[{ value: "own", label: t("organization.own") }, { value: "all", label: t("organization.everyone") }]}
        onChange={value => { if (value === "own" || value === "all") props.onFilters({ ...props.filters, view: value }); }} />}
      <FormControlLabel control={<Checkbox checked={props.filters.pinned} disabled={busy}
        onChange={(_, pinned) => props.onFilters({ ...props.filters, pinned })} />} label={t("organization.only_pinned")} />
      {new TextEncoder().encode(props.filters.search.trim()).length > 256 && <Alert severity="warning">{t("organization.search_limit")}</Alert>}
    </Filters>
    {props.fetching && !props.loading && <LinearProgress aria-label={t("refreshing")} />}
    {props.error && <Alert severity="error" action={<Button disabled={busy} onClick={props.onRetry}>{t("retry")}</Button>}>{t("list_error")}</Alert>}
    <Skeleton loading={props.loading}>
      {!props.items.length && !props.error ? <Typography color="text.secondary" sx={{ py: 2 }}>{t("empty_conversations")}</Typography> :
        <List disablePadding aria-label={t("conversations")}>
          {props.items.map(chat => <ListItem key={chat.conversation_id} disablePadding sx={{ minWidth: 0 }}>
            <ListItemButton selected={chat.conversation_id === props.selectedId} disabled={busy} onClick={() => props.onSelect(chat.conversation_id)} sx={{ borderRadius: 2, minHeight: 48, minWidth: 0 }}>
              {chat.is_pinned && <PushPinOutlined fontSize="small" aria-label={t("organization.pinned")} sx={{ mr: 1, flexShrink: 0 }} />}
              <ListItemText primary={chat.title ?? t("untitled")} secondary={props.filters.view === "all" ? t("organization.owner", { id: chat.owner_user_id }) : chat.selection?.model_id ?? t("no_selection")}
                slotProps={{ primary: { sx: { overflowWrap: "anywhere" } }, secondary: { sx: { overflowWrap: "anywhere" } } }} />
            </ListItemButton>
            <RowActions><IconButton aria-label={t("organization.actions", { title: chat.title ?? t("untitled") })} disabled={busy || chat.read_only}
              aria-haspopup="menu" onClick={event => setMenu({ anchor: event.currentTarget, chat })} sx={{ minHeight: 44, minWidth: 44 }}><MoreHoriz /></IconButton></RowActions>
          </ListItem>)}
        </List>}
    </Skeleton>
    {props.hasMore && <Button fullWidth disabled={busy} onClick={props.onMore}>{t("more_conversations")}</Button>}
    <Menu anchorEl={menu?.anchor} open={!!menu} onClose={() => setMenu(null)}>
      <MenuItem disabled={busy} onClick={() => act("rename")}>{t("organization.rename")}</MenuItem>
      <MenuItem disabled={busy} onClick={() => act("pin")}>{t(menu?.chat.is_pinned ? "organization.unpin" : "organization.pin")}</MenuItem>
      <MenuItem disabled={busy} onClick={() => act("archive")}>{t(menu?.chat.is_archived ? "organization.unarchive" : "organization.archive")}</MenuItem>
    </Menu>
  </>;
}
