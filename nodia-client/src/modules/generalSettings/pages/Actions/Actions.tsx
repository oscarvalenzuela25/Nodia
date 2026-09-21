import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Chip,
  Button,
  IconButton,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  LinearProgress,
  Alert,
  AlertTitle,
  TablePagination,
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Skeleton } from "boneyard-js/react";
import { sileo } from "sileo";

import Filter from "../../../../components/Filter";
import FilterChips from "../../../../components/Filter/components/FilterChips";
import InputSearch from "../../../../components/inputs/InputSearch";
import SelectMultipleInput from "../../../../components/inputs/SelectMultipleInput";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import ActionModal from "./components/ActionModal";
import BusinessActionModal from "./components/BusinessActionModal";
import {
  useActions,
  useCreateAction,
  useUpdateAction,
  useBusinessActions,
  useCreateBusinessAction,
  useUpdateBusinessAction,
  useDeleteBusinessAction,
} from "./infrastructure/useServices";
import type {
  ActionItem,
  ActionFormData,
  Action,
  BusinessAction,
  BusinessActionFormData,
} from "./types";
import {
  PageHeader,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  HeaderRow,
  ViewModeContainer,
  BusinessSectionCard,
  BusinessSectionHeader,
  BusinessHeaderInfo,
  BusinessHeaderActions,
  FilterRow,
  ActiveFilters,
  TableTopBar,
  StyledTableContainer,
  KeyBadge,
  DescriptionTypography,
} from "./styles";

type ViewMode = "split" | "system" | "business";

const Actions: FC = () => {
  const { t, i18n } = useTranslation(["actions", "core"]);

  // Perspective view mode: split, system, business
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [isBusinessExpanded, setIsBusinessExpanded] = useState<boolean>(true);

  // Search and Pagination for System Actions
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  // Search and Pagination for Business Actions
  const [searchTermBusiness, setSearchTermBusiness] = useState<string>("");
  const [pageBusiness, setPageBusiness] = useState<number>(0);
  const [rowsPerPageBusiness, setRowsPerPageBusiness] = useState<number>(10);

  // Filter modal draft state for System Actions
  const [draftFilterActionKeys, setDraftFilterActionKeys] = useState<string[]>(
    []
  );
  const [draftFilterActive, setDraftFilterActive] = useState<boolean>(true);

  // Applied filter state for System Actions
  const [appliedFilterActionKeys, setAppliedFilterActionKeys] = useState<
    string[]
  >([]);
  const [appliedFilterActive, setAppliedFilterActive] = useState<
    boolean | null
  >(null);

  // System Action Create / Edit Modal state
  const [isActionModalOpen, setIsActionModalOpen] = useState<boolean>(false);
  const [selectedActionForEdit, setSelectedActionForEdit] =
    useState<ActionFormData | null>(null);

  // Business Action Create / Edit Modal state
  const [isBusinessModalOpen, setIsBusinessModalOpen] =
    useState<boolean>(false);
  const [selectedBusinessActionForEdit, setSelectedBusinessActionForEdit] =
    useState<BusinessActionFormData | null>(null);

  // System Table row actions menu
  const [actionMenuAnchor, setActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetAction, setTargetAction] = useState<ActionItem | null>(null);

  // Business Table row actions menu
  const [businessActionMenuAnchor, setBusinessActionMenuAnchor] =
    useState<HTMLButtonElement | null>(null);
  const [targetBusinessAction, setTargetBusinessAction] =
    useState<BusinessAction | null>(null);

  // Confirm Active / Inactive Dialog state for System Actions
  const [actionToToggle, setActionToToggle] = useState<ActionItem | null>(null);
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] =
    useState<boolean>(false);

  // Confirm Active / Inactive Dialog state for Business Actions
  const [businessActionToToggle, setBusinessActionToToggle] =
    useState<BusinessAction | null>(null);
  const [isConfirmToggleBusinessOpen, setIsConfirmToggleBusinessOpen] =
    useState<boolean>(false);

  // Confirm Delete Dialog state for Business Actions
  const [businessActionToDelete, setBusinessActionToDelete] =
    useState<BusinessAction | null>(null);
  const [isConfirmDeleteBusinessOpen, setIsConfirmDeleteBusinessOpen] =
    useState<boolean>(false);

  // System Mutations
  const createActionMutation = useCreateAction();
  const updateActionMutation = useUpdateAction();
  const isMutatingSystem =
    createActionMutation.isPending || updateActionMutation.isPending;

  // Business Mutations
  const createBusinessActionMutation = useCreateBusinessAction();
  const updateBusinessActionMutation = useUpdateBusinessAction();
  const deleteBusinessActionMutation = useDeleteBusinessAction();
  const isMutatingBusiness =
    createBusinessActionMutation.isPending ||
    updateBusinessActionMutation.isPending ||
    deleteBusinessActionMutation.isPending;

  const showSystem = viewMode === "split" || viewMode === "system";
  const showBusiness = viewMode === "split" || viewMode === "business";

  // Build Ransack query for System Actions
  const ransackQuery = useMemo(() => {
    const q: Record<string, unknown> = {};
    if (searchTerm.trim()) {
      q.key_cont = searchTerm.trim();
    }
    if (appliedFilterActive !== null) {
      q.is_active_eq = appliedFilterActive;
    }
    if (appliedFilterActionKeys.length > 0) {
      q.key_in = appliedFilterActionKeys;
    }
    return q;
  }, [searchTerm, appliedFilterActive, appliedFilterActionKeys]);

  // Query: All system actions for filter dropdowns (all=true, includes=true)
  const {
    data: allActionsResponse,
    isLoading: isLoadingAllActions,
    isFetching: isFetchingAllActions,
  } = useActions({ all: true, includes: true }, { enabled: showSystem });

  // Query: Paginated system actions with includes
  const {
    data: actionsResponse,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useActions(
    {
      page: page + 1,
      size: rowsPerPage,
      includes: true,
      q: Object.keys(ransackQuery).length > 0 ? ransackQuery : undefined,
    },
    { enabled: showSystem }
  );

  // Build Ransack query for Business Actions
  const ransackQueryBusiness = useMemo(() => {
    const q: Record<string, unknown> = {};
    if (searchTermBusiness.trim()) {
      q.key_cont = searchTermBusiness.trim();
    }
    return q;
  }, [searchTermBusiness]);

  // Query: Paginated business actions
  const {
    data: businessActionsResponse,
    isLoading: isLoadingBusiness,
    isFetching: isFetchingBusiness,
    isError: isErrorBusiness,
    error: errorBusiness,
    refetch: refetchBusiness,
  } = useBusinessActions(
    {
      page: pageBusiness + 1,
      size: rowsPerPageBusiness,
      q:
        Object.keys(ransackQueryBusiness).length > 0
          ? ransackQueryBusiness
          : undefined,
    },
    { enabled: showBusiness }
  );

  const actions: ActionItem[] = useMemo(() => {
    if (actionsResponse?.data) {
      return actionsResponse.data.map((a: Action) => {
        const keyTrans = a.translates?.find((t) => t.key === "key");
        const commentTrans = a.translates?.find((t) => t.key === "comment");
        const nameTranslations = keyTrans
          ? { es: keyTrans.es, en: keyTrans.en }
          : undefined;
        const descriptionTranslations = commentTrans
          ? { es: commentTrans.es, en: commentTrans.en }
          : undefined;
        const lang = i18n.language?.startsWith("en") ? "en" : "es";
        const altLang = lang === "en" ? "es" : "en";
        const description =
          commentTrans?.[lang] ||
          commentTrans?.[altLang] ||
          a.description ||
          null;
        const name =
          keyTrans?.[lang] ||
          keyTrans?.[altLang] ||
          (i18n.exists(`actions:action_names.${a.key}`)
            ? t(`actions:action_names.${a.key}`)
            : null);

        return {
          id: a.id,
          name,
          key: a.key,
          nameTranslations,
          descriptionTranslations,
          description,
          isActive: a.is_active ?? true,
          translates: a.translates,
        };
      });
    }
    return [];
  }, [actionsResponse, t, i18n]);

  const totalItems = useMemo(() => {
    return actionsResponse?.meta?.total_items ?? actions.length;
  }, [actionsResponse, actions.length]);

  const businessActionsList: BusinessAction[] = useMemo(() => {
    return businessActionsResponse?.data ?? [];
  }, [businessActionsResponse?.data]);

  const totalBusinessItems = useMemo(() => {
    return (
      businessActionsResponse?.meta?.total_items ?? businessActionsList.length
    );
  }, [businessActionsResponse, businessActionsList.length]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleChangePageBusiness = (_: unknown, newPage: number) => {
    setPageBusiness(newPage);
  };

  const handleChangeRowsPerPageBusiness = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPageBusiness(parseInt(event.target.value, 10));
    setPageBusiness(0);
  };

  const actionFilterOptions = useMemo(() => {
    const sourceActions =
      allActionsResponse?.data ?? actionsResponse?.data ?? [];
    return sourceActions.map((a: Action) => {
      const keyTrans = a.translates?.find((t) => t.key === "key");
      const lang = i18n.language?.startsWith("en") ? "en" : "es";
      const altLang = lang === "en" ? "es" : "en";
      const name =
        keyTrans?.[lang] ||
        keyTrans?.[altLang] ||
        (i18n.exists(`actions:action_names.${a.key}`)
          ? t(`actions:action_names.${a.key}`)
          : null);
      const label = name ? `${name} (${a.key})` : a.key;
      return {
        value: a.key,
        label,
      };
    });
  }, [allActionsResponse?.data, actionsResponse?.data, t, i18n]);

  // System Action Menu Handlers
  const handleOpenActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    action: ActionItem
  ) => {
    setActionMenuAnchor(e.currentTarget);
    setTargetAction(action);
  };

  const handleCloseActionMenu = () => {
    setActionMenuAnchor(null);
    setTargetAction(null);
  };

  const handleOpenCreateModal = () => {
    setSelectedActionForEdit(null);
    setIsActionModalOpen(true);
  };

  const handleOpenEditModal = () => {
    if (targetAction) {
      const keyTrans = targetAction.translates?.find((t) => t.key === "key");
      const commentTrans = targetAction.translates?.find(
        (t) => t.key === "comment"
      );
      setSelectedActionForEdit({
        id: targetAction.id,
        key: targetAction.key,
        nameTranslations: targetAction.nameTranslations ?? {
          es: keyTrans?.es ?? "",
          en: keyTrans?.en ?? "",
        },
        descriptionTranslations: targetAction.descriptionTranslations ?? {
          es: commentTrans?.es ?? "",
          en: commentTrans?.en ?? "",
        },
        description: targetAction.description,
        isActive: targetAction.isActive,
        translates: targetAction.translates,
      });
      setIsActionModalOpen(true);
    }
    handleCloseActionMenu();
  };

  // Business Action Menu Handlers
  const handleOpenBusinessActionMenu = (
    e: MouseEvent<HTMLButtonElement>,
    action: BusinessAction
  ) => {
    setBusinessActionMenuAnchor(e.currentTarget);
    setTargetBusinessAction(action);
  };

  const handleCloseBusinessActionMenu = () => {
    setBusinessActionMenuAnchor(null);
    setTargetBusinessAction(null);
  };

  const handleOpenCreateBusinessModal = () => {
    setSelectedBusinessActionForEdit(null);
    setIsBusinessModalOpen(true);
  };

  const handleOpenEditBusinessModal = () => {
    if (targetBusinessAction) {
      const keyTrans = targetBusinessAction.translates?.find(
        (t) => t.key === "key"
      );
      const descTrans = targetBusinessAction.translates?.find(
        (t) => t.key === "description" || t.key === "comment"
      );
      setSelectedBusinessActionForEdit({
        id: targetBusinessAction.id,
        key: targetBusinessAction.key,
        is_active: targetBusinessAction.is_active ?? true,
        has_description: targetBusinessAction.has_description ?? false,
        nameTranslations: {
          es: keyTrans?.es ?? "",
          en: keyTrans?.en ?? "",
        },
        descriptionTranslations: {
          es: descTrans?.es ?? "",
          en: descTrans?.en ?? "",
        },
        translates: targetBusinessAction.translates,
      });
      setIsBusinessModalOpen(true);
    }
    handleCloseBusinessActionMenu();
  };

  // Submit System Action
  const handleSaveAction = async (data: ActionFormData) => {
    try {
      if (data.id) {
        await updateActionMutation.mutateAsync({
          actionId: data.id,
          payload: {
            key: data.key,
            is_active: data.isActive,
            translates: data.translates,
          },
        });
      } else {
        await createActionMutation.mutateAsync({
          key: data.key,
          is_active: data.isActive,
          translates: data.translates,
        });
      }
      setIsActionModalOpen(false);
      setSelectedActionForEdit(null);
    } catch {
      // Handled by mutation onError sileo toast
    }
  };

  // Submit Business Action
  const handleSaveBusinessAction = async (data: BusinessActionFormData) => {
    try {
      if (data.id) {
        await updateBusinessActionMutation.mutateAsync({
          actionId: data.id,
          payload: {
            key: data.key,
            is_active: data.is_active,
            has_description: data.has_description,
            translates: data.translates,
          },
        });
      } else {
        await createBusinessActionMutation.mutateAsync({
          key: data.key,
          is_active: data.is_active,
          has_description: data.has_description,
          translates: data.translates,
        });
      }
      setIsBusinessModalOpen(false);
      setSelectedBusinessActionForEdit(null);
    } catch {
      // Handled by mutation onError sileo toast
    }
  };

  // Toggle active for System Action
  const handleRequestToggleActive = (action: ActionItem) => {
    setActionToToggle(action);
    setIsConfirmToggleOpen(true);
    handleCloseActionMenu();
  };

  const handleCloseConfirmToggle = () => {
    setIsConfirmToggleOpen(false);
    setActionToToggle(null);
  };

  const handleConfirmToggleActive = async () => {
    if (!actionToToggle) return;
    try {
      await updateActionMutation.mutateAsync({
        actionId: actionToToggle.id,
        payload: {
          is_active: !actionToToggle.isActive,
        },
      });
      setIsConfirmToggleOpen(false);
      setActionToToggle(null);
    } catch {
      // Handled by mutation onError sileo toast
    }
  };

  // Toggle active for Business Action
  const handleRequestToggleActiveBusiness = (action: BusinessAction) => {
    setBusinessActionToToggle(action);
    setIsConfirmToggleBusinessOpen(true);
    handleCloseBusinessActionMenu();
  };

  const handleCloseConfirmToggleBusiness = () => {
    setIsConfirmToggleBusinessOpen(false);
    setBusinessActionToToggle(null);
  };

  const handleConfirmToggleActiveBusiness = async () => {
    if (!businessActionToToggle) return;
    try {
      await updateBusinessActionMutation.mutateAsync({
        actionId: businessActionToToggle.id,
        payload: {
          is_active: !businessActionToToggle.is_active,
        },
      });
      setIsConfirmToggleBusinessOpen(false);
      setBusinessActionToToggle(null);
    } catch {
      // Handled by mutation onError sileo toast
    }
  };

  // Delete for Business Action
  const handleRequestDeleteBusiness = (action: BusinessAction) => {
    setBusinessActionToDelete(action);
    setIsConfirmDeleteBusinessOpen(true);
    handleCloseBusinessActionMenu();
  };

  const handleCloseConfirmDeleteBusiness = () => {
    setIsConfirmDeleteBusinessOpen(false);
    setBusinessActionToDelete(null);
  };

  const handleConfirmDeleteBusiness = async () => {
    if (!businessActionToDelete) return;
    try {
      await deleteBusinessActionMutation.mutateAsync(
        businessActionToDelete.id
      );
      setIsConfirmDeleteBusinessOpen(false);
      setBusinessActionToDelete(null);
    } catch {
      // Handled by mutation onError sileo toast
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    sileo.info({
      title: t("actions:copy"),
      description: t("actions:copied"),
    });
  };

  // Filter application for System Actions
  const handleApplyFilters = () => {
    setAppliedFilterActionKeys(draftFilterActionKeys);
    setAppliedFilterActive(draftFilterActive);
    setPage(0);
  };

  const handleClearFilters = () => {
    setDraftFilterActionKeys([]);
    setDraftFilterActive(true);
    setAppliedFilterActionKeys([]);
    setAppliedFilterActive(null);
    setPage(0);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (appliedFilterActionKeys.length > 0)
      count += appliedFilterActionKeys.length;
    if (appliedFilterActive !== null) count += 1;
    return count;
  }, [appliedFilterActionKeys, appliedFilterActive]);

  // Business Action helper functions
  const getBusinessActionDisplayName = (ba: BusinessAction) => {
    const lang = i18n.language?.startsWith("en") ? "en" : "es";
    const altLang = lang === "en" ? "es" : "en";
    const keyTrans = ba.translates?.find((tr) => tr.key === "key");
    return keyTrans?.[lang] || keyTrans?.[altLang] || ba.key;
  };

  const getBusinessActionDescription = (ba: BusinessAction) => {
    const lang = i18n.language?.startsWith("en") ? "en" : "es";
    const altLang = lang === "en" ? "es" : "en";
    const descTrans = ba.translates?.find(
      (tr) => tr.key === "description" || tr.key === "comment"
    );
    return descTrans?.[lang] || descTrans?.[altLang] || null;
  };

  const isBusySystem = isLoading || isFetching || isMutatingSystem;
  const isBusyBusiness =
    isLoadingBusiness || isFetchingBusiness || isMutatingBusiness;

  return (
    <Box>
      <HeaderRow>
        <PageHeader sx={{ mb: 0 }}>
          <PageTitleContainer>
            <BoltOutlinedIcon color="primary" fontSize="large" />
            <PageTitle>{t("actions:title")}</PageTitle>
          </PageTitleContainer>
          <PageSubtitle>{t("actions:subtitle")}</PageSubtitle>
        </PageHeader>

        <ViewModeContainer>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => {
              if (val) setViewMode(val as ViewMode);
            }}
            size="small"
            aria-label="perspective-view-mode"
            sx={{
              "& .MuiToggleButton-root": {
                border: "none",
                borderRadius: "8px !important",
                px: 1.5,
                py: 0.6,
                fontWeight: 600,
                fontSize: "0.8125rem",
                textTransform: "none",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                "&.Mui-selected": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                },
              },
            }}
          >
            <ToggleButton
              value="split"
              aria-label={t("actions:view_mode_split", "Vista Dividida")}
            >
              <ViewAgendaOutlinedIcon fontSize="small" />
              {t("actions:view_mode_split", "Vista Dividida")}
            </ToggleButton>
            <ToggleButton
              value="system"
              aria-label={t(
                "actions:view_mode_system",
                "Acciones del Sistema"
              )}
            >
              <BoltOutlinedIcon fontSize="small" />
              {t("actions:view_mode_system", "Acciones del Sistema")}
            </ToggleButton>
            <ToggleButton
              value="business"
              aria-label={t(
                "actions:view_mode_business",
                "Acciones de Negocio"
              )}
            >
              <StorefrontOutlinedIcon fontSize="small" />
              {t("actions:view_mode_business", "Acciones de Negocio")}
            </ToggleButton>
          </ToggleButtonGroup>
        </ViewModeContainer>
      </HeaderRow>

      {/* ========================================================================= */}
      {/* BUSINESS ACTIONS SECTION                                                  */}
      {/* ========================================================================= */}
      {showBusiness && (
        <BusinessSectionCard elevation={0}>
          <BusinessSectionHeader>
            <BusinessHeaderInfo>
              <StorefrontOutlinedIcon color="primary" />
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                    {t(
                      "actions:business_actions_title",
                      "Acciones de Negocio"
                    )}
                  </Typography>
                  <Chip
                    label={totalBusinessItems}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                      height: 20,
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                    }}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {t(
                    "actions:business_actions_subtitle",
                    "Catálogo de permisos asignables a colaboradores dentro de cada negocio."
                  )}
                </Typography>
              </Box>
            </BusinessHeaderInfo>

            <BusinessHeaderActions>
              <Box sx={{ width: { xs: "100%", sm: "240px" } }}>
                <InputSearch
                  value={searchTermBusiness}
                  onChange={(val) => {
                    setSearchTermBusiness(val);
                    setPageBusiness(0);
                  }}
                  placeholder={t(
                    "actions:search_business_actions_placeholder",
                    "Buscar acción de negocio..."
                  )}
                  fullWidth
                  disabled={isLoadingBusiness || isMutatingBusiness}
                />
              </Box>
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={<AddCircleOutlinedIcon />}
                onClick={handleOpenCreateBusinessModal}
                disabled={isBusyBusiness}
                sx={(theme) => ({
                  borderRadius: 2,
                  color: theme.palette.primary.contrastText,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                })}
              >
                {t("actions:new_business_action", "Nueva Acción de Negocio")}
              </Button>
              {viewMode === "split" && (
                <Tooltip
                  title={
                    isBusinessExpanded
                      ? t("core:collapse", "Colapsar")
                      : t("core:expand", "Expandir")
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => setIsBusinessExpanded((prev) => !prev)}
                    aria-label="toggle-business-collapse"
                  >
                    {isBusinessExpanded ? (
                      <ExpandLessIcon />
                    ) : (
                      <ExpandMoreIcon />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </BusinessHeaderActions>
          </BusinessSectionHeader>

          <Collapse in={viewMode === "business" || isBusinessExpanded}>
            {isErrorBusiness && (
              <Box sx={{ p: 2 }}>
                <Alert
                  severity="error"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => refetchBusiness()}
                    >
                      {t("core:retry", "Reintentar")}
                    </Button>
                  }
                >
                  <AlertTitle>
                    {t(
                      "actions:error_state.title",
                      "Error al cargar las acciones"
                    )}
                  </AlertTitle>
                  {errorBusiness instanceof Error
                    ? errorBusiness.message
                    : t("core:server_error_toast")}
                </Alert>
              </Box>
            )}

            <Skeleton
              loading={isLoadingBusiness}
              name="business-actions-table"
            >
              {isFetchingBusiness && !isLoadingBusiness && (
                <LinearProgress sx={{ height: 2 }} />
              )}
              <TableContainer component={Paper} elevation={0}>
                <Table size="small">
                  <TableHead
                    sx={{
                      bgcolor: "action.hover",
                      "& th": {
                        fontWeight: "bold",
                        color: "text.primary",
                      },
                    }}
                  >
                    <TableRow>
                      <TableCell>{t("actions:table.id")}</TableCell>
                      <TableCell>{t("actions:table.name")}</TableCell>
                      <TableCell>{t("actions:table.key")}</TableCell>
                      <TableCell>{t("actions:table.description")}</TableCell>
                      <TableCell>{t("actions:table.active")}</TableCell>
                      <TableCell align="center">
                        {t("actions:table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoadingBusiness && businessActionsList.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          align="center"
                          sx={{ py: 5, color: "text.secondary" }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <StorefrontOutlinedIcon
                              sx={{ fontSize: 40, color: "text.disabled" }}
                            />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {t(
                                "actions:empty_state.title",
                                "No hay acciones disponibles"
                              )}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{ maxWidth: 380 }}
                            >
                              {t(
                                "actions:empty_state.description",
                                "No se encontraron acciones actualmente. Comience agregando una nueva."
                              )}
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AddCircleOutlinedIcon />}
                              onClick={handleOpenCreateBusinessModal}
                              disabled={isBusyBusiness}
                              sx={{ mt: 1 }}
                            >
                              {t(
                                "actions:empty_state.cta",
                                "Crear primera acción"
                              )}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      businessActionsList.map((ba) => {
                        const displayName = getBusinessActionDisplayName(ba);
                        const displayDesc = getBusinessActionDescription(ba);
                        const isActive = ba.is_active ?? true;

                        return (
                          <TableRow
                            key={ba.id}
                            hover
                            sx={{
                              "&:last-child td, &:last-child th": { border: 0 },
                            }}
                          >
                            <TableCell
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.8125rem",
                                fontFamily: "monospace",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                {ba.id.includes("-")
                                  ? `${ba.id.split("-")[0]}...`
                                  : ba.id}
                                <Tooltip
                                  title={t("actions:copy")}
                                  arrow
                                  placement="top"
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyId(ba.id)}
                                    aria-label={t("actions:copy")}
                                    disabled={isBusyBusiness}
                                  >
                                    <ContentCopyIcon
                                      fontSize="small"
                                      sx={{ fontSize: "0.875rem" }}
                                    />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 600 }}
                              >
                                {displayName}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <KeyBadge>{ba.key}</KeyBadge>
                            </TableCell>
                            <TableCell>
                              {displayDesc ? (
                                <DescriptionTypography>
                                  {displayDesc}
                                </DescriptionTypography>
                              ) : (
                                t("actions:empty_value", "-")
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  isActive
                                    ? t("actions:yes")
                                    : t("actions:no")
                                }
                                color={isActive ? "success" : "error"}
                                size="small"
                                variant={isActive ? "filled" : "outlined"}
                                sx={
                                  isActive
                                    ? {
                                        color: "success.contrastText",
                                        height: 22,
                                        fontSize: "0.75rem",
                                      }
                                    : { height: 22, fontSize: "0.75rem" }
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={t("actions:table.actions")}
                                onClick={(e) =>
                                  handleOpenBusinessActionMenu(e, ba)
                                }
                                disabled={isBusyBusiness}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalBusinessItems}
                page={pageBusiness}
                onPageChange={handleChangePageBusiness}
                rowsPerPage={rowsPerPageBusiness}
                onRowsPerPageChange={handleChangeRowsPerPageBusiness}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage={t("core:pagination.rows_per_page")}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} ${t("core:pagination.of")} ${
                    count !== -1
                      ? count
                      : `${t("core:pagination.more_than")} ${to}`
                  }`
                }
              />
            </Skeleton>
          </Collapse>
        </BusinessSectionCard>
      )}

      {/* ========================================================================= */}
      {/* SYSTEM ACTIONS SECTION                                                    */}
      {/* ========================================================================= */}
      {showSystem && (
        <Box>
          <FilterRow>
            <Filter
              onFilter={handleApplyFilters}
              onClear={handleClearFilters}
              activeCount={activeFiltersCount}
              title={t("actions:filter_modal_title")}
              subtitle={t("actions:filter_modal_subtitle")}
            >
              <SelectMultipleInput
                label={t("actions:table.key")}
                options={actionFilterOptions}
                value={draftFilterActionKeys}
                onChange={setDraftFilterActionKeys}
                placeholder={t("actions:form.key_placeholder")}
                disabled={
                  isLoadingAllActions ||
                  isFetchingAllActions ||
                  isMutatingSystem
                }
              />

              <Box
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.5,
                  borderRadius: 1.5,
                  border: `1px solid ${
                    theme.palette.border?.default ?? theme.palette.divider
                  }`,
                })}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={draftFilterActive}
                      onChange={(e) => setDraftFilterActive(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={t("actions:form.active")}
                  labelPlacement="start"
                  sx={{ m: 0, width: "100%", justifyContent: "space-between" }}
                />
              </Box>
            </Filter>
          </FilterRow>

          {activeFiltersCount > 0 && (
            <ActiveFilters>
              {appliedFilterActionKeys.map((actionKey) => {
                const matched = (
                  allActionsResponse?.data ?? actionsResponse?.data
                )?.find((a) => a.key === actionKey);
                const keyTrans = matched?.translates?.find(
                  (t) => t.key === "key"
                );
                const lang = i18n.language?.startsWith("en") ? "en" : "es";
                const altLang = lang === "en" ? "es" : "en";
                const name =
                  keyTrans?.[lang] ||
                  keyTrans?.[altLang] ||
                  (i18n.exists(`actions:action_names.${actionKey}`)
                    ? t(`actions:action_names.${actionKey}`)
                    : null);
                const actLabel = name ? `${name} (${actionKey})` : actionKey;
                return (
                  <FilterChips
                    key={`action-${actionKey}`}
                    label={t("actions:filter_chips.action", {
                      value: actLabel,
                    })}
                    onAction={() => {
                      setAppliedFilterActionKeys((prev) =>
                        prev.filter((k) => k !== actionKey)
                      );
                      setPage(0);
                    }}
                  />
                );
              })}
              {appliedFilterActive !== null && (
                <FilterChips
                  label={
                    appliedFilterActive
                      ? t("actions:filter_chips.active_only")
                      : t("actions:no")
                  }
                  onAction={() => {
                    setAppliedFilterActive(null);
                    setPage(0);
                  }}
                />
              )}
            </ActiveFilters>
          )}

          {isError && (
            <Box sx={{ mb: 2.5 }}>
              <Alert
                severity="error"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => refetch()}
                  >
                    {t("core:retry", "Reintentar")}
                  </Button>
                }
              >
                <AlertTitle>
                  {t(
                    "actions:error_state.title",
                    "Error al cargar las acciones"
                  )}
                </AlertTitle>
                {error instanceof Error
                  ? error.message
                  : t(
                      "actions:error_state.description",
                      "No se pudo obtener el listado de acciones desde el servidor."
                    )}
              </Alert>
            </Box>
          )}

          <TableTopBar>
            <Box sx={{ width: { xs: "100%", sm: "360px" } }}>
              <InputSearch
                value={searchTerm}
                onChange={(val) => {
                  setSearchTerm(val);
                  setPage(0);
                }}
                placeholder={t("actions:search_placeholder")}
                fullWidth
                disabled={isLoading || isMutatingSystem}
              />
            </Box>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlinedIcon />}
              onClick={handleOpenCreateModal}
              disabled={isBusySystem}
              sx={(theme) => ({
                borderRadius: 2,
                color: theme.palette.primary.contrastText,
              })}
            >
              {t("actions:new_action")}
            </Button>
          </TableTopBar>

          <Skeleton loading={isLoading} name="actions-table">
            <StyledTableContainer>
              {isFetching && !isLoading && (
                <LinearProgress
                  sx={{
                    height: 3,
                  }}
                />
              )}
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead
                    sx={{
                      bgcolor: "primary.main",
                      "& th": {
                        color: "primary.contrastText",
                        fontWeight: "bold",
                      },
                    }}
                  >
                    <TableRow>
                      <TableCell>{t("actions:table.id")}</TableCell>
                      <TableCell>{t("actions:table.name")}</TableCell>
                      <TableCell>{t("actions:table.key")}</TableCell>
                      <TableCell>{t("actions:table.description")}</TableCell>
                      <TableCell>{t("actions:table.active")}</TableCell>
                      <TableCell align="center">
                        {t("actions:table.actions")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && actions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          align="center"
                          sx={{ py: 6, color: "text.secondary" }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 1.5,
                            }}
                          >
                            <BoltOutlinedIcon
                              sx={{ fontSize: 48, color: "text.disabled" }}
                            />
                            <Typography variant="h6" color="text.secondary">
                              {t(
                                "actions:empty_state.title",
                                "No hay acciones disponibles"
                              )}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.disabled"
                              sx={{ maxWidth: 400 }}
                            >
                              {t(
                                "actions:empty_state.description",
                                "No se encontraron acciones actualmente. Comience agregando una nueva."
                              )}
                            </Typography>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<AddCircleOutlinedIcon />}
                              onClick={handleOpenCreateModal}
                              disabled={isBusySystem}
                              sx={{ mt: 1 }}
                            >
                              {t(
                                "actions:empty_state.cta",
                                "Crear primera acción"
                              )}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      actions.map((act) => {
                        return (
                          <TableRow
                            key={act.id}
                            hover
                            sx={{
                              "&:last-child td, &:last-child th": { border: 0 },
                            }}
                          >
                            <TableCell
                              sx={{
                                color: "text.secondary",
                                fontSize: "0.875rem",
                                fontFamily: "monospace",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                {act.id.includes("-")
                                  ? `${act.id.split("-")[0]}...`
                                  : act.id}
                                <Tooltip
                                  title={t("actions:copy")}
                                  arrow
                                  placement="top"
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyId(act.id)}
                                    aria-label={t("actions:copy")}
                                    disabled={isBusySystem}
                                  >
                                    <ContentCopyIcon
                                      fontSize="small"
                                      sx={{ fontSize: "1rem" }}
                                    />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: "medium" }}
                              >
                                {act.name || t("actions:empty_value", "-")}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <KeyBadge>{act.key}</KeyBadge>
                            </TableCell>
                            <TableCell>
                              {act.description ? (
                                <DescriptionTypography>
                                  {act.description}
                                </DescriptionTypography>
                              ) : (
                                t("actions:empty_value")
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={
                                  act.isActive
                                    ? t("actions:yes")
                                    : t("actions:no")
                                }
                                color={act.isActive ? "success" : "error"}
                                size="small"
                                variant={act.isActive ? "filled" : "outlined"}
                                sx={
                                  act.isActive
                                    ? { color: "success.contrastText" }
                                    : {}
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                color="primary"
                                aria-label={t("actions:table.actions")}
                                onClick={(e) => handleOpenActionMenu(e, act)}
                                disabled={isBusySystem}
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalItems}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage={t("core:pagination.rows_per_page")}
                labelDisplayedRows={({ from, to, count }) =>
                  `${from}–${to} ${t("core:pagination.of")} ${
                    count !== -1
                      ? count
                      : `${t("core:pagination.more_than")} ${to}`
                  }`
                }
              />
            </StyledTableContainer>
          </Skeleton>
        </Box>
      )}

      {/* System Row Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 140,
              boxShadow: theme.shadows[3],
              border: `1px solid ${
                theme.palette.border?.default ?? theme.palette.divider
              }`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              p: 1,
            },
          },
        }}
      >
        <MenuItem onClick={handleOpenEditModal} sx={{ borderRadius: 1 }}>
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("actions:actions_menu.update")} />
        </MenuItem>
        {targetAction && (
          <MenuItem
            onClick={() => handleRequestToggleActive(targetAction)}
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon>
              {targetAction.isActive ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon
                  fontSize="small"
                  color="success"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                targetAction.isActive
                  ? t("actions:deactivate")
                  : t("actions:activate")
              }
            />
          </MenuItem>
        )}
      </Menu>

      {/* Business Row Actions Menu */}
      <Menu
        anchorEl={businessActionMenuAnchor}
        open={Boolean(businessActionMenuAnchor)}
        onClose={handleCloseBusinessActionMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: (theme) => ({
              borderRadius: 2,
              minWidth: 160,
              boxShadow: theme.shadows[3],
              border: `1px solid ${
                theme.palette.border?.default ?? theme.palette.divider
              }`,
            }),
          },
          list: {
            sx: {
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              p: 1,
            },
          },
        }}
      >
        <MenuItem
          onClick={handleOpenEditBusinessModal}
          sx={{ borderRadius: 1 }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("actions:actions_menu.update")} />
        </MenuItem>
        {targetBusinessAction && (
          <MenuItem
            onClick={() =>
              handleRequestToggleActiveBusiness(targetBusinessAction)
            }
            sx={{ borderRadius: 1 }}
          >
            <ListItemIcon>
              {targetBusinessAction.is_active ? (
                <BlockOutlinedIcon fontSize="small" color="error" />
              ) : (
                <CheckCircleOutlineOutlinedIcon
                  fontSize="small"
                  color="success"
                />
              )}
            </ListItemIcon>
            <ListItemText
              primary={
                targetBusinessAction.is_active
                  ? t("actions:deactivate")
                  : t("actions:activate")
              }
            />
          </MenuItem>
        )}
        {targetBusinessAction && (
          <MenuItem
            onClick={() =>
              handleRequestDeleteBusiness(targetBusinessAction)
            }
            sx={{ borderRadius: 1, color: "error.main" }}
          >
            <ListItemIcon>
              <DeleteOutlinedIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText primary={t("actions:delete", "Eliminar")} />
          </MenuItem>
        )}
      </Menu>

      {/* Confirm Active / Inactive Dialog (System) */}
      <ConfirmDialog
        open={isConfirmToggleOpen}
        onClose={handleCloseConfirmToggle}
        onConfirm={handleConfirmToggleActive}
        isLoading={isMutatingSystem}
        title={
          actionToToggle?.isActive
            ? t("actions:confirm_deactivate_title")
            : t("actions:confirm_activate_title")
        }
        message={
          actionToToggle?.isActive
            ? t("actions:confirm_deactivate_message", {
                name: actionToToggle?.key,
              })
            : t("actions:confirm_activate_message", {
                name: actionToToggle?.key,
              })
        }
        confirmText={
          actionToToggle?.isActive
            ? t("actions:deactivate")
            : t("actions:activate")
        }
        cancelText={t("core:cancel")}
      />

      {/* Confirm Active / Inactive Dialog (Business) */}
      <ConfirmDialog
        open={isConfirmToggleBusinessOpen}
        onClose={handleCloseConfirmToggleBusiness}
        onConfirm={handleConfirmToggleActiveBusiness}
        isLoading={isMutatingBusiness}
        title={
          businessActionToToggle?.is_active
            ? t("actions:confirm_deactivate_title")
            : t("actions:confirm_activate_title")
        }
        message={
          businessActionToToggle?.is_active
            ? t("actions:confirm_deactivate_message", {
                name: businessActionToToggle?.key,
              })
            : t("actions:confirm_activate_message", {
                name: businessActionToToggle?.key,
              })
        }
        confirmText={
          businessActionToToggle?.is_active
            ? t("actions:deactivate")
            : t("actions:activate")
        }
        cancelText={t("core:cancel")}
      />

      {/* Confirm Delete Dialog (Business) */}
      <ConfirmDialog
        open={isConfirmDeleteBusinessOpen}
        onClose={handleCloseConfirmDeleteBusiness}
        onConfirm={handleConfirmDeleteBusiness}
        isLoading={isMutatingBusiness}
        title={t("actions:confirm_delete_title", "¿Eliminar acción de negocio?")}
        message={t(
          "actions:confirm_delete_message",
          `¿Está seguro de que desea eliminar permanentemente la acción "${businessActionToDelete?.key}"?`,
          { name: businessActionToDelete?.key }
        )}
        confirmText={t("actions:delete", "Eliminar")}
        cancelText={t("core:cancel")}
      />

      {/* System Action Create / Edit Modal */}
      <ActionModal
        open={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        onSubmit={handleSaveAction}
        initialData={selectedActionForEdit}
        isSubmitting={isMutatingSystem}
      />

      {/* Business Action Create / Edit Modal */}
      <BusinessActionModal
        open={isBusinessModalOpen}
        onClose={() => setIsBusinessModalOpen(false)}
        onSubmit={handleSaveBusinessAction}
        initialData={selectedBusinessActionForEdit}
        isSubmitting={isMutatingBusiness}
      />
    </Box>
  );
};

export default Actions;
