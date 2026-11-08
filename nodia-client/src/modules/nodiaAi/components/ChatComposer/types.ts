import type { ReactNode } from "react";
import type { AttachmentPanelProps } from "../Attachments/types";

export interface ChatComposerProps {
  conversationId: string;
  conversationRevision: number;
  text: string;
  onTextChange: (text: string) => void;
  draft: AttachmentPanelProps["draft"];
  disabled: boolean;
  sendDisabled: boolean;
  recovering: boolean;
  textTooLarge: boolean;
  onSend: () => void;
  onRecordingChange: (recording: boolean) => void;
  footer: ReactNode;
}
