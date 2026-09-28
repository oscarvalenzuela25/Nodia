import type { FC, FormEvent } from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Checkbox,
  Chip,
  Alert,
  Tooltip,
} from "@mui/material";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import DocumentScannerOutlinedIcon from "@mui/icons-material/DocumentScannerOutlined";
import StarOutlinedIcon from "@mui/icons-material/StarOutlined";
import BaseModal from "../../../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import { sileo } from "sileo";
import {
  useSyncAiProviderModels,
  useUpdateAiProvider,
} from "../../../../infrastructure/useServices";
import type { DiscoveredModelItem } from "../../../../infrastructure/types";
import type { SyncModelsModalProps } from "./types";
import {
  ModalContentContainer,
  ModelsScrollContainer,
  DiscoveredModelCard,
  ModelInfoBox,
  BadgesRow,
  RoleAssignmentBox,
  ModalActionsContainer,
} from "./styles";

const SyncModelsModal: FC<SyncModelsModalProps> = ({
  open,
  provider,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation(["ai_providers", "core"]);

  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelItem[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [mainModelId, setMainModelId] = useState<string>("");
  const [ocrModelId, setOcrModelId] = useState<string>("");

  const syncModelsMutation = useSyncAiProviderModels();
  const updateProviderMutation = useUpdateAiProvider();

  const fetchLiveModels = useCallback(async () => {
    if (!provider?.id) return;
    setIsLoadingDiscovery(true);
    setDiscoveryError(null);

    try {
      // Discover models with persist=false to avoid premature DB writes
      const res = await syncModelsMutation.mutateAsync({
        id: provider.id,
        persist: false,
      });

      const fetchedList = res.models || [];
      setDiscoveredModels(fetchedList);

      // Pre-select models:
      // If the provider already has configured models in DB, keep those selected
      const existingModelIds = new Set(
        (provider.fields?.available_models || []).map((m: any) => m.id)
      );

      const initialSelected = new Set<string>();
      if (existingModelIds.size > 0) {
        fetchedList.forEach((m) => {
          if (existingModelIds.has(m.id)) {
            initialSelected.add(m.id);
          }
        });
      }

      // If none matched or empty DB, select all by default so user can uncheck
      if (initialSelected.size === 0) {
        fetchedList.forEach((m) => initialSelected.add(m.id));
      }

      setSelectedModelIds(initialSelected);

      // Main model pre-selection
      const existingMain = provider.fields?.selected_model;
      if (existingMain && initialSelected.has(existingMain)) {
        setMainModelId(existingMain);
      } else {
        const recommended = fetchedList.find((m) => m.isRecommended && initialSelected.has(m.id));
        setMainModelId(recommended ? recommended.id : (fetchedList[0]?.id || ""));
      }

      // OCR model pre-selection
      const existingOcr =
        provider.fields?.ocr_focus_model || provider.fields?.ocr_model;
      if (existingOcr && initialSelected.has(existingOcr)) {
        setOcrModelId(existingOcr);
      } else {
        const ocrPref = fetchedList.find(
          (m) =>
            (m.role === "ocr" || m.capabilities?.includes("documents")) &&
            initialSelected.has(m.id)
        );
        setOcrModelId(ocrPref ? ocrPref.id : "");
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err.message;
      setDiscoveryError(
        Array.isArray(serverMsg) ? serverMsg.join(", ") : serverMsg
      );
    } finally {
      setIsLoadingDiscovery(false);
    }
  }, [provider, syncModelsMutation]);

  useEffect(() => {
    if (open && provider?.id) {
      fetchLiveModels();
    } else {
      setDiscoveredModels([]);
      setSelectedModelIds(new Set());
      setMainModelId("");
      setOcrModelId("");
      setDiscoveryError(null);
    }
  }, [open, provider?.id]);

  const handleToggleModel = (modelId: string) => {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
        // If unchecking the current main model, reset it or pick another checked model
        if (mainModelId === modelId) {
          const remaining = Array.from(next);
          setMainModelId(remaining.length > 0 ? remaining[0] : "");
        }
        // If unchecking the current OCR model, clear it
        if (ocrModelId === modelId) {
          setOcrModelId("");
        }
      } else {
        next.add(modelId);
        if (!mainModelId) {
          setMainModelId(modelId);
        }
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = new Set(discoveredModels.map((m) => m.id));
    setSelectedModelIds(allIds);
    if (!mainModelId && discoveredModels.length > 0) {
      setMainModelId(discoveredModels[0].id);
    }
  };

  const handleDeselectAll = () => {
    setSelectedModelIds(new Set());
    setMainModelId("");
    setOcrModelId("");
  };

  // Dropdown options based strictly on currently checked models
  const checkedModelOptions = useMemo(() => {
    return discoveredModels
      .filter((m) => selectedModelIds.has(m.id))
      .map((m) => ({
        value: m.id,
        label: m.displayName || m.name || m.id,
        description: m.description,
      }));
  }, [discoveredModels, selectedModelIds]);

  const ocrOptions = useMemo(() => {
    return [
      {
        value: "",
        label: t(
          "ai_providers:modal_sync_models.ocr_none_option",
          "(Ninguno / Sin foco OCR específico)"
        ),
      },
      ...checkedModelOptions,
    ];
  }, [checkedModelOptions, t]);

  const isSubmitting = updateProviderMutation.isPending;

  const handleClose = () => {
    if (isSubmitting || isLoadingDiscovery) return;
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider?.id || isSubmitting) return;

    if (selectedModelIds.size === 0) {
      sileo.error({
        title: t(
          "ai_providers:modal_sync_models.no_models_selected_error",
          "Debes seleccionar al menos un modelo para continuar."
        ),
      });
      return;
    }

    if (!mainModelId || !selectedModelIds.has(mainModelId)) {
      sileo.error({
        title: t(
          "ai_providers:modal_sync_models.no_main_model_error",
          "Debes elegir un modelo principal entre los modelos seleccionados."
        ),
      });
      return;
    }

    const curatedModels = discoveredModels.filter((m) =>
      selectedModelIds.has(m.id)
    );

    try {
      await updateProviderMutation.mutateAsync({
        id: provider.id,
        data: {
          fields: {
            ...(provider.fields || {}),
            available_models: curatedModels,
            selected_model: mainModelId,
            ocr_focus_model: ocrModelId || undefined,
            ocr_model: ocrModelId || undefined,
          },
        },
      });

      sileo.success({
        title: t(
          "ai_providers:modal_sync_models.success_title",
          "Modelos actualizados correctamente"
        ),
        description: t(
          "ai_providers:modal_sync_models.success_desc",
          "Se configuraron {{count}} modelos para este proveedor.",
          { count: curatedModels.length }
        ),
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message || err.message;
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
        description: Array.isArray(serverMsg) ? serverMsg.join(", ") : serverMsg,
      });
    }
  };

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="contained"
        color="error"
        onClick={handleClose}
        disabled={isSubmitting}
        sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
      >
        {t("ai_providers:modal_sync_models.cancel", "Cancelar")}
      </Button>

      <Button
        variant="contained"
        color="primary"
        type="submit"
        form="sync-models-form"
        disabled={isSubmitting || isLoadingDiscovery || selectedModelIds.size === 0}
        startIcon={
          isSubmitting ? (
            <CircularProgress size={16} color="inherit" />
          ) : undefined
        }
        sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
      >
        {isSubmitting
          ? t("ai_providers:modal_sync_models.saving_models", "Guardando...")
          : t("ai_providers:modal_sync_models.save_models", "Guardar Modelos")}
      </Button>
    </ModalActionsContainer>
  );

  return (
    <BaseModal
      open={open}
      onClose={handleClose}
      title={t(
        "ai_providers:modal_sync_models.title",
        "Sincronizar y configurar modelos"
      )}
      actions={modalActions}
      maxWidth="md"
    >
      <form id="sync-models-form" onSubmit={handleSubmit}>
        <ModalContentContainer>
          <Typography variant="body2" color="text.secondary">
            {t(
              "ai_providers:modal_sync_models.subtitle",
              "Consulta los modelos en tiempo real del proveedor y selecciona cuáles activar para el sistema."
            )}
          </Typography>

          {/* LOADING DISCOVERY */}
          {isLoadingDiscovery && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                p: 6,
                gap: 2,
              }}
            >
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                {t(
                  "ai_providers:modal_sync_models.fetching_models",
                  "Consultando modelos disponibles en el proveedor..."
                )}
              </Typography>
            </Box>
          )}

          {/* DISCOVERY ERROR */}
          {!isLoadingDiscovery && discoveryError && (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<RefreshOutlinedIcon />}
                  onClick={fetchLiveModels}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  {t("ai_providers:modal_sync_models.retry", "Reintentar")}
                </Button>
              }
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {t(
                  "ai_providers:modal_sync_models.fetch_error_title",
                  "No se pudieron obtener los modelos"
                )}
              </Typography>
              <Typography variant="body2">{discoveryError}</Typography>
            </Alert>
          )}

          {/* DISCOVERED MODELS LIST */}
          {!isLoadingDiscovery && !discoveryError && discoveredModels.length > 0 && (
            <>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {t(
                      "ai_providers:modal_sync_models.models_list_title",
                      "Modelos descubiertos ({{count}})",
                      { count: discoveredModels.length }
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      "ai_providers:modal_sync_models.models_list_desc",
                      "Marca las casillas de los modelos que deseas incorporar a la configuración de este proveedor."
                    )}
                  </Typography>
                </Box>

                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={handleSelectAll}
                    sx={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    {t(
                      "ai_providers:modal_sync_models.select_all",
                      "Seleccionar todos"
                    )}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    color="inherit"
                    onClick={handleDeselectAll}
                    sx={{ textTransform: "none", fontSize: "0.75rem" }}
                  >
                    {t(
                      "ai_providers:modal_sync_models.deselect_all",
                      "Deseleccionar todos"
                    )}
                  </Button>
                </Box>
              </Box>

              <ModelsScrollContainer>
                {discoveredModels.map((model) => {
                  const isChecked = selectedModelIds.has(model.id);
                  const isMain = mainModelId === model.id;
                  const isOcr = ocrModelId === model.id;

                  const contextText = model.contextWindow
                    ? `${(model.contextWindow / 1000000)
                        .toFixed(1)
                        .replace(".0", "")}M Tokens`
                    : "128K Tokens";

                  return (
                    <DiscoveredModelCard
                      key={model.id}
                      selected={isChecked}
                      onClick={() => handleToggleModel(model.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flex: 1 }}>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => handleToggleModel(model.id)}
                          onClick={(e) => e.stopPropagation()}
                          size="small"
                          color="primary"
                          sx={{ p: 0.5 }}
                        />

                        <ModelInfoBox>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {model.displayName || model.name || model.id}
                            </Typography>
                            {model.isRecommended && (
                              <Chip
                                size="small"
                                icon={<StarOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                                label="Recomendado"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }}
                              />
                            )}
                            {isMain && (
                              <Chip
                                size="small"
                                icon={<PsychologyOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                                label="Principal"
                                color="success"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                              />
                            )}
                            {isOcr && (
                              <Chip
                                size="small"
                                icon={<DocumentScannerOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                                label="Foco OCR"
                                color="secondary"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                              />
                            )}
                          </Box>

                          <Typography
                            variant="caption"
                            sx={{ fontFamily: "monospace", color: "text.secondary" }}
                          >
                            {model.id}
                          </Typography>

                          {model.description && (
                            <Typography variant="caption" color="text.secondary">
                              {model.description}
                            </Typography>
                          )}

                          <BadgesRow>
                            <Chip
                              size="small"
                              label={contextText}
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem" }}
                            />
                            {model.capabilities?.map((cap) => (
                              <Chip
                                key={cap}
                                size="small"
                                label={cap}
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.68rem" }}
                              />
                            ))}
                          </BadgesRow>
                        </ModelInfoBox>
                      </Box>
                    </DiscoveredModelCard>
                  );
                })}
              </ModelsScrollContainer>

              {/* ROLE ASSIGNMENTS */}
              <RoleAssignmentBox>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t(
                    "ai_providers:modal_sync_models.main_model_section",
                    "Asignación de roles de modelo"
                  )}
                </Typography>

                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  <SelectSingleInput
                    label={t(
                      "ai_providers:modal_sync_models.main_model_label",
                      "Modelo Principal por Defecto"
                    )}
                    placeholder={t(
                      "ai_providers:modal_sync_models.main_model_placeholder",
                      "Seleccionar modelo principal..."
                    )}
                    helperText={t(
                      "ai_providers:modal_sync_models.main_model_helper",
                      "Modelo que ejecutará las tareas principales e inferencias generales del sistema."
                    )}
                    value={mainModelId}
                    onChange={(val) => setMainModelId(String(val || ""))}
                    options={checkedModelOptions}
                    disabled={checkedModelOptions.length === 0}
                  />

                  <SelectSingleInput
                    label={t(
                      "ai_providers:modal_sync_models.ocr_model_label",
                      "Modelo Enfocado en OCR (Informativo)"
                    )}
                    placeholder={t(
                      "ai_providers:modal_sync_models.ocr_model_placeholder",
                      "Seleccionar modelo para OCR..."
                    )}
                    helperText={t(
                      "ai_providers:modal_sync_models.ocr_model_helper",
                      "Modelo especializado o preferido para tareas de extracción y lectura de facturas."
                    )}
                    value={ocrModelId}
                    onChange={(val) => setOcrModelId(String(val || ""))}
                    options={ocrOptions}
                    disabled={checkedModelOptions.length === 0}
                  />
                </Box>
              </RoleAssignmentBox>
            </>
          )}
        </ModalContentContainer>
      </form>
    </BaseModal>
  );
};

export default SyncModelsModal;
