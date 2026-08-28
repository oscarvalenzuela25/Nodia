import type { ReactNode } from "react";

export type BaseModalSize = "xs" | "sm" | "md" | "lg" | "xl";

export type BaseModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: BaseModalSize;
  children: ReactNode;
  actions?: ReactNode;
  showCloseButton?: boolean;
  disableEscapeKeyDown?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};
