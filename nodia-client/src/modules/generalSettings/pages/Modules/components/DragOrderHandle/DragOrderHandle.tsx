import DragIndicatorOutlinedIcon from "@mui/icons-material/DragIndicatorOutlined";
import { useTranslation } from "react-i18next";
import { HandleButton } from "./styles";
import type { DragHandleBindings, DragOrderItem } from "./types";

type Props = {
  item: DragOrderItem;
  disabled: boolean;
  dragging?: boolean;
  bindings: DragHandleBindings;
};

export default function DragOrderHandle({ item, disabled, dragging, bindings }: Props) {
  const { t } = useTranslation("modules");
  return (
    <HandleButton {...bindings} disabled={disabled}
      aria-label={t("ordering.drag_handle", { name: item.label })}
      aria-description={t("ordering.drag_hint")}
      sx={dragging ? { cursor: "grabbing", color: "primary.main" } : undefined}>
      <DragIndicatorOutlinedIcon />
    </HandleButton>
  );
}
