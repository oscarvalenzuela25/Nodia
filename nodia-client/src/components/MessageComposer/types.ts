import type { ClipboardEventHandler, ReactNode } from "react";
import type { SxProps, Theme } from "@mui/material/styles";

export interface MessageComposerProps {
  scopeKey: string;
  text: string;
  onTextChange: (text: string) => void;
  onSend: () => void;
  maxBytes: number;
  /** UTF-16 code units, matching the field contract; never silently truncates. */
  maxLength?: number;
  label: string;
  placeholder: string;
  sendLabel: string;
  ariaLabel?: string;
  disabled?: boolean;
  sendDisabled?: boolean;
  inputDisabled?: boolean;
  /** Optional separate voice gate, e.g. while explicit send recovery is available. */
  voiceDisabled?: boolean;
  submitOnEnter?: boolean;
  textTooLarge?: boolean;
  onRecordingChange?: (recording: boolean) => void;
  onPaste?: ClipboardEventHandler<HTMLDivElement>;
  beforeInput?: ReactNode;
  toolbarStart?: ReactNode;
  footer?: ReactNode;
  sx?: SxProps<Theme>;
}
