import { getHttpErrorMessage, notifyHttpError } from "../../../../../../../../config/httpFeedback";
import type { FC, FormEvent } from "react";
import { useState, useEffect, useCallback, useRef } from "react";
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
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import RemoveDoneOutlinedIcon from "@mui/icons-material/RemoveDoneOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import BaseModal from "../../../../../../../../components/BaseModal";
import SelectSingleInput from "../../../../../../../../components/inputs/SelectSingleInput";
import InputSearch from "../../../../../../../../components/inputs/InputSearch";
import { sileo } from "sileo";
import {
  useSyncAiProviderModels,
  useUpdateAiProvider,
} from "../../../../infrastructure/useServices";
import type { DiscoveredModelItem } from "../../../../infrastructure/types";
import type { SyncModelsModalProps } from "./types";
import { modelCardContains, modelCardEffort, providerModelCards } from "../../../../infrastructure/modelCards";
import { selectSyncCards, syncCardSelected, syncModelsFieldsPatch, syncRoleOptions, validDiscoveredModels, type SyncModelCard } from "../../../../infrastructure/syncModelSelection";
import {
  ModalContentContainer,
  ProviderMetaHeader,
  ModelsScrollContainer,
  DiscoveredModelCard,
  ModelInfoBox,
  BadgesRow,
  RoleAssignmentBox,
  RolesVerticalStack,
  RoleCard,
  RoleCardHeader,
  ModalActionsContainer,
} from "./styles";

const SyncModelsEditor: FC<SyncModelsModalProps> = ({
  open,
  provider,
  isOperational,
  mode,
  onClose,
  onSuccess,
}) => {
  const { t, i18n } = useTranslation(["ai_providers", "core"]);

  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModelItem[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [mainModelId, setMainModelId] = useState<string>("");
  const [ocrModelId, setOcrModelId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [effortChanges, setEffortChanges] = useState<Record<string, string>>({});
  const [mainNeedsEffort, setMainNeedsEffort] = useState(false);
  const [ocrNeedsEffort, setOcrNeedsEffort] = useState(false);
  const [invalidDiscovery, setInvalidDiscovery] = useState(false);
  const submission = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const requestedMode = mode ?? provider?.default_mode ?? provider?.mode ?? null;
  const activeMode = requestedMode === "agentic" || requestedMode === "api_key" ? requestedMode : null;
  const targetEngine = activeMode === "agentic" ? "agentic" : undefined;
  const providerFields = provider?.fields ?? {};
  const scopedFields = providerFields[activeMode ?? ""];
  const modeFields = typeof scopedFields === "object" && scopedFields !== null && !Array.isArray(scopedFields)
    ? scopedFields as Record<string, unknown>
    : providerFields.agentic || providerFields.api_key ? {} : providerFields;
  const savedLevels = modeFields.thinking_levels;
  const thinkingLevels: Record<string, unknown> = {
    ...(typeof savedLevels === "object" && savedLevels !== null && !Array.isArray(savedLevels) ? savedLevels : {}),
    ...effortChanges,
  };
  if (ocrModelId && !Object.hasOwn(thinkingLevels, ocrModelId) && modeFields.thinking_level !== undefined) {
    thinkingLevels[ocrModelId] = modeFields.thinking_level;
  }
  const modelCards = providerModelCards(discoveredModels,
    (provider?.key ?? provider?.catalog?.key) === "gemini" && activeMode === "agentic", {
      selectedModel: mainModelId, ocrModel: ocrModelId,
      thinkingLevel: effortChanges[mainModelId] ?? modeFields.thinking_level,
      thinkingLevels,
    });
  const mainCard = modelCards.find(card => modelCardContains(card, mainModelId));
  const ocrCard = modelCards.find(card => modelCardContains(card, ocrModelId));
  const selectedCardCount = modelCards.filter(card => syncCardSelected(card, selectedModelIds)).length;
  const hasPreferenceConflict = modelCards.some(card => card.preferenceConflicts.length > 0);

  const {
    mutate: mutateSyncModels,
    isPending: isLoadingDiscovery,
    isSuccess: discoverySucceeded,
    error: syncModelsError,
    reset: resetSyncModels,
  } = useSyncAiProviderModels();
  const updateProviderMutation = useUpdateAiProvider();

  const providerRef = useRef(provider);
  useEffect(() => {
    providerRef.current = provider;
  }, [provider]);

  const hasFetchedRef = useRef(false);

  // Operational check:
  // Respects isOperational prop passed from ProviderDetail.
  const isOperationalMode = isOperational === true && activeMode !== null;
  const discoveryError = syncModelsError ? getHttpErrorMessage(syncModelsError)
    : invalidDiscovery ? t("core:server_error_toast") : null;

  const handleDiscoveredModels = useCallback(
    (fetchedList: DiscoveredModelItem[]) => {
      setDiscoveredModels(fetchedList);

      const currentProvider = providerRef.current;
      const providerFields = (currentProvider?.fields || {}) as Record<string, unknown>;
      const modeFields = (providerFields[activeMode ?? ""] as Record<string, unknown>) || {};

      const hasAnyModeScoped =
        Boolean(providerFields.agentic) ||
        Boolean(providerFields.api_key);

      const configuredModels =
        modeFields.available_models ||
        (!hasAnyModeScoped ? providerFields.available_models : []);

      const existingModelIds = new Set(
        (Array.isArray(configuredModels) ? configuredModels : [])
          .filter((model): model is { id: string } =>
            typeof model === "object" && model !== null && typeof model.id === "string"
          )
          .map((model) => model.id)
      );

      const initialSelected = new Set<string>();
      if (existingModelIds.size > 0) {
        fetchedList.forEach((m) => {
          if (existingModelIds.has(m.id)) {
            initialSelected.add(m.id);
          }
        });
      }

      if (initialSelected.size === 0) {
        fetchedList.forEach((m) => initialSelected.add(m.id));
      }

      setSelectedModelIds(initialSelected);

      // 1. Default model: Strictly required ("si o si debe de ir un modelo por default")
      const existingMain =
        modeFields.selected_model ||
        (!hasAnyModeScoped ? providerFields.selected_model : undefined);

      if (typeof existingMain === "string" && initialSelected.has(existingMain)) {
        setMainModelId(existingMain);
      } else {
        setMainModelId("");
      }

      // 2. OCR model: starts in null
      const existingOcr =
        modeFields.ocr_focus_model ||
        modeFields.ocr_model ||
        (!hasAnyModeScoped
          ? (providerFields.ocr_focus_model || providerFields.ocr_model)
          : undefined);

      if (typeof existingOcr === "string" && initialSelected.has(existingOcr)) {
        setOcrModelId(existingOcr);
      } else {
        setOcrModelId("");
      }
    },
    [activeMode]
  );

  const fetchLiveModels = useCallback(() => {
    const currentProvider = providerRef.current;
    if (!currentProvider?.id || !isOperationalMode) return;
    setInvalidDiscovery(false);
    mutateSyncModels(
      {
        id: currentProvider.id,
        persist: false,
        mode: activeMode,
        engine: targetEngine,
      },
      {
        onError: notifyHttpError,
        onSuccess: (res) => {
          if (!validDiscoveredModels(res?.models)) {
            setInvalidDiscovery(true);
            sileo.error({ title: t("core:server_error_toast") });
            return;
          }
          handleDiscoveredModels(res.models);
          sileo.success({ title: t("ai_providers:modal_sync_models.discovery_success") });
        },
      }
    );
  }, [isOperationalMode, mutateSyncModels, handleDiscoveredModels, activeMode, targetEngine, t]);

  useEffect(() => {
    if (!open) {
      hasFetchedRef.current = false;
      return;
    }

    if (open && provider?.id && isOperationalMode && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchLiveModels();
    }
  }, [open, provider?.id, isOperationalMode, fetchLiveModels]);

  const applyCardSelection = (cards: SyncModelCard[], enabled: boolean) => {
    const next = selectSyncCards(cards, selectedModelIds, enabled);
    setSelectedModelIds(next);
    if (mainModelId && !next.has(mainModelId)) { setMainModelId(""); setMainNeedsEffort(false); }
    if (ocrModelId && !next.has(ocrModelId)) { setOcrModelId(""); setOcrNeedsEffort(false); }
  };

  const filteredCards = (() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return modelCards;
    return modelCards.filter(card => (card.variants.length ? card.variants.map(item => item.model) : [card.model]).some(model => {
      const idMatch = model.id.toLowerCase().includes(query);
      const nameMatch = (model.displayName || model.name || "").toLowerCase().includes(query);
      const descMatch = (model.description || "").toLowerCase().includes(query);
      const capMatch = model.capabilities?.some((cap) => cap.toLowerCase().includes(query));
      return idMatch || nameMatch || descMatch || Boolean(capMatch);
    }));
  })();

  const handleSelectAll = () => {
    applyCardSelection(filteredCards, true);
  };

  const handleDeselectAll = () => {
    applyCardSelection(filteredCards, false);
  };

  // Dropdown options based strictly on currently checked models
  const checkedModelOptions = syncRoleOptions(modelCards, selectedModelIds, mainModelId);

  const ocrOptions = [
      {
        value: "",
        label: t(
          "ai_providers:modal_sync_models.ocr_none_option",
          "(Ninguno / Sin foco OCR específico)"
        ),
      },
      ...syncRoleOptions(modelCards, selectedModelIds, ocrModelId),
    ];

  const roleEffortControl = (card: SyncModelCard | undefined, modelId: string, main: boolean) => {
    if (!card?.variants.length) return null;
    const needsEffort = main ? mainNeedsEffort : ocrNeedsEffort;
    const exact = card.variants.find(item => item.model.id === modelId);
    const saved = Object.hasOwn(thinkingLevels, modelId) ? thinkingLevels[modelId]
      : main ? modeFields.thinking_level : undefined;
    const value = needsEffort || saved === null ? null : typeof saved === "string" ? saved : exact?.effort ?? null;
    return <>
      <SelectSingleInput
        label={t("ai_providers:detail.reasoning_model_label", { model: card.label })}
        value={value}
        placeholder={t("ai_providers:modal_sync_models.choose_reasoning")}
        options={card.variants.map(item => ({ value: item.effort, label: t(`ai_providers:detail.level_${item.effort}`) }))}
        clearable={false}
        disabled={isSubmitting || isLoadingDiscovery}
        onChange={value => {
          const variant = value ? modelCardEffort(card, value) : undefined;
          if (!variant) return;
          // Activating a family retains every exact variant for later effort choices.
          setSelectedModelIds(selectSyncCards([card], selectedModelIds, true));
          setEffortChanges(previous => ({ ...previous, [variant.model.id]: variant.effort }));
          if (main) { setMainModelId(variant.model.id); setMainNeedsEffort(false); }
          else { setOcrModelId(variant.model.id); setOcrNeedsEffort(false); }
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{modelId}</Typography>
    </>;
  };

  const isSubmitting = updateProviderMutation.isPending;

  // The submit button is enabled only when operational, at least 1 model selected, and a default model is chosen
  const canSave =
    isOperationalMode &&
    !isSubmitting &&
    !isLoadingDiscovery &&
    !discoveryError &&
    !mainNeedsEffort && !ocrNeedsEffort && !hasPreferenceConflict &&
    selectedModelIds.size > 0 &&
    Boolean(mainModelId);

  const handleClose = () => {
    if (isSubmitting || isLoadingDiscovery) return;
    hasFetchedRef.current = false;
    setDiscoveredModels([]);
    setSelectedModelIds(new Set());
    setMainModelId("");
    setOcrModelId("");
    setSearchQuery("");
    setEffortChanges({});
    setMainNeedsEffort(false);
    setOcrNeedsEffort(false);
    resetSyncModels();
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider?.id || !activeMode || !isOperationalMode || isSubmitting || !canSave || submission.current) return;

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
          "Debes elegir un modelo principal por defecto entre los modelos seleccionados."
        ),
      });
      return;
    }

    const activeIds = selectSyncCards(modelCards.filter(card => syncCardSelected(card, selectedModelIds)), new Set(), true);
    const curatedModels = discoveredModels.filter(model => activeIds.has(model.id));

    submission.current = true;
    try {
      const updatedFields = syncModelsFieldsPatch({ fields: provider.fields ?? {}, mode: activeMode,
        defaultMode: provider.default_mode, models: curatedModels, mainId: mainModelId,
        ocrId: ocrModelId, effortChanges });

      await updateProviderMutation.mutateAsync({
        id: provider.id,
        data: {
          fields: updatedFields,
        },
      });
      if (!mounted.current) return;

      sileo.success({
        title: t(
          "ai_providers:modal_sync_models.success_title",
          "Modelos actualizados correctamente"
        ),
        description: t(
          "ai_providers:modal_sync_models.success_desc",
          "Se configuraron {{count}} modelos para este proveedor.",
          { count: selectedCardCount }
        ),
      });

      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      if (!mounted.current) return;
      sileo.error({
        title: t("core:server_error_toast", "Error en el servidor"),
        description: getHttpErrorMessage(err),
      });
    } finally {
      submission.current = false;
    }
  };

  const modalActions = (
    <ModalActionsContainer>
      <Button
        variant="outlined"
        color="inherit"
        onClick={handleClose}
        disabled={isSubmitting || isLoadingDiscovery}
        sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
      >
        {t("ai_providers:modal_sync_models.cancel", "Cancelar")}
      </Button>

      <Tooltip
        title={
          !isOperationalMode
            ? activeMode === "agentic"
              ? t("ai_providers:modal_sync_models.agentic_not_operational_warning")
              : t("ai_providers:api_keys.required")
            : selectedModelIds.size === 0
            ? t(
                "ai_providers:modal_sync_models.no_models_selected_error",
                "Debes seleccionar al menos un modelo para continuar."
              )
            : ""
        }
      >
        <span>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            form="sync-models-form"
            disabled={!canSave}
            startIcon={
              isSubmitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2, px: 2.5 }}
          >
            {isSubmitting
              ? t("ai_providers:modal_sync_models.saving_models", "Guardando...")
              : t("ai_providers:modal_sync_models.save_models", "Guardar Modelos")}
          </Button>
        </span>
      </Tooltip>
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
      size="md"
    >
      <form id="sync-models-form" onSubmit={handleSubmit}>
        <ModalContentContainer>
          {/* PROVIDER META HEADER */}
          {provider && (
            <ProviderMetaHeader>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {provider.name || provider.key}
                </Typography>
                <Chip
                  size="small"
                  icon={
                    activeMode === "agentic" ? (
                      <PsychologyOutlinedIcon sx={{ fontSize: "14px !important" }} />
                    ) : (
                      <InfoOutlinedIcon sx={{ fontSize: "14px !important" }} />
                    )
                  }
                  label={
                    activeMode === "agentic"
                      ? t(
                          "ai_providers:modal_sync_models.provider_badge_agentic",
                          "Agentic"
                        )
                      : t("ai_providers:connection.api")
                  }
                  color={
                    activeMode === "agentic"
                      ? "secondary"
                      : "primary"
                  }
                  variant="outlined"
                  sx={{ height: 22, fontSize: "0.72rem", fontWeight: 600 }}
                />
              </Box>

              <Chip
                size="small"
                label={
                  isOperationalMode
                    ? t(
                        "ai_providers:modal_sync_models.status_operational",
                        "Operativo"
                      )
                    : t(
                        "ai_providers:modal_sync_models.status_not_operational",
                        "No Operativo"
                      )
                }
                color={isOperationalMode ? "success" : "warning"}
                sx={{ height: 22, fontSize: "0.72rem", fontWeight: 700 }}
              />
            </ProviderMetaHeader>
          )}

          <Typography variant="body2" color="text.secondary">
            {t(
              "ai_providers:modal_sync_models.subtitle",
              "Consulta los modelos en tiempo real del proveedor y selecciona cuáles activar para el sistema."
            )}
          </Typography>

          {/* WARNING IF SESSION NOT OPERATIONAL */}
          {!isOperationalMode && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {t(
                  "ai_providers:modal_sync_models.session_not_operational_title",
                  "Modo no operativo"
                )}
              </Typography>
              <Typography variant="body2">
                {t(activeMode === "agentic"
                  ? "ai_providers:modal_sync_models.agentic_not_operational_warning"
                  : "ai_providers:api_keys.required")}

              </Typography>
            </Alert>
          )}

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
          {!isLoadingDiscovery && !discoveryError && isOperationalMode && discoverySucceeded && discoveredModels.length === 0 && (
            <Alert severity="info">{t("ai_providers:modal_sync_models.no_models_available")}</Alert>
          )}
          {!isLoadingDiscovery && !discoveryError && discoveredModels.length > 0 && (
            <>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {t(
                        "ai_providers:modal_sync_models.models_list_title",
                        "Modelos descubiertos ({{count}})",
                        { count: modelCards.length }
                      )}
                    </Typography>
                    <Chip
                      size="small"
                      label={t(
                        "ai_providers:modal_sync_models.selected_count",
                        "{{count}} seleccionados",
                        { count: selectedCardCount }
                      )}
                      color={selectedModelIds.size > 0 ? "primary" : "default"}
                      sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 600 }}
                    />
                  </Box>

                  <Box sx={{ display: "flex", gap: 1, flexDirection: { xs: "column", sm: "row" }, width: { xs: "100%", sm: "auto" } }}>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<DoneAllOutlinedIcon sx={{ fontSize: 16 }} />}
                      onClick={handleSelectAll}
                      disabled={isSubmitting || isLoadingDiscovery}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: 2,
                        boxShadow: "none",
                        "&:hover": {
                          boxShadow: "none",
                        },
                      }}
                    >
                      {t(
                        "ai_providers:modal_sync_models.select_all",
                        "Seleccionar todos"
                      )}
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      startIcon={<RemoveDoneOutlinedIcon sx={{ fontSize: 16 }} />}
                      onClick={handleDeselectAll}
                      disabled={isSubmitting || isLoadingDiscovery}
                      sx={{
                        textTransform: "none",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        borderRadius: 2,
                        boxShadow: "none",
                        "&:hover": {
                          boxShadow: "none",
                        },
                      }}
                    >
                      {t(
                        "ai_providers:modal_sync_models.deselect_all",
                        "Deseleccionar todos"
                      )}
                    </Button>
                  </Box>
                </Box>

                <InputSearch
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onClear={() => setSearchQuery("")}
                  placeholder={t(
                    "ai_providers:modal_sync_models.search_placeholder",
                    "Buscar modelos por nombre, ID o capacidad..."
                  )}
                  variant="outlined"
                  size="small"
                  fullWidth
                  disabled={isSubmitting || isLoadingDiscovery}
                />
              </Box>

              <ModelsScrollContainer>
                {filteredCards.length === 0 ? (
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      py: 6,
                      px: 2,
                      gap: 1,
                    }}
                  >
                    <SearchOffOutlinedIcon
                      sx={{ fontSize: 36, color: "text.secondary", opacity: 0.6 }}
                    />
                    <Typography variant="body2" color="text.secondary" align="center">
                      {t(
                        "ai_providers:modal_sync_models.no_models_found",
                        "No se encontraron modelos que coincidan con la búsqueda."
                      )}
                    </Typography>
                  </Box>
                ) : (
                  filteredCards.map((card) => {
                  const model = card.model;
                  const isChecked = syncCardSelected(card, selectedModelIds);
                  const isMain = modelCardContains(card, mainModelId);
                  const isOcr = modelCardContains(card, ocrModelId);

                  const contextText = typeof model.contextWindow === "number" && Number.isFinite(model.contextWindow) && model.contextWindow > 0
                    ? t("ai_providers:detail.context_tokens", { tokens: model.contextWindow.toLocaleString(i18n.language) })
                    : null;

                  return (
                    <DiscoveredModelCard
                      key={card.key}
                      data-testid={`model-card-${model.id}`}
                      selected={isChecked}
                      onClick={() => { if (!isSubmitting && !isLoadingDiscovery) applyCardSelection([card], !isChecked); }}
                      sx={{ cursor: "pointer" }}
                    >
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flex: 1 }}>
                        <Checkbox
                          checked={isChecked}
                          onChange={() => applyCardSelection([card], !isChecked)}
                          onClick={(e) => e.stopPropagation()}
                          disabled={isSubmitting || isLoadingDiscovery}
                          slotProps={{ input: { "aria-label": card.label } }}
                          size="small"
                          color="primary"
                          sx={{ p: 0.5 }}
                        />

                        <ModelInfoBox>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                              {card.label}
                            </Typography>
                            {model.isRecommended && (
                              <Chip
                                size="small"
                                icon={<StarOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                                label={t(
                                  "ai_providers:modal_sync_models.badge_recommended",
                                  "Recomendado"
                                )}
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 600 }}
                              />
                            )}
                            {isMain && (
                              <Chip
                                size="small"
                                icon={<PsychologyOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                                label={t(
                                  "ai_providers:modal_sync_models.badge_default",
                                  "Predeterminado"
                                )}
                                color="success"
                                sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700 }}
                              />
                            )}
                            {isOcr && (
                              <Chip
                                size="small"
                                icon={<DocumentScannerOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                                label={t(
                                  "ai_providers:modal_sync_models.badge_ocr",
                                  "Foco OCR"
                                )}
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

                          {card.preferenceConflicts.map(conflict => <Alert key={conflict.modelId} severity="warning">
                            {t("ai_providers:detail.variant_preference_conflict", {
                              model: conflict.modelId,
                              effort: typeof conflict.savedPreference === "string" ? conflict.savedPreference : t("ai_providers:detail.invalid_saved_preference"),
                            })}
                          </Alert>)}

                          <BadgesRow>
                            {contextText && <Chip
                              size="small"
                              label={contextText}
                              variant="outlined"
                              sx={{ height: 20, fontSize: "0.68rem" }}
                            />}
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
                }))}
              </ModelsScrollContainer>

              {/* VERTICAL ROLE ASSIGNMENTS STACK */}
              <RoleAssignmentBox>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <PsychologyOutlinedIcon color="primary" sx={{ fontSize: 20 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {t(
                        "ai_providers:modal_sync_models.main_model_section",
                        "Asignación de roles de modelo"
                      )}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {t(
                      "ai_providers:modal_sync_models.main_model_section_desc",
                      "Configura qué modelo asumirá cada función en el sistema. El modelo por defecto es obligatorio, los demás son opcionales."
                    )}
                  </Typography>
                </Box>

                <RolesVerticalStack>
                  {/* ROLE 1: DEFAULT MODEL (STRICTLY REQUIRED) */}
                  <RoleCard>
                    <RoleCardHeader>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <StarOutlinedIcon color="primary" sx={{ fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t(
                            "ai_providers:modal_sync_models.main_model_label",
                            "Modelo Principal por Defecto"
                          )}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={t(
                          "ai_providers:modal_sync_models.badge_required",
                          "Obligatorio"
                        )}
                        color="primary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 700 }}
                      />
                    </RoleCardHeader>

                    <Typography variant="caption" color="text.secondary">
                      {t(
                        "ai_providers:modal_sync_models.main_model_helper",
                        "Modelo que ejecutará las tareas principales e inferencias generales del sistema."
                      )}
                    </Typography>

                    <SelectSingleInput
                      placeholder={t(
                        "ai_providers:modal_sync_models.main_model_placeholder",
                        "Seleccionar modelo por defecto..."
                      )}
                      value={mainModelId}
                      onChange={(val) => {
                        if (val === mainModelId) return;
                        setMainModelId(val ?? "");
                        setMainNeedsEffort(Boolean(modelCards.find(card => modelCardContains(card, val))?.variants.length));
                      }}
                      options={checkedModelOptions}
                      disabled={checkedModelOptions.length === 0 || isSubmitting || isLoadingDiscovery}
                      clearable={false}
                      required
                    />
                    {roleEffortControl(mainCard, mainModelId, true)}
                  </RoleCard>

                  {/* ROLE 2: OCR FOCUSED MODEL (OPTIONAL, STARTS IN NULL) */}
                  <RoleCard>
                    <RoleCardHeader>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <DocumentScannerOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {t(
                            "ai_providers:modal_sync_models.ocr_model_label",
                            "Modelo Enfocado en OCR"
                          )}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={t(
                          "ai_providers:modal_sync_models.badge_optional",
                          "Opcional"
                        )}
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.6875rem", fontWeight: 500 }}
                      />
                    </RoleCardHeader>

                    <Typography variant="caption" color="text.secondary">
                      {t(
                        "ai_providers:modal_sync_models.ocr_model_helper",
                        "Modelo especializado en extracción y lectura de facturas. Si no se selecciona, se usará el modelo por defecto."
                      )}
                    </Typography>

                    <SelectSingleInput
                      placeholder={t(
                        "ai_providers:modal_sync_models.ocr_model_placeholder",
                        "Seleccionar modelo para OCR (Opcional)..."
                      )}
                      value={ocrModelId}
                      onChange={(val) => {
                        if (val === ocrModelId) return;
                        setOcrModelId(val ?? "");
                        setOcrNeedsEffort(Boolean(modelCards.find(card => modelCardContains(card, val))?.variants.length));
                      }}
                      options={ocrOptions}
                      disabled={checkedModelOptions.length === 0 || isSubmitting || isLoadingDiscovery}
                      clearable
                    />
                    {roleEffortControl(ocrCard, ocrModelId, false)}
                  </RoleCard>
                </RolesVerticalStack>
              </RoleAssignmentBox>
            </>
          )}
        </ModalContentContainer>
      </form>
    </BaseModal>
  );
};

export default function SyncModelsModal(props: SyncModelsModalProps) {
  const mode = props.mode ?? props.provider?.default_mode ?? props.provider?.mode;
  // Discard discovery callbacks and drafts from an earlier connection/mode/opening.
  return <SyncModelsEditor key={JSON.stringify([props.provider?.id, mode, props.open])} {...props} />;
}
