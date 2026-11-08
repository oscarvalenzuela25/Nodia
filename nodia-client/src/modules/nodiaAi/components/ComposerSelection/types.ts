import type { ConfigurationDrawerProps } from "../ConfigurationDrawer/types";

export type ComposerSelectionProps = Omit<ConfigurationDrawerProps,
  "open" | "onClose" | "routingEnabled" | "canManageConnection"
> & {
  /** Incomplete edits are also dirty and must block admission of the old selection. */
  onDirtyChange: (dirty: boolean) => void;
};
