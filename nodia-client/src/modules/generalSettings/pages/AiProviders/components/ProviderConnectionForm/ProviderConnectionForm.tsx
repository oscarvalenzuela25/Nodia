import type { FC } from "react";
import { Button, Box, Typography } from "@mui/material";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";
import BaseModal from "../../../../../../components/BaseModal";
import TextInput from "../../../../../../components/inputs/TextInput";
import SelectSingleInput from "../../../../../../components/inputs/SelectSingleInput";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { getHttpErrorMessage } from "../../../../../../config/httpFeedback";
import { useAiProviderCatalog, useCreateAiProvider, useUpdateAiProvider } from "../../infrastructure/useServices";
import type { AiProviderHealthItem } from "../../infrastructure/types";
import { Form, SwitchWrapper, StyledFormControlLabel, StyledSwitch } from "./styles";

const schema = z.object({
  catalogId: z.string(), name: z.string().trim(), web: z.boolean(), agentic: z.boolean(),
  active: z.boolean(), isDefault: z.boolean(), api: z.boolean(), rotate: z.boolean(),
});
type Values = z.infer<typeof schema>;
interface Props {
  provider?: AiProviderHealthItem;
  totalProviders?: number;
  onClose: () => void;
  onSuccess?: () => void;
}

const ProviderConnectionForm: FC<Props> = ({ provider, totalProviders, onClose, onSuccess }) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const catalogQuery = useAiProviderCatalog();
  const create = useCreateAiProvider();
  const update = useUpdateAiProvider();
  const { control, handleSubmit, formState, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      catalogId: provider?.catalog_id ?? provider?.catalog?.id ?? "",
      name: provider?.name ?? "", web: provider?.use_token_plan_web ?? false,
      agentic: provider?.use_token_plan_agentic ?? false, active: provider?.isActive ?? true,
      isDefault: provider?.is_default ?? totalProviders === 0, api: provider?.use_api_key ?? false, rotate: provider?.auto_rotate_api_keys ?? false,
    },
  });
  const apiEnabled = useWatch({ control, name: "api" });
  const catalogId = useWatch({ control, name: "catalogId" });
  const catalogs = catalogQuery.data ?? [];
  const catalog = catalogs.find((item) => item.id === catalogId)
    ?? provider?.catalog
    ?? catalogs.find((item) => item.key === provider?.key);
  const pending = create.isPending || update.isPending || formState.isSubmitting;
  const busy = pending || catalogQuery.isLoading || catalogQuery.isFetching;
  const submit = handleSubmit(async (values) => {
    if (busy || !catalog || catalogQuery.isError) return;
    const web = values.web && catalog.can_use_token_plan_web === true;
    const agentic = values.agentic && catalog.can_use_token_plan_agentic === true;
    const api = values.api && catalog.can_use_api_key === true;
    const previous = provider?.default_mode;
    const defaultMode = previous === "token_plan_web" && web ? previous
      : previous === "token_plan_agentic" && agentic ? previous
      : previous === "api_key" && api ? previous
      : agentic ? "token_plan_agentic" : web ? "token_plan_web" : api ? "api_key" : null;
    const payload = {
      name: values.name || undefined, use_api_key: api, auto_rotate_api_keys: values.rotate,
      use_token_plan_web: web, use_token_plan_agentic: agentic, default_mode: defaultMode,
      is_active: values.active, is_default: values.isDefault,
    };
    try {
      if (provider) {
        await update.mutateAsync({ id: provider.id, data: payload });
      } else {
        await create.mutateAsync({ ...payload, catalog_id: catalog.id });
      }
      sileo.success({ title: t(provider ? "ai_providers:notifications.provider_updated" : "ai_providers:notifications.provider_created") });
      onSuccess?.();
      onClose();
    } catch (error) {
      sileo.error({ title: t("core:server_error_toast"), description: getHttpErrorMessage(error) });
    }
  });
  return (
    <BaseModal open onClose={() => { if (!busy) onClose(); }} disableEscapeKeyDown={busy}
      showCloseButton={!busy} title={t(provider ? "ai_providers:connection.edit_title" : "ai_providers:connection.create_title")}
      actions={<Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, width: "100%", justifyContent: "flex-end" }}>
        <Button onClick={onClose} disabled={busy}>{t("core:cancel")}</Button>
        <Button variant="contained" type="submit" form="provider-connection-form" disabled={busy || !catalog || catalogQuery.isError} loading={pending}>{t("core:save")}</Button>
      </Box>}
    >
      <Form id="provider-connection-form" onSubmit={(event) => { void submit(event); }}>
        <QueryErrorAlert isError={catalogQuery.isError} isFetching={catalogQuery.isFetching} onRetry={catalogQuery.refetch} />
        {!provider && <Controller control={control} name="catalogId" render={({ field }) =>
          <SelectSingleInput label={t("ai_providers:connection.catalog")} value={field.value || null}
            options={catalogs.filter((item) => item.is_active !== false && (item.can_use_api_key || item.can_use_token_plan_web || item.can_use_token_plan_agentic)).map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => {
              field.onChange(value ?? "");
              const next = catalogs.find((item) => item.id === value);
              if (!next?.can_use_api_key) setValue("api", false);
              if (!next?.can_use_token_plan_web) setValue("web", false);
              if (!next?.can_use_token_plan_agentic) setValue("agentic", false);
              if (next?.can_use_api_key && !next.can_use_token_plan_web && !next.can_use_token_plan_agentic) setValue("api", true);
            }} disabled={busy} required clearable={false} />
        } />}
        <Controller control={control} name="name" render={({ field }) =>
          <TextInput {...field} label={t("ai_providers:modal_config.instance_name_label")} disabled={busy} fullWidth />
        } />
        <Typography variant="body2" color="text.secondary">{t("ai_providers:connection.modes_description")}</Typography>
        {(["api", "web", "agentic", ...(apiEnabled ? ["rotate"] : []), "isDefault", "active"] as const).map((name) =>
          <Controller key={name} control={control} name={name as "api" | "web" | "agentic" | "rotate" | "active" | "isDefault"} render={({ field }) =>
            <SwitchWrapper>
              <StyledFormControlLabel labelPlacement="start" label={t(`ai_providers:connection.${name}`)}
                control={<StyledSwitch checked={field.value} onChange={(_event, checked) => field.onChange(checked)} disabled={busy || (name === "api" && !catalog?.can_use_api_key) || (name === "web" && !catalog?.can_use_token_plan_web) || (name === "agentic" && !catalog?.can_use_token_plan_agentic)} />} />
            </SwitchWrapper>
          } />,
        )}
      </Form>
    </BaseModal>
  );
};

export default ProviderConnectionForm;
