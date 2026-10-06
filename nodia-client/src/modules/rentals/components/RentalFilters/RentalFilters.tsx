import { useState } from "react";
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import TextInput from "../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../components/inputs/SelectSingleInput";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import RentalRemoteSelect from "../RentalRemoteSelect";
import { ackSchema, idSchema } from "../../infrastructure/schemas";
import type {
  RentalListResource,
  RentalProperty,
  RentalQuery,
} from "../../types";
import { isCivilDate } from "../../utils/dates";
import { ActiveFilters, Fields, FilterBar } from "./styles";

const rentalHasActive = (resource: RentalListResource) =>
  [
    "properties",
    "collaborators",
    "cancellation-policies",
    "reservations",
    "blocks",
  ].includes(resource);
function initialRentalFilters(resource: RentalListResource): RentalQuery {
  return rentalHasActive(resource) ? { active: "active" } : {};
}
export type RentalFiltersProps = {
  resource: RentalListResource;
  property: RentalProperty;
  query: RentalQuery;
  onApply: (query: RentalQuery) => void;
  disabled?: boolean;
};
export default function RentalFilters({
  resource,
  property,
  query,
  onApply,
  disabled = false,
}: RentalFiltersProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<RentalQuery>(query);
  const options = (values: readonly string[], prefix = "") =>
    values.map((value) => ({ value, label: t(`rental:${prefix}${value}`) }));
  const active = rentalHasActive(resource);
  const civil = ["reservations", "payments", "expenses", "turnovers"].includes(
    resource,
  );
  const instant = resource === "blocks" || resource === "audit-events";
  const start: "starts_at" | "from_at" | "from_on" =
    resource === "blocks"
      ? "starts_at"
      : resource === "audit-events"
        ? "from_at"
        : "from_on";
  const end: "ends_at" | "to_at" | "to_on" =
    resource === "blocks"
      ? "ends_at"
      : resource === "audit-events"
        ? "to_at"
        : "to_on";
  const from = draft[start],
    to = draft[end];
  let valid = true;
  if (from || to) {
    valid = Boolean(from && to);
    if (from && to)
      valid = civil
        ? isCivilDate(from) &&
          isCivilDate(to) &&
          from < to &&
          (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
            86400000 <=
            366
        : /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(from) &&
          /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(to) &&
          Number.isFinite(Date.parse(from)) &&
          Number.isFinite(Date.parse(to)) &&
          Date.parse(from) < Date.parse(to);
  }
  if (draft.resource_id && !idSchema.safeParse(draft.resource_id).success)
    valid = false;
  const change = (
    name: keyof RentalQuery,
    value: RentalQuery[keyof RentalQuery],
  ) => setDraft((current) => ({ ...current, [name]: value }));
  const select = (
    name:
      | "active"
      | "status"
      | "type"
      | "cleaning_status"
      | "linen_ready"
      | "resource_type",
    values: readonly string[],
    prefix = "",
  ) => (
    <SelectSingleInput
      key={name}
      label={t(`rental:${name}`)}
      value={typeof draft[name] === "string" ? draft[name]! : null}
      options={options(values, prefix)}
      onChange={(value) => change(name, value ?? undefined)}
      disabled={disabled}
      fullWidth
    />
  );
  const filterNames = Object.keys(query).filter(
    (name) =>
      !["page", "limit", "q", "search"].includes(name) &&
      query[name as keyof RentalQuery] !== undefined &&
      !(name === "active" && query.active === "all"),
  );
  const chips = filterNames.flatMap((name) => {
    const value = query[name as keyof RentalQuery];
    const entries = Array.isArray(value) ? value : [String(value)];
    return entries.map((entry) => ({
      name,
      entry,
      label:
        name === "active"
          ? t(`rental:${entry}`)
          : `${t(`rental:${name}`)}: ${["status", "type", "cleaning_status", "linen_ready", "resource_type"].includes(name) ? t(`rental:${name === "cleaning_status" ? "cleaning_" : name === "resource_type" ? "resource_" : ""}${entry}`) : name === "status_in" ? t(`rental:status_${entry}`) : name === "channel_in" ? t(`rental:channel_${entry}`) : entry}`,
    }));
  });
  const remove = (name: string, entry: string) => {
    const next = { ...query, page: 1 };
    if (name === "active") next.active = "all";
    else if (name === start || name === end) {
      delete next[start];
      delete next[end];
    } else if (name === "status_in")
      next.status_in = next.status_in?.filter((value) => value !== entry);
    else if (name === "channel_in")
      next.channel_in = next.channel_in?.filter((value) => value !== entry);
    else delete next[name as keyof RentalQuery];
    onApply(next);
  };
  return (
    <FilterBar>
      <Filter
        disabled={disabled}
        applyDisabled={!valid}
        activeCount={chips.length}
        onOpen={() => setDraft(structuredClone(query))}
        onFilter={() => {
          if (valid) onApply({ ...draft, page: 1 });
        }}
        onClear={() =>
          onApply({
            ...initialRentalFilters(resource),
            page: 1,
            limit: query.limit,
            q: query.q,
          })
        }
      >
        <Fields>
          {active && select("active", ["active", "inactive", "all"])}
          {resource === "reservations" && (
            <>
              <SelectMultipleInput
                label={t("rental:status")}
                value={draft.status_in ?? []}
                options={options(
                  [
                    "draft",
                    "confirmed",
                    "in_progress",
                    "completed",
                    "cancelled",
                  ],
                  "status_",
                )}
                onChange={(value) =>
                  change("status_in", value as RentalQuery["status_in"])
                }
                disabled={disabled}
                fullWidth
              />
              <SelectMultipleInput
                label={t("rental:channel")}
                value={draft.channel_in ?? []}
                options={options(
                  ["whatsapp", "airbnb", "facebook", "other"],
                  "channel_",
                )}
                onChange={(value) =>
                  change("channel_in", value as RentalQuery["channel_in"])
                }
                disabled={disabled}
                fullWidth
              />
            </>
          )}
          {resource === "payments" && (
            <>
              {select("type", ["payment", "refund"])}
              {select("status", ["confirmed", "voided"])}
            </>
          )}
          {resource === "expenses" && (
            <>
              {select("status", ["pending", "paid", "voided"])}
              <TextInput
                label={t("rental:category")}
                value={draft.category ?? ""}
                onChange={(event) =>
                  change("category", event.target.value || undefined)
                }
                disabled={disabled}
              />
            </>
          )}
          {["payments", "expenses"].includes(resource) && (
            <RentalRemoteSelect
              resource="reservations"
              propertyId={property.id}
              query={{ active: "all" }}
              label={t("rental:reservation")}
              value={draft.reservation_id ?? null}
              onChange={(value) => change("reservation_id", value ?? undefined)}
              disabled={disabled}
            />
          )}
          {resource === "turnovers" && (
            <>
              {select(
                "cleaning_status",
                ["pending", "in_progress", "completed"],
                "cleaning_",
              )}
              {select("linen_ready", ["true", "false", "unknown"])}
              <RentalRemoteSelect
                resource="reservations"
                propertyId={property.id}
                query={{ active: "all" }}
                label={t("rental:incoming_reservation_id")}
                value={draft.incoming_reservation_id ?? null}
                onChange={(value) =>
                  change("incoming_reservation_id", value ?? undefined)
                }
                disabled={disabled}
              />
            </>
          )}
          {resource === "audit-events" && (
            <>
              {select(
                "resource_type",
                [
                  "property",
                  "collaborator",
                  "policy",
                  "reservation",
                  "payment",
                  "expense",
                  "block",
                  "turnover",
                ],
                "resource_",
              )}
              <TextInput
                label={t("rental:resource_id")}
                value={draft.resource_id ?? ""}
                onChange={(event) =>
                  change("resource_id", event.target.value || undefined)
                }
                disabled={disabled}
              />
              <SelectSingleInput
                label={t("rental:audit_action")}
                value={draft.action ?? null}
                options={ackSchema.shape.operation.options.map((value) => ({
                  value,
                  label: t(`rental:audit_actions.${value.replace(".", "_")}`),
                }))}
                onChange={(value) => change("action", value ?? undefined)}
                disabled={disabled}
                fullWidth
              />
            </>
          )}
          {(civil || instant) && (
            <>
              {[start, end].map((name) => (
                <TextInput
                  key={name}
                  label={t(`rental:${name}`)}
                  value={draft[name] ?? ""}
                  type={civil ? "date" : "text"}
                  onChange={(event) =>
                    change(name, event.target.value || undefined)
                  }
                  disabled={disabled}
                  error={!valid}
                  helperText={
                    instant
                      ? t("rental:instant_with_offset")
                      : t("rental:exclusive_period")
                  }
                />
              ))}
            </>
          )}
        </Fields>
        {!valid && (
          <Alert severity="warning">{t("rental:invalid_period")}</Alert>
        )}
      </Filter>
      <ActiveFilters>
        {chips.map((chip) => (
          <FilterChips
            key={`${chip.name}:${chip.entry}`}
            label={chip.label}
            disabled={disabled}
            onAction={() => remove(chip.name, chip.entry)}
          />
        ))}
      </ActiveFilters>
    </FilterBar>
  );
}

// Applied filters are independent of modal drafts.
