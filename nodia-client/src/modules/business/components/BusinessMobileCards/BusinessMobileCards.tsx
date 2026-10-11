import { Box, Chip } from "@mui/material";
import { useTranslation } from "react-i18next";
import EditOutlined from "@mui/icons-material/EditOutlined";
import BlockOutlined from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import ContactsOutlined from "@mui/icons-material/ContactsOutlined";
import VisibilityOutlined from "@mui/icons-material/VisibilityOutlined";
import ContentCopyOutlined from "@mui/icons-material/ContentCopyOutlined";
import HistoryOutlined from "@mui/icons-material/HistoryOutlined";
import MobileRecordCard from "../../../../components/MobileRecordCard";
import type { MobileCardAction } from "../../../../components/MobileRecordCard/MobileRecordCard";
import type {
  ProviderEntity,
  ProductEntity,
  ProductLogEntity,
  InvoiceEntity,
} from "../../infrastructure/types";
import { calculatePriceDiff } from "../../pages/BusinessDetail/components/ProductsTab/helpers";

function Status({ active }: { active: boolean }) {
  const { t } = useTranslation("business");
  return (
    <Chip
      size="small"
      color={active ? "success" : "default"}
      label={t(active ? "status_active" : "status_inactive")}
    />
  );
}
function useRecordActions<T extends { is_active: boolean }>(
  record: T,
  onEdit: (record: T) => void,
  onToggle: (record: T) => void,
): MobileCardAction[] {
  const { t } = useTranslation("business");
  return [
    {
      key: "edit",
      label: t("action_update"),
      icon: <EditOutlined />,
      onClick: () => onEdit(record),
    },
    {
      key: "toggle",
      label: t(record.is_active ? "action_deactivate" : "action_activate"),
      icon: record.is_active ? (
        <BlockOutlined color="error" />
      ) : (
        <CheckCircleOutlined color="success" />
      ),
      onClick: () => onToggle(record),
    },
  ];
}
export function ProviderMobileCard({
  provider,
  disabled,
  onEdit,
  onToggle,
  onContacts,
}: {
  provider: ProviderEntity;
  disabled: boolean;
  onEdit: (provider: ProviderEntity) => void;
  onToggle: (provider: ProviderEntity) => void;
  onContacts: (provider: ProviderEntity) => void;
}) {
  const { t } = useTranslation("business");
  const actions = useRecordActions(provider, onEdit, onToggle);
  const mapping = [
    "code",
    "cost_price",
    "cost_price_tax",
    "packages",
    "units_per_package",
  ] as const;
  return (
    <MobileRecordCard
      title={provider.name}
      status={<Status active={provider.is_active} />}
      disabled={disabled}
      fields={[
        { key: "id", label: t("provider_id"), value: provider.id },
        { key: "tax", label: t("provider_tax"), value: `${provider.tax}%` },
        ...mapping.map((key) => {
          const entry = provider.fields?.[key];
          const value =
            typeof entry === "string"
              ? entry
              : entry &&
                  typeof entry === "object" &&
                  "value" in entry &&
                  typeof entry.value === "string"
                ? entry.value
                : "";
          const instructions =
            entry &&
            typeof entry === "object" &&
            "instructions" in entry &&
            typeof entry.instructions === "string"
              ? entry.instructions
              : undefined;
          return {
            key,
            label: t(`provider_col_${key}`),
            value: (
              <>
                {value || t("no_info")}
                {instructions && (
                  <Box
                    component="span"
                    sx={{
                      display: "block",
                      color: "text.secondary",
                      fontSize: "0.75rem",
                    }}
                  >
                    {t("mapping_field_instructions_label")}: {instructions}
                  </Box>
                )}
              </>
            ),
          };
        }),
      ]}
      actions={actions}
      primaryAction={{
        key: "contacts",
        label: t("provider_contacts:contacts"),
        icon: <ContactsOutlined />,
        onClick: () => onContacts(provider),
      }}
    />
  );
}
export function InvoiceMobileCard({
  invoice,
  disabled,
  formatDate,
  onPreview,
  onCopy,
  onEdit,
  onToggle,
}: {
  invoice: InvoiceEntity;
  disabled: boolean;
  formatDate: (date?: string) => string;
  onPreview: (invoice: InvoiceEntity) => void;
  onCopy: (path?: string) => void;
  onEdit?: (invoice: InvoiceEntity) => void;
  onToggle?: (invoice: InvoiceEntity) => void;
}) {
  const { t } = useTranslation("business");
  const actions: MobileCardAction[] = [];
  if (invoice.path_storage)
    actions.push({
      key: "copy",
      label: t("invoice_copy_path_tooltip"),
      icon: <ContentCopyOutlined />,
      onClick: () => onCopy(invoice.path_storage),
    });
  if (onEdit)
    actions.push({
      key: "edit",
      label: t("action_update"),
      icon: <EditOutlined />,
      onClick: () => onEdit(invoice),
    });
  if (onToggle)
    actions.push({
      key: "toggle",
      label: t(invoice.is_active ? "action_deactivate" : "action_activate"),
      icon: invoice.is_active ? (
        <BlockOutlined color="error" />
      ) : (
        <CheckCircleOutlined color="success" />
      ),
      onClick: () => onToggle(invoice),
    });
  return (
    <MobileRecordCard
      title={invoice.code}
      status={<Status active={invoice.is_active} />}
      disabled={disabled}
      fields={[
        {
          key: "provider",
          label: t("invoice_provider"),
          value: invoice.provider?.name ?? "—",
        },
        {
          key: "total",
          label: t("invoice_total"),
          value: `$${Number(invoice.total_amount).toLocaleString()}`,
        },
        {
          key: "date",
          label: t("invoice_issue_date_col"),
          value: formatDate(invoice.data?.issue_date || invoice.created_at),
        },
        {
          key: "path",
          label: t("invoice_path"),
          value: invoice.path_storage || "—",
        },
      ]}
      actions={actions}
      primaryAction={
        invoice.path_storage
          ? {
              key: "preview",
              label: t("invoice_view_file_tooltip"),
              icon: <VisibilityOutlined />,
              onClick: () => onPreview(invoice),
            }
          : undefined
      }
    />
  );
}
export function ProductMobileCard({
  product,
  historical,
  expanded,
  disabled,
  formatDate,
  onExpand,
  onEdit,
  onToggle,
}: {
  product: ProductEntity;
  historical?: ProductLogEntity | null;
  expanded: boolean;
  disabled: boolean;
  formatDate: (date?: string) => string;
  onExpand: () => void;
  onEdit: (product: ProductEntity) => void;
  onToggle: (product: ProductEntity) => void;
}) {
  const { t } = useTranslation("business");
  const actions = useRecordActions(product, onEdit, onToggle);
  const diff = calculatePriceDiff(product.sale_price, historical?.sale_price);
  const fields = (item: ProductEntity | ProductLogEntity) => [
    { key: "code", label: t("product_code"), value: item.code },
    {
      key: "cost",
      label: t("product_cost_tax"),
      value: `$${Number(item.cost_price_tax).toLocaleString()}`,
    },
    {
      key: "margin",
      label: t("product_profit_margin"),
      value: `${item.profit_percentage}%`,
    },
    {
      key: "price",
      label: t("product_sale_price"),
      value: `$${Number(item.sale_price).toLocaleString()}`,
    },
    { key: "stock", label: t("product_stock"), value: item.stock },
    {
      key: "updated",
      label: t("product_updated_at"),
      value: formatDate(item.updated_at || item.created_at),
    },
  ];
  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <MobileRecordCard
        title={product.name}
        status={<Status active={product.is_active} />}
        disabled={disabled}
        fields={[
          ...fields(product),
          {
            key: "provider",
            label: t("product_provider"),
            value: product.provider?.name ?? "—",
          },
          ...(diff
            ? [
                {
                  key: "change",
                  label: t(
                    diff.isIncrease
                      ? "price_change_increased"
                      : "price_change_decreased",
                  ),
                  value: `${diff.isIncrease ? "+" : "−"}${diff.percent}%`,
                },
              ]
            : []),
        ]}
        actions={actions}
        primaryAction={
          historical
            ? {
                key: "history",
                label: t(
                  expanded
                    ? "collapse_historical_tooltip"
                    : "expand_historical_tooltip",
                ),
                icon: <HistoryOutlined />,
                onClick: onExpand,
              }
            : undefined
        }
      />
      {expanded && historical && (
        <MobileRecordCard
          title={`${t("historical_badge")} · ${historical.name}`}
          fields={fields(historical)}
        />
      )}
    </Box>
  );
}
