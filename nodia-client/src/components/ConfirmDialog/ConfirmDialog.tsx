import type { FC } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { ConfirmDialogProps } from "./types";
import {
  StyledDialog,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogActionsContainer,
  CancelButton,
  ConfirmButton,
} from "./styles";

export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  children,
  confirmText,
  cancelText,
  isLoading = false,
  size = "sm",
  showCloseButton = true,
  disableEscapeKeyDown = false,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  void disableEscapeKeyDown;
  const { t } = useTranslation();
  const generatedTitleId = useId();
  const generatedDescId = useId();

  const titleId = ariaLabelledBy ?? (title ? generatedTitleId : undefined);
  const descId = ariaDescribedBy ?? (message ? generatedDescId : undefined);

  const handleDialogClose = (
    _event: object,
    reason: "backdropClick" | "escapeKeyDown"
  ) => {
    if (isLoading) return;
    if (reason === "backdropClick" || reason === "escapeKeyDown") {
      return;
    }
    onClose();
  };

  const handleCancel = () => {
    if (isLoading) return;
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  const handleConfirm = () => {
    if (isLoading) return;
    onConfirm();
  };

  return (
    <StyledDialog
      open={open}
      onClose={handleDialogClose}
      modalSize={size}
      aria-labelledby={titleId}
      aria-describedby={descId}
      slotProps={{
        paper: {
          elevation: 0,
        },
      }}
    >
      <DialogHeader>
        <DialogTitle id={titleId}>{title}</DialogTitle>
        {showCloseButton && (
          <IconButton
            aria-label={t("core:close")}
            onClick={onClose}
            disabled={isLoading}
            size="small"
            sx={(theme) => ({
              color: theme.palette.text.secondary,
              transition: theme.transitions.create(
                ["color", "background-color"],
                {
                  duration: theme.transitions.duration.shorter,
                }
              ),
              "&:hover": {
                color: theme.palette.text.primary,
                backgroundColor:
                  theme.palette.mode === "dark"
                    ? "rgba(255, 255, 255, 0.08)"
                    : "rgba(0, 0, 0, 0.06)",
              },
            })}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </DialogHeader>

      {(message || children) && (
        <DialogBody id={descId}>
          {message}
          {children}
        </DialogBody>
      )}

      <DialogActionsContainer>
        <CancelButton
          variant="contained"
          onClick={handleCancel}
          disabled={isLoading}
        >
          {cancelText ?? t("core:cancel")}
        </CancelButton>
        <ConfirmButton
          variant="contained"
          onClick={handleConfirm}
          disabled={isLoading}
        >
          {confirmText ?? t("core:confirm")}
        </ConfirmButton>
      </DialogActionsContainer>
    </StyledDialog>
  );
};

export default ConfirmDialog;
