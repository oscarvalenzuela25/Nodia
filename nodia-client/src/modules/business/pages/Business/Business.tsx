import type { FC, MouseEvent } from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddCircleOutlinedIcon from "@mui/icons-material/AddCircleOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import { Skeleton } from "boneyard-js/react";
import { useIsMutating } from "@tanstack/react-query";

import InputSearch from "../../../../components/inputs/InputSearch";
import ConfirmDialog from "../../../../components/ConfirmDialog";
import BusinessModal from "./components/BusinessModal";
import BusinessCollaboratorModal from "./components/BusinessCollaboratorModal";
import {
  useBusinesses,
  useCreateBusiness,
  useUpdateBusiness,
} from "../../infrastructure/useServices";
import type { BusinessEntity, BusinessFormData } from "../../infrastructure/types";
import { getTranslatedName } from "../../../../store/generalSettings/helpers";
import useAuthStore from "../../../../store/authStore";
import {
  PageHeader,
  HeaderTopBar,
  PageTitleContainer,
  PageTitle,
  PageSubtitle,
  FilterBar,
  CardsGrid,
  BusinessCard,
  CardHeader,
  TitleAndStatus,
  StatusDot,
  BusinessName,
  DescriptionLine,
  ChipsContainer,
  CardFooter,
  EmptyStateContainer,
} from "./styles";

const LOREM_PROVIDERS = [
  { name: "Nexus Distribución", color: "#0288d1", bg: "rgba(2, 136, 209, 0.08)" },
  { name: "Andina Logistics", color: "#2e7d32", bg: "rgba(46, 125, 50, 0.08)" },
  { name: "Global Imports", color: "#ed6c02", bg: "rgba(237, 108, 2, 0.08)" },
];

const Business: FC = () => {
  const { t, i18n } = useTranslation(["business", "core"]);
  const navigate = useNavigate();
  const lang = i18n.language || "es";
  const currentUserId = useAuthStore((state) => state.user?.id);

  // Filter and Search state (defaults to active only as requested)
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">(
    "active"
  );

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<BusinessEntity | null>(
    null
  );
  const [collaboratorBusiness, setCollaboratorBusiness] =
    useState<BusinessEntity | null>(null);

  // Confirm dialog state for activation / deactivation
  const [confirmToggleBusiness, setConfirmToggleBusiness] =
    useState<BusinessEntity | null>(null);

  // Card menu anchor state
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [menuBusiness, setMenuBusiness] = useState<BusinessEntity | null>(null);

  // Mutations
  const createMutation = useCreateBusiness();
  const updateMutation = useUpdateBusiness();
  const isMutating = useIsMutating() > 0;

  // Query parameters with Ransack
  const queryParams = useMemo(() => {
    const q: Record<string, string | boolean> = {};
    if (searchTerm.trim()) {
      q.name_cont = searchTerm.trim();
    }
    if (statusFilter === "active") {
      q.is_active_eq = true;
    } else if (statusFilter === "inactive") {
      q.is_active_eq = false;
    }
    return { all: true, q };
  }, [searchTerm, statusFilter]);

  const {
    data: businessesResponse,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useBusinesses(queryParams);

  const businesses = businessesResponse?.data ?? [];
  const isBusy = isLoading || isFetching || isMutating;

  // Menu handlers
  const handleOpenMenu = (
    event: MouseEvent<HTMLButtonElement>,
    business: BusinessEntity
  ) => {
    event.stopPropagation();
    const isOwner =
      business.user_role === "owner" ||
      (Boolean(currentUserId) &&
        String(business.owner_id) === String(currentUserId));
    if (!isOwner) return;
    setMenuAnchorEl(event.currentTarget);
    setMenuBusiness(business);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setMenuBusiness(null);
  };

  const handleOpenEdit = () => {
    if (menuBusiness) {
      setEditingBusiness(menuBusiness);
      handleCloseMenu();
    }
  };

  const handleOpenCollaborators = () => {
    if (menuBusiness) {
      setCollaboratorBusiness(menuBusiness);
      handleCloseMenu();
    }
  };

  const handleOpenToggleStatus = () => {
    if (menuBusiness) {
      setConfirmToggleBusiness(menuBusiness);
      handleCloseMenu();
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!confirmToggleBusiness) return;
    try {
      await updateMutation.mutateAsync({
        id: confirmToggleBusiness.id,
        payload: { is_active: !confirmToggleBusiness.is_active },
      });
      setConfirmToggleBusiness(null);
    } catch {
      // Do not close confirm dialog on error
    }
  };

  const handleCreateSubmit = async (data: BusinessFormData) => {
    try {
      await createMutation.mutateAsync({
        name: data.name,
        is_active: data.is_active ?? true,
        translates: data.translates,
      });
      setIsCreateModalOpen(false);
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  const handleUpdateSubmit = async (data: BusinessFormData) => {
    if (!editingBusiness) return;
    try {
      await updateMutation.mutateAsync({
        id: editingBusiness.id,
        payload: {
          name: data.name,
          is_active: data.is_active,
          translates: data.translates,
        },
      });
      setEditingBusiness(null);
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  return (
    <Box sx={{ maxWidth: 1400, mx: "auto" }}>
      {/* Soft loading indicator */}
      {(isFetching || isMutating) && !isLoading && (
        <LinearProgress
          sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1200 }}
        />
      )}

      {/* Header */}
      <PageHeader>
        <HeaderTopBar>
          <PageTitleContainer>
            <StorefrontOutlinedIcon
              color="primary"
              sx={{ fontSize: { xs: 32, md: 40 } }}
            />
            <PageTitle>{t("business:title")}</PageTitle>
          </PageTitleContainer>

          <Button
            variant="contained"
            color="primary"
            startIcon={<AddCircleOutlinedIcon />}
            onClick={() => setIsCreateModalOpen(true)}
            disabled={isBusy}
            sx={{ borderRadius: 2, px: 2.5, fontWeight: 600 }}
          >
            {t("business:new_business")}
          </Button>
        </HeaderTopBar>
        <PageSubtitle>{t("business:subtitle")}</PageSubtitle>
      </PageHeader>

      {/* Filter and Search Bar */}
      <FilterBar>
        <Box sx={{ width: { xs: "100%", sm: 340 } }}>
          <InputSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("business:search_placeholder")}
            disabled={isBusy}
            fullWidth
          />
        </Box>

        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, newStatus) => newStatus && setStatusFilter(newStatus)}
          size="small"
          disabled={isBusy}
          sx={{ borderRadius: 2 }}
        >
          <ToggleButton value="active">{t("business:status_active")}</ToggleButton>
          <ToggleButton value="inactive">{t("business:status_inactive")}</ToggleButton>
          <ToggleButton value="all">{t("business:all")}</ToggleButton>
        </ToggleButtonGroup>
      </FilterBar>

      {/* Error state */}
      {isError && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t("core:retry")}
            </Button>
          }
          sx={{ mb: 3 }}
        >
          {t("core:server_error_alert")}
        </Alert>
      )}

      {/* Cards Grid with Skeleton */}
      <Skeleton loading={isLoading}>
        {businesses.length === 0 && !isLoading ? (
          <EmptyStateContainer>
            <StorefrontOutlinedIcon
              sx={{ fontSize: 64, color: "text.disabled" }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t("business:empty_title")}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ maxWidth: 440 }}
            >
              {t("business:empty_description")}
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddCircleOutlinedIcon />}
              onClick={() => setIsCreateModalOpen(true)}
              sx={{ mt: 1, borderRadius: 2 }}
            >
              {t("business:create_first_business")}
            </Button>
          </EmptyStateContainer>
        ) : (
          <CardsGrid>
            {businesses.map((business) => {
              const descriptionText = getTranslatedName(
                business.translates,
                "",
                lang
              );
              const isOwner =
                business.user_role === "owner" ||
                (Boolean(currentUserId) &&
                  String(business.owner_id) === String(currentUserId));

              return (
                <BusinessCard
                  key={business.id}
                  onClick={() => navigate(`/business/${business.id}`)}
                  sx={{ cursor: "pointer" }}
                >
                  <CardHeader>
                    <TitleAndStatus>
                      <Tooltip
                        title={
                          business.is_active
                            ? t("business:status_active")
                            : t("business:status_inactive")
                        }
                      >
                        <StatusDot active={business.is_active} />
                      </Tooltip>
                      <BusinessName title={business.name}>
                        {business.name}
                      </BusinessName>
                    </TitleAndStatus>

                    {isOwner && (
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, business)}
                        aria-label={t("business:actions_menu")}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    )}
                  </CardHeader>

                  {/* Description with single line ellipsis & hover Tooltip */}
                  <Tooltip
                    title={
                      descriptionText || t("business:description_placeholder")
                    }
                    arrow
                    placement="top"
                  >
                    <DescriptionLine>
                      {descriptionText || (
                        <Box
                          component="span"
                          sx={{ fontStyle: "italic", opacity: 0.6 }}
                        >
                          {t("business:description_placeholder")}
                        </Box>
                      )}
                    </DescriptionLine>
                  </Tooltip>

                  {/* Aesthetic Provider Chips (Lorem Ipsum) */}
                  <ChipsContainer onClick={(e) => e.stopPropagation()}>
                    {LOREM_PROVIDERS.map((prov) => (
                      <Chip
                        key={prov.name}
                        label={prov.name}
                        size="small"
                        sx={{
                          fontWeight: 500,
                          fontSize: "0.75rem",
                          color: prov.color,
                          backgroundColor: prov.bg,
                          border: `1px solid ${prov.color}20`,
                        }}
                      />
                    ))}
                  </ChipsContainer>

                  {/* Card Footer: 999 Products & Collaborators Count */}
                  <CardFooter>
                    <Chip
                      icon={<Inventory2OutlinedIcon fontSize="small" />}
                      label={t("business:products_count", { count: 999 })}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: "0.75rem" }}
                    />

                    <Chip
                      icon={<PeopleOutlinedIcon fontSize="small" />}
                      label={t("business:collaborators_count", {
                        count: business.collaborators_count ?? 0,
                      })}
                      size="small"
                      color="primary"
                      variant="outlined"
                      sx={{ fontWeight: 500, fontSize: "0.75rem" }}
                    />
                  </CardFooter>
                </BusinessCard>
              );
            })}
          </CardsGrid>
        )}
      </Skeleton>

      {/* Action Options Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleCloseMenu}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        slotProps={{
          paper: {
            sx: { minWidth: 200, borderRadius: 2, boxShadow: 4 },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (menuBusiness) navigate(`/business/${menuBusiness.id}`);
            handleCloseMenu();
          }}
        >
          <ListItemIcon>
            <VisibilityOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_view_detail")} />
        </MenuItem>

        <MenuItem onClick={handleOpenEdit}>
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_update")} />
        </MenuItem>

        <MenuItem onClick={handleOpenCollaborators}>
          <ListItemIcon>
            <PersonAddOutlinedIcon fontSize="small" color="info" />
          </ListItemIcon>
          <ListItemText primary={t("business:action_add_collaborator")} />
        </MenuItem>

        <MenuItem onClick={handleOpenToggleStatus}>
          <ListItemIcon>
            {menuBusiness?.is_active ? (
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
              menuBusiness?.is_active
                ? t("business:action_deactivate")
                : t("business:action_activate")
            }
          />
        </MenuItem>
      </Menu>

      {/* Create Modal */}
      <BusinessModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isSubmitting={createMutation.isPending}
      />

      {/* Edit Modal */}
      <BusinessModal
        open={Boolean(editingBusiness)}
        onClose={() => setEditingBusiness(null)}
        onSubmit={handleUpdateSubmit}
        initialData={editingBusiness}
        isSubmitting={updateMutation.isPending}
      />

      {/* Collaborators Modal */}
      {collaboratorBusiness && (
        <BusinessCollaboratorModal
          open={Boolean(collaboratorBusiness)}
          onClose={() => setCollaboratorBusiness(null)}
          businessId={collaboratorBusiness.id}
          businessName={collaboratorBusiness.name}
          initialCollaborators={collaboratorBusiness.collaborators}
        />
      )}

      {/* Confirm Deactivate / Activate Dialog */}
      <ConfirmDialog
        open={Boolean(confirmToggleBusiness)}
        onClose={() => setConfirmToggleBusiness(null)}
        title={
          confirmToggleBusiness?.is_active
            ? t("business:confirm_deactivate_title")
            : t("business:confirm_activate_title")
        }
        message={
          confirmToggleBusiness?.is_active
            ? t("business:confirm_deactivate_message", {
                name: confirmToggleBusiness.name,
              })
            : t("business:confirm_activate_message", {
                name: confirmToggleBusiness?.name,
              })
        }
        onConfirm={handleConfirmToggleStatus}
        cancelText={t("core:cancel")}
        confirmText={
          confirmToggleBusiness?.is_active
            ? t("business:action_deactivate")
            : t("business:action_activate")
        }
      />
    </Box>
  );
};

export default Business;
