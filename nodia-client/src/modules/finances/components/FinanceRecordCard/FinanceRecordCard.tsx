import type { ReactNode } from "react";
import { Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import MobileRecordCard from "../../../../components/MobileRecordCard";
import type { MobileCardAction } from "../../../../components/MobileRecordCard/MobileRecordCard";
import type { FinanceRowActions } from "../FinanceTable/FinanceTable";

export interface FinanceCardField {
  key: string;
  label: string;
  value: ReactNode;
  fullWidth?: boolean;
}
export default function FinanceRecordCard({
  record,
  fields,
  actions,
}: {
  record: { name: string; is_active: boolean };
  fields: FinanceCardField[];
  actions: FinanceRowActions;
}) {
  const { t } = useTranslation();
  const items: MobileCardAction[] = [
    {
      key: "edit",
      label: t("finance:update"),
      icon: <EditOutlinedIcon color="primary" />,
      onClick: actions.onEdit,
    },
    {
      key: "toggle",
      label: t(record.is_active ? "finance:deactivate" : "finance:activate"),
      icon: record.is_active ? (
        <BlockOutlinedIcon color="error" />
      ) : (
        <CheckCircleOutlineOutlinedIcon color="success" />
      ),
      onClick: actions.onToggle,
    },
  ];
  if (actions.onPayment)
    items.push({
      key: "payment",
      label: t("finance:register_payment"),
      icon: <PaymentsOutlinedIcon color="primary" />,
      onClick: actions.onPayment,
      disabled: actions.paymentDisabled,
    });
  if (actions.onDelete)
    items.push({
      key: "delete",
      label: t("finance:delete"),
      icon: <DeleteOutlineIcon color="error" />,
      onClick: actions.onDelete,
      color: "error",
    });
  return (
    <MobileRecordCard
      title={record.name}
      status={
        <Chip
          size="small"
          color={record.is_active ? "success" : "default"}
          label={t(record.is_active ? "finance:active" : "finance:inactive")}
        />
      }
      fields={fields}
      actions={items}
      disabled={actions.disabled}
    />
  );
}
