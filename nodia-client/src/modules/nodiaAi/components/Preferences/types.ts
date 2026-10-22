export interface PreferencesProps {
  open: boolean;
  conversationId: string | null;
  disabled: boolean;
  onClose: () => void;
}
