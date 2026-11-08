import type { FC } from "react";
import { Tooltip } from "@mui/material";
import ArrowUpwardOutlinedIcon from "@mui/icons-material/ArrowUpwardOutlined";
import ArrowDownwardOutlinedIcon from "@mui/icons-material/ArrowDownwardOutlined";
import { useTranslation } from "react-i18next";
import { OrderButton, Controls, TooltipTarget } from "./styles";

type Neighbor = { id: string; sort_order: number };
type Props = {
  label: string;
  ordering?: { previous: Neighbor | null; next: Neighbor | null };
  disabled?: boolean;
  pending?: boolean;
  onMove: (direction: "up" | "down") => void;
};

const OrderControls: FC<Props> = ({ label, ordering, disabled = false, pending = false, onMove }) => {
  const { t } = useTranslation("modules");
  return (
    <Controls role="group" aria-label={t("modules:ordering.controls", { name: label })} aria-busy={pending}>
      {(["up", "down"] as const).map((direction) => {
        const name = t(`modules:ordering.${direction}`, { name: label });
        const neighbor = direction === "up" ? ordering?.previous : ordering?.next;
        return (
          <Tooltip key={direction} title={ordering ? name : t("modules:ordering.missing_metadata")}>
            <TooltipTarget>
              <OrderButton
                aria-label={name}
                disabled={disabled || pending || !neighbor}
                onClick={() => onMove(direction)}
              >
                {direction === "up" ? <ArrowUpwardOutlinedIcon fontSize="small" /> : <ArrowDownwardOutlinedIcon fontSize="small" />}
              </OrderButton>
            </TooltipTarget>
          </Tooltip>
        );
      })}
    </Controls>
  );
};

export default OrderControls;
