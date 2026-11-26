import { useId, useState, type ReactNode, type RefObject } from "react";
import { Box, IconButton, Typography } from "@mui/material";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import ExpandLessOutlined from "@mui/icons-material/ExpandLessOutlined";
import ExpandMoreOutlined from "@mui/icons-material/ExpandMoreOutlined";
import SelectSingleInput from "../inputs/SelectSingleInput";
import type { SelectSingleInputProps } from "../inputs/SelectSingleInput/types";
import { SelectionBar, SelectionPanel, SelectionPopover, SelectionSummary, Selector, SummaryContent } from "./styles";

export interface ComposerSelectionField extends SelectSingleInputProps {
  field: "connection" | "mode" | "model" | "effort";
}

interface Props {
  summaryRef: RefObject<HTMLButtonElement | null>;
  title: string;
  triggerLabel: string;
  closeLabel: string;
  appliedLabel: string;
  appliedModel: string;
  appliedMode: string;
  appliedDetails: string;
  appliedIdentity?: string;
  busy: boolean;
  locked: boolean;
  fields: ComposerSelectionField[];
  notices: ReactNode;
  hasNotices: boolean;
  actions: ReactNode;
}

export default function ComposerSelectionPopover({
  summaryRef, title, triggerLabel, closeLabel, appliedLabel, appliedModel, appliedMode, appliedDetails,
  appliedIdentity, busy, locked, fields, notices, hasNotices, actions,
}: Props) {
  const panelId = useId();
  const [opened, setOpened] = useState(false);
  const [visited, setVisited] = useState(false);
  if (locked && opened) setOpened(false);
  const closePanel = () => {
    if (!busy) setOpened(false);
  };
  return (
    <SelectionPanel>
      <SelectionSummary ref={summaryRef} type="button" variant="text" disabled={busy || locked}
        aria-label={triggerLabel} aria-expanded={opened} aria-controls={visited ? panelId : undefined} aria-haspopup="dialog"
        aria-describedby={`${panelId}-applied`}
        title={[appliedModel, appliedDetails, appliedIdentity].filter(Boolean).join("\n")}
        endIcon={opened ? <ExpandLessOutlined /> : <ExpandMoreOutlined />}
        onClick={() => {
          if (opened) closePanel();
          else { setVisited(true); setOpened(true); }
        }}>
        <SummaryContent>
          <span id={`${panelId}-applied`} data-selection-description>{appliedLabel}: {appliedModel} · {appliedDetails}</span>
          <Typography component="span" variant="body2" sx={{ fontWeight: 600 }}>{appliedModel}</Typography>
          <Typography component="span" variant="caption" color="text.secondary">{appliedMode}</Typography>
        </SummaryContent>
      </SelectionSummary>
      {!opened && notices}
      {visited && (
        <SelectionPopover open={opened} anchorEl={() => summaryRef.current} keepMounted
          anchorOrigin={{ vertical: "top", horizontal: "left" }} transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          marginThreshold={16} onClose={closePanel}
          slotProps={{ paper: { id: panelId, role: "dialog", "aria-modal": true, "aria-labelledby": `${panelId}-title` } }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
              <Typography component="h2" variant="subtitle2" id={`${panelId}-title`}>{title}</Typography>
              <Typography variant="caption" color="text.secondary">{appliedLabel}: {appliedModel} · {appliedDetails}</Typography>
            </Box>
          <IconButton type="button" aria-label={closeLabel} disabled={busy || locked} onClick={closePanel}
              sx={{ width: 44, height: 44, flexShrink: 0 }}><CloseOutlined /></IconButton>
          </Box>
          {opened && <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: hasNotices ? 1 : 0 }}>{notices}</Box>}
          <SelectionBar aria-label={title}>
            {fields.map(({ field, ...props }) => (
              <Selector key={field}><SelectSingleInput {...props} /></Selector>
            ))}
            {actions}
          </SelectionBar>
        </SelectionPopover>
      )}
    </SelectionPanel>
  );
}
