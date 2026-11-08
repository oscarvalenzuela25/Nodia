import { useId } from "react";
import { Box, Typography } from "@mui/material";
import AddRounded from "@mui/icons-material/AddRounded";
import RemoveRounded from "@mui/icons-material/RemoveRounded";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../../../../components/inputs/TextInput";
import { MAX_SALE_QUANTITY, quantityFromInput } from "../../../../../infrastructure/salesPolicies";
import { quantityThousandths } from "../../../../../infrastructure/saleQuantities";
import { ControlRow, InputArea, StepButton, Stepper } from "./styles";

export interface QuantityStepperProps {
  name: string;
  quantity: number;
  inputValue?: string;
  disabled: boolean;
  onInputChange: (raw: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  incrementDisabled?: boolean;
  decrementDisabled?: boolean;
}

export default function QuantityStepper({ name, quantity, inputValue, disabled, onInputChange, onIncrement, onDecrement, incrementDisabled = false, decrementDisabled = false }: QuantityStepperProps) {
  const { t } = useTranslation("business");
  const id = useId();
  const descriptionId = `${id}-product`;
  const raw = inputValue ?? String(quantity);
  const invalid = quantityFromInput(raw) === null;
  const invalidQuantity = quantityThousandths(quantity) === null;
  const blocked = disabled || invalidQuantity;
  return <Stepper role="group" aria-label={t("business:pos.quantity_for", { name })}>
    <Typography component="label" htmlFor={id} variant="body2" sx={{ fontWeight: 600 }}>{t("business:pos.quantity")}</Typography>
    <Box component="span" id={descriptionId} sx={visuallyHidden}>{name}</Box>
    <ControlRow>
      <StepButton type="button" variant="outlined" aria-label={t("business:pos.decrease_quantity", { name })} disabled={blocked || decrementDisabled || quantity === 0} onClick={onDecrement}><RemoveRounded /></StepButton>
      <InputArea><TextInput id={id} type="text" inputMode="decimal" value={raw} disabled={blocked} error={invalid}
        aria-describedby={descriptionId} onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const next = event.target.value;
          onInputChange(next === "." ? "0." : next === "," ? "0," : next);
        }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); } }} /></InputArea>
      <StepButton type="button" variant="contained" aria-label={t("business:pos.increase_quantity", { name })} disabled={blocked || incrementDisabled || quantity + 1 > MAX_SALE_QUANTITY} onClick={onIncrement}><AddRounded /></StepButton>
    </ControlRow>
  </Stepper>;
}
