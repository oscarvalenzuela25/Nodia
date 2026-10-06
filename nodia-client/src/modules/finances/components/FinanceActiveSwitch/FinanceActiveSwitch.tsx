import { useTranslation } from "react-i18next";
import { SwitchWrapper, StyledFormControlLabel, StyledSwitch } from "./styles";

type Props = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
};

export default function FinanceActiveSwitch({
  value,
  onChange,
  disabled,
}: Props) {
  const { t } = useTranslation();
  return (
    <SwitchWrapper>
      <StyledFormControlLabel
        labelPlacement="start"
        label={t("finance:active")}
        control={
          <StyledSwitch
            checked={value}
            onChange={(event) => onChange(event.target.checked)}
            disabled={disabled}
          />
        }
      />
    </SwitchWrapper>
  );
}
