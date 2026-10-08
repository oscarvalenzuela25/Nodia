import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Typography,
  Alert,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TablePagination,
  LinearProgress,
  Chip,
  IconButton,
  Tooltip,
} from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { StyledSwitch } from "../ProviderConnectionForm/styles";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";
import BaseModal from "../../../../../../components/BaseModal";
import { ConfirmDialog } from "../../../../../../components/ConfirmDialog";
import TextInput from "../../../../../../components/inputs/TextInput";
import QueryErrorAlert from "../../../../../../components/QueryErrorAlert";
import { getHttpErrorMessage } from "../../../../../../config/httpFeedback";
import {
  useAiApiKeys,
  useCreateAiApiKey,
  useUpdateAiApiKey,
  useDeleteAiApiKey,
} from "../../infrastructure/useServices";
import type { AiApiKeyEntity } from "../../infrastructure/types";
import { Wrapper, Actions, ScrollTable, Form, TableFrame, RowActions, TableTopBar, EmptyBox } from "./styles";

const schema = z.object({
  label: z.string().trim().min(1).max(100),
  secret: z.string().trim().min(1).max(8192),
});
type Values = z.infer<typeof schema>;

const ApiKeyManager = ({
  providerId,
  disabled = false,
}: {
  providerId: string;
  disabled?: boolean;
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<{
    key: AiApiKeyEntity;
  } | null>(null);
  const query = useAiApiKeys({
    page: page + 1,
    limit: 10,
    includes: false,
    q: { provider_id_eq: providerId },
  });
  const create = useCreateAiApiKey();
  const update = useUpdateAiApiKey();
  const remove = useDeleteAiApiKey();
  const { control, handleSubmit, reset, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { label: "", secret: "" },
  });
  const pending =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    formState.isSubmitting;
  const busy = disabled || pending || query.isLoading || query.isFetching;
  const fail = (error: unknown) =>
    sileo.error({
      title: t("core:server_error_toast"),
      description: getHttpErrorMessage(error),
    });
  const submit = handleSubmit(async (values) => {
    if (busy) return;
    try {
      await create.mutateAsync({
        provider_id: providerId,
        ...values,
        is_selected: (query.data?.meta.total_items ?? 0) === 0,
        is_active: true,
      });
      sileo.success({ title: t("ai_providers:api_keys.created") });
      reset();
      create.reset();
      setOpen(false);
    } catch (error) {
      fail(error);
    }
  });
  const confirm = async () => {
    if (!action || busy) return;
    try {
      await remove.mutateAsync(action.key.id);
      sileo.success({ title: t("ai_providers:api_keys.deleted") });
      if (query.data?.data.length === 1 && page > 0)
        setPage(page - 1);
      setAction(null);
    } catch (error) {
      fail(error);
    }
  };
  const selectKey = async (key: AiApiKeyEntity, checked: boolean) => {
    if (busy) return;
    try {
      await update.mutateAsync({ id: key.id, payload: { is_selected: checked } });
      sileo.success({ title: t(checked ? "ai_providers:api_keys.selected" : "ai_providers:api_keys.deselected") });
    } catch (error) { fail(error); }
  };
  return (
    <Wrapper>
      <Alert severity="info">{t("ai_providers:api_keys.description")}</Alert>
      <TableTopBar>
        <Typography variant="h6">{t("ai_providers:api_keys.title")}</Typography>
        <Button
          variant="contained"
          disabled={busy || query.isError}
          onClick={() => setOpen(true)}
        >
          {t("ai_providers:api_keys.add")}
        </Button>
      </TableTopBar>
      <QueryErrorAlert
        isError={query.isError}
        isFetching={query.isFetching}
        onRetry={query.refetch}
      />
      {query.isFetching && !query.isLoading && <LinearProgress />}
      <TableFrame>
      <Skeleton loading={query.isLoading}>
        {!query.isError && !query.data?.data.length ? (
          <EmptyBox>
            <Typography color="text.secondary">
              {t("ai_providers:api_keys.empty")}
            </Typography>
          </EmptyBox>
        ) : (
          <ScrollTable>
            <Table sx={{ minWidth: 650 }}>
              <TableHead>
                <TableRow>
                  {["label", "mask", "state", "select", "actions"].map((name) => (
                    <TableCell key={name}>
                      {t(`ai_providers:api_keys.${name}`)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data?.data.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell>{key.label}</TableCell>
                    <TableCell>{key.display_hint}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(
                          `ai_providers:api_keys.${key.is_selected ? "primary" : "stored"}`,
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <StyledSwitch
                        checked={key.is_selected}
                        disabled={busy || !key.is_active || query.data?.meta.total_items === 1}
                        slotProps={{ input: { "aria-label": t("ai_providers:api_keys.select_named", { label: key.label }) } }}
                        onChange={(_event, checked) => { void selectKey(key, checked); }}
                      />
                    </TableCell>
                    <TableCell>
                      <RowActions>
                        <Tooltip title={t("ai_providers:api_keys.delete")}>
                        <span><IconButton
                          color="error"
                          disabled={busy}
                          aria-label={t("ai_providers:api_keys.delete")}
                          onClick={() => setAction({ key })}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton></span>
                        </Tooltip>
                      </RowActions>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollTable>
        )}
      </Skeleton>
      <TablePagination
        component="div"
        count={query.data?.meta.total_items ?? 0}
        page={page}
        rowsPerPage={10}
        rowsPerPageOptions={[10]}
        labelDisplayedRows={({ from, to, count }) =>
          t("ai_providers:api_keys.rows", { from, to, count })
        }
        getItemAriaLabel={(type) => t(`ai_providers:api_keys.page_${type}`)}
        slotProps={{
          actions: {
            previousButton: { disabled: busy || page === 0 },
            nextButton: {
              disabled:
                busy || (page + 1) * 10 >= (query.data?.meta.total_items ?? 0),
            },
          },
        }}
        onPageChange={(_event, next) => {
          if (!busy) setPage(next);
        }}
      />
      </TableFrame>
      <BaseModal
        open={open}
        onClose={() => {
          if (!busy) {
            reset();
            create.reset();
            setOpen(false);
          }
        }}
        title={t("ai_providers:api_keys.add")}
        actions={
          <Actions>
            <Button
              disabled={busy}
              onClick={() => {
                reset();
                create.reset();
                setOpen(false);
              }}
            >
              {t("core:cancel")}
            </Button>
            <Button
              variant="contained"
              type="submit"
              form="add-api-key"
              disabled={busy}
              loading={pending}
            >
              {t("core:save")}
            </Button>
          </Actions>
        }
      >
        <Form
          id="add-api-key"
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          <Controller
            control={control}
            name="label"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                label={t("ai_providers:api_keys.label")}
                disabled={busy}
                error={Boolean(fieldState.error)}
                required
              />
            )}
          />
          <Controller
            control={control}
            name="secret"
            render={({ field, fieldState }) => (
              <TextInput
                {...field}
                type="password"
                label={t("ai_providers:api_keys.secret")}
                disabled={busy}
                error={Boolean(fieldState.error)}
                required
              />
            )}
          />
        </Form>
      </BaseModal>
      <ConfirmDialog
        open={Boolean(action)}
        title={t("ai_providers:api_keys.delete")}
        message={t("ai_providers:api_keys.confirm", {
          label: action?.key.label ?? "",
        })}
        onClose={() => {
          if (!pending) setAction(null);
        }}
        onConfirm={() => {
          void confirm();
        }}
        isLoading={pending}
        confirmDisabled={busy}
      />
    </Wrapper>
  );
};
export default ApiKeyManager;
