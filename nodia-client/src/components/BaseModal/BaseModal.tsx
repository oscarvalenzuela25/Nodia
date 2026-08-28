import type { FC } from "react";
import { useId } from "react";
import { IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { BaseModalProps } from "./types";
import {
  StyledDialog,
  ModalHeader,
  HeaderContent,
  ModalTitle,
  ModalSubtitle,
  ModalContent,
  ModalActions,
} from "./styles";

const BaseModal: FC<BaseModalProps> = ({
  open,
  onClose,
  title,
  subtitle,
  size = "sm",
  children,
  actions,
  showCloseButton = true,
  disableEscapeKeyDown = false,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const generatedTitleId = useId();
  const generatedDescId = useId();

  const titleId = ariaLabelledBy ?? (title ? generatedTitleId : undefined);
  const descId = ariaDescribedBy ?? (subtitle ? generatedDescId : undefined);

  const handleDialogClose = (
    _event: object,
    reason: "backdropClick" | "escapeKeyDown"
  ) => {
    if (disableEscapeKeyDown && reason === "escapeKeyDown") {
      return;
    }
    onClose();
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
      <ModalHeader>
        <HeaderContent>
          <ModalTitle id={titleId}>{title}</ModalTitle>
          {subtitle && <ModalSubtitle id={descId}>{subtitle}</ModalSubtitle>}
        </HeaderContent>
        {showCloseButton && (
          <IconButton
            aria-label="close"
            onClick={onClose}
            size="small"
            sx={(theme) => ({
              color: theme.palette.text.secondary,
              transition: theme.transitions.create(["color", "background-color"], {
                duration: theme.transitions.duration.shorter,
              }),
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
      </ModalHeader>

      <ModalContent>{children}</ModalContent>

      {actions && <ModalActions>{actions}</ModalActions>}
    </StyledDialog>
  );
};

export default BaseModal;
