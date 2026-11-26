import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Tooltip, Typography } from "@mui/material";
import EditOutlined from "@mui/icons-material/EditOutlined";
import CheckOutlined from "@mui/icons-material/CheckOutlined";
import SaveOutlined from "@mui/icons-material/SaveOutlined";
import { visuallyHidden } from "@mui/utils";
import { useTranslation } from "react-i18next";
import TextInput from "../../../../../../../components/inputs/TextInput";
import { cartLinePrice, moneyInteger } from "../../../../../infrastructure/salesPolicies";
import type { CartLine } from "../../../../../infrastructure/salesTypes";
import { measurementUnit } from "../../../../../infrastructure/measurementUnits";
import { PRODUCT_PRICE_MAX } from "../../ProductsTab/components/ProductModal/productPricing";
import ProductPrice from "../ProductPrice";
import { EditPriceAction, PriceActions, PriceDisplay, PriceEditor, PriceSaveAction } from "./styles";

interface Props {
  line: CartLine;
  disabled: boolean;
  onSave?: (id: string, value: string, permanent: boolean) => Promise<boolean>;
  onEditingChange?: (editing: boolean) => void;
}
export default function SaleLinePrice({ line, disabled, onSave, onEditingChange }: Props) {
  const { t } = useTranslation(["business", "core"]);
  const inputId = useId();
  const editTrigger = useRef<HTMLButtonElement>(null);
  const restoreTriggerFocus = useRef(false);
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
  useLayoutEffect(() => {
    if (!editing && restoreTriggerFocus.current) {
      restoreTriggerFocus.current = false;
      editTrigger.current?.focus({ preventScroll: true });
    }
  }, [editing]);
  const changeEditing = (next: boolean) => {
    if (editingRef.current === next) return;
    editingRef.current = next;
    restoreTriggerFocus.current = !next;
    setEditing(next);
    onEditingChange?.(next);
  };
  const canonical = moneyInteger(value);
  const valid = canonical !== null && BigInt(canonical) <= 9223372036854775807n;
  const blocked = disabled || saving;
  const saleDescriptionId = `${inputId}-this-sale`;
  const catalogDescriptionId = `${inputId}-catalog`;
  const save = async (permanent: boolean) => {
    if (!onSave || disabled || savingRef.current || !valid) return;
    savingRef.current = true; setSaving(true);
    try { if (await onSave(line.product_id, value, permanent)) changeEditing(false); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return editing ? <PriceEditor aria-busy={saving} onKeyDown={(event) => {
    if (event.key !== "Escape" || event.nativeEvent.isComposing || disabled || savingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    changeEditing(false);
  }}>
    <TextInput id={inputId} label={t("business:pos.price_value")} value={value} autoFocus disabled={blocked}
      onChange={(event) => setValue(event.target.value)} error={!valid} inputMode="numeric" />
    <PriceActions>
      <PriceSaveAction type="button" variant="contained" startIcon={<CheckOutlined />} aria-describedby={saleDescriptionId}
        disabled={blocked || !valid} onClick={() => void save(false)}>{t("business:pos.price_apply_to_sale")}</PriceSaveAction>
      <PriceSaveAction type="button" variant="outlined" startIcon={<SaveOutlined />} aria-describedby={catalogDescriptionId}
        disabled={blocked || !valid || BigInt(canonical ?? "0") > BigInt(PRODUCT_PRICE_MAX)} onClick={() => void save(true)}>{t("business:pos.price_save_to_catalog")}</PriceSaveAction>
      <PriceSaveAction type="button" variant="text" color="inherit" disabled={blocked} onClick={() => changeEditing(false)}>{t("core:cancel")}</PriceSaveAction>
    </PriceActions>
    <Typography id={saleDescriptionId} sx={visuallyHidden}>{t("business:pos.price_for_sale")}</Typography>
    <Typography id={catalogDescriptionId} variant="caption" color="text.secondary"
      sx={line.price_source === "offer" ? { gridColumn: "1 / -1" } : visuallyHidden}>{t("business:pos.price_permanent")}</Typography>
  </PriceEditor> : <PriceDisplay>
      <ProductPrice price={cartLinePrice(line)} regularPrice={line.regular_price} onOffer={line.unit_price_override == null && line.price_source === "offer"} measurementUnit={measurementUnit(line.measurement_unit)} />
      {onSave && <Tooltip title={t("business:pos.edit_price")}><span><EditPriceAction ref={editTrigger} aria-label={`${t("business:pos.edit_price")} ${line.name}`} disabled={disabled} onClick={() => { setValue(cartLinePrice(line)); changeEditing(true); }}><EditOutlined fontSize="small" /></EditPriceAction></span></Tooltip>}
  </PriceDisplay>;
}
