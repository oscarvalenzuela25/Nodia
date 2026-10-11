import type { ShortcutReference } from "../../../store/mobileNavigationStore";
import type { ShortcutOption } from "../MobileBottomNav/types";

export type MobileShortcutDialogProps = {
  slotIndex: number; current: ShortcutReference | null; occupied: string[]; options: ShortcutOption[];
  busy: boolean; contextError: boolean; loading: boolean; onRetry: () => void;
  onClose: () => void; onSave: (reference: ShortcutReference | null) => boolean;
};
