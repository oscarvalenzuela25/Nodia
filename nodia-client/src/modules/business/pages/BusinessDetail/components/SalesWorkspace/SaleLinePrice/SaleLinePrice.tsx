import { useEffect, useId, useRef, useState } from "react";
import { Tooltip } from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../../../../components/inputs/TextInput";
import { cartLinePrice, moneyInteger } from "../../../../../infrastructure/salesPolicies";
import type { CartLine } from "../../../../../infrastructure/salesTypes";
import { measurementUnit } from "../../../../../infrastructure/measurementUnits";
import { PRODUCT_PRICE_MAX } from "../../ProductsTab/components/ProductModal/productPricing";
import ProductPrice from "../ProductPrice";
import { PriceAction, PriceActions, PriceDisplay, PriceEditor, PriceLabel } from "./styles";

interface Props {
  line: CartLine;
  disabled: boolean;
  onSave?: (id: string, value: string, permanent: boolean) => Promise<boolean>;
  onEditingChange?: (editing: boolean) => void;
}
export default function SaleLinePrice({ line, disabled, onSave, onEditingChange }: Props) {
  const { t } = useTranslation(["business", "core"]);
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  const editingCallback = useRef(onEditingChange);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  useEffect(() => { editingCallback.current = onEditingChange; }, [onEditingChange]);
  useEffect(() => () => {
    if (editingRef.current) {
      editingRef.current = false;
      editingCallback.current?.(false);
    }
  }, []);
  const changeEditing = (next: boolean) => {
    if (editingRef.current === next) return;
    editingRef.current = next;
    setEditing(next);
    onEditingChange?.(next);
  };
  const canonical = moneyInteger(value);
  const valid = canonical !== null && BigInt(canonical) <= 9223372036854775807n;
  const save = async (permanent: boolean) => {
    if (!onSave || disabled || savingRef.current || !valid) return;
    savingRef.current = true; setSaving(true);
    try { if (await onSave(line.product_id, value, permanent)) changeEditing(false); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return editing ? <PriceEditor>
    <PriceLabel htmlFor={inputId}>{t("business:pos.price_value")}</PriceLabel>
    <TextInput id={inputId} value={value} autoFocus disabled={disabled || saving}
      onChange={(event) => setValue(event.target.value)} error={!valid} inputMode="numeric" />
    <PriceActions>
      <Tooltip title={t("business:pos.price_for_sale")}><span><PriceAction color="primary" aria-label={t("business:pos.price_for_sale")} disabled={disabled || saving || !valid} onClick={() => void save(false)}><CheckOutlined /></PriceAction></span></Tooltip>
      <Tooltip title={t("business:pos.price_permanent")}><span><PriceAction color="primary" aria-label={t("business:pos.price_permanent")} disabled={disabled || saving || !valid || BigInt(canonical ?? "0") > BigInt(PRODUCT_PRICE_MAX)} onClick={() => void save(true)}><SaveOutlined /></PriceAction></span></Tooltip>
      <Tooltip title={t("core:cancel")}><span><PriceAction aria-label={t("core:cancel")} disabled={disabled || saving} onClick={() => changeEditing(false)}><CloseOutlined /></PriceAction></span></Tooltip>
    </PriceActions>
  </PriceEditor> : <PriceDisplay>
      <ProductPrice price={cartLinePrice(line)} regularPrice={line.regular_price} onOffer={line.unit_price_override == null && line.price_source === "offer"} measurementUnit={measurementUnit(line.measurement_unit)} />
      {onSave && <Tooltip title={t("business:pos.edit_price")}><span><PriceAction aria-label={`${t("business:pos.edit_price")} ${line.name}`} disabled={disabled} onClick={() => { setValue(cartLinePrice(line)); changeEditing(true); }}><EditOutlined fontSize="small" /></PriceAction></span></Tooltip>}
  </PriceDisplay>;
}
