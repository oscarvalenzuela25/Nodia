import type { useAttachmentDrafts } from "./hooks/useAttachmentDrafts";
export interface AttachmentPanelProps {
  conversationId: string;
  conversationRevision?: number;
  draft: ReturnType<typeof useAttachmentDrafts>;
  disabled: boolean;
  onRecordingChange: (recording: boolean) => void;
  reviewOnly?: boolean;
}
