import { useState } from "react";
import { SvgIcon, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import PriceDivisionDialog, { type PriceDivisionDialogProps } from "./PriceDivisionDialog";
import { DivideButton } from "./styles";

export type PriceDivisionActionProps = Omit<PriceDivisionDialogProps, "open" | "onClose"> & { contextKey?: string };

/** A new editing context discards the old modal rather than applying its stale result. */
export default function PriceDivisionAction(props: PriceDivisionActionProps) {
  return <DivisionAction key={`${props.contextKey ?? ""}:${props.mode}`} {...props} />;
}

function DivisionAction(props: PriceDivisionActionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const title = t("business:price_division.open", { field: props.label });
  return <>
    <Tooltip title={title}><span><DivideButton type="button" aria-label={title} aria-haspopup="dialog" aria-expanded={open}
      disabled={props.disabled} onClick={() => setOpen(true)}>
      <SvgIcon fontSize="small"><path d="M5 11h14v2H5z" /><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="19" r="1.5" /></SvgIcon>
    </DivideButton></span></Tooltip>
    <PriceDivisionDialog {...props} open={open} onClose={() => setOpen(false)} />
  </>;
}
