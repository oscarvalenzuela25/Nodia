import type { ReactNode } from "react";

export type ConfirmDialogSize = "xs" | "sm" | "md" | "lg";

export type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  title: ReactNode;
  message?: ReactNode;
  children?: ReactNode;
  confirmText?: ReactNode;
  cancelText?: ReactNode;
  isLoading?: boolean;
  size?: ConfirmDialogSize;
  showCloseButton?: boolean;
  disableEscapeKeyDown?: boolean;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};
