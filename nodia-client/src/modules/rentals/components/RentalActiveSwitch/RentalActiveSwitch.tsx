import { useTranslation } from "react-i18next";
import { useState } from "react";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import { StyledFormControlLabel, StyledSwitch, SwitchWrapper } from "./styles";
export default function RentalActiveSwitch({
  checked,
  onChange,
  disabled,
  label,
  confirmChanges = false,
  confirmationMessage,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  confirmChanges?: boolean;
  confirmationMessage?: string;
}) {
  const { t } = useTranslation();
  const [proposed, setProposed] = useState<boolean>();
  return (
    <SwitchWrapper>
      <StyledFormControlLabel
        labelPlacement="start"
        label={label ?? t("rental:active")}
        control={
          <StyledSwitch
            checked={checked}
            onChange={(event) => {
              if (confirmChanges) setProposed(event.target.checked);
              else onChange(event.target.checked);
            }}
            disabled={disabled}
          />
        }
      />
      <ConfirmDialog
        open={proposed !== undefined}
        title={t(proposed ? "rental:activate" : "rental:deactivate")}
        message={confirmationMessage ?? t("rental:visibility_confirm")}
        confirmDisabled={disabled}
        onClose={() => setProposed(undefined)}
        onConfirm={() => {
          if (proposed !== undefined && !disabled) onChange(proposed);
          setProposed(undefined);
        }}
      />
    </SwitchWrapper>
  );
}
