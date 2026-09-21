import type { FC, SyntheticEvent } from "react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  LinearProgress,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import { Skeleton } from "boneyard-js/react";
import { useIsMutating } from "@tanstack/react-query";

import Breadcrumb from "../../../../components/Breadcrumb";
import BusinessModal from "../Business/components/BusinessModal";
import BusinessCollaboratorModal from "../Business/components/BusinessCollaboratorModal";
import {
  useBusiness,
  useUpdateBusiness,
  useProducts,
  useProviders,
  useInvoices,
} from "../../infrastructure/useServices";
import type { BusinessFormData } from "../../infrastructure/types";
import { getTranslatedName } from "../../../../store/generalSettings/helpers";

import OverviewTab from "./components/OverviewTab";
import ProductsTab from "./components/ProductsTab";
import ProvidersTab from "./components/ProvidersTab";
import InvoicesTab from "./components/InvoicesTab";
import CollaboratorsTab from "./components/CollaboratorsTab";

import {
  DetailContainer,
  HeaderCard,
  HeaderTopSection,
  BusinessAvatarBox,
  HeaderInfoContainer,
  HeaderMetaRow,
  HeaderActions,
  TabsWrapper,
  StyledTabs,
  StyledTab,
  StatusPill,
  StatusDot,
} from "./styles";

const BusinessDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(["business", "core"]);
  const lang = i18n.language || "es";

  const [activeTab, setActiveTab] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false);

  // Direct modal trigger states (from quick action buttons)
  const [directNewProductOpen, setDirectNewProductOpen] = useState(false);
  const [directNewProviderOpen, setDirectNewProviderOpen] = useState(false);
  const [directNewInvoiceOpen, setDirectNewInvoiceOpen] = useState(false);

  const { data: business, isLoading, isFetching, isError, refetch } = useBusiness(id);
  const updateMutation = useUpdateBusiness();

  // Queries for badge counts
  const { data: productsData } = useProducts({ q: { business_id_eq: id }, limit: 1 });
  const { data: providersData } = useProviders({ q: { business_id_eq: id }, limit: 1 });
  const { data: invoicesData } = useInvoices({ q: { business_id_eq: id }, limit: 1 });

  const totalProducts = productsData?.meta?.total_items ?? 0;
  const totalProviders = providersData?.meta?.total_items ?? 0;
  const totalInvoices = invoicesData?.meta?.total_items ?? 0;
  const totalCollaborators = business?.collaborators?.length ?? business?.collaborators_count ?? 0;

  const isMutating = useIsMutating() > 0;
  const isBusy = isLoading || isFetching || isMutating;

  const handleTabChange = (_event: SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleUpdateSubmit = async (data: BusinessFormData) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({
        id,
        payload: {
          name: data.name,
          is_active: data.is_active,
          translates: data.translates,
        },
      });
      setIsEditModalOpen(false);
    } catch {
      // Do not close modal on error, allowing user to retry
    }
  };

  if (isError) {
    return (
      <DetailContainer>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/business")}
          sx={{ alignSelf: "flex-start", borderRadius: 2 }}
        >
          {t("business:back_to_list")}
        </Button>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t("core:retry")}
            </Button>
          }
        >
          {t("core:server_error_alert")}
        </Alert>
      </DetailContainer>
    );
  }

  const descriptionText = business
    ? getTranslatedName(business.translates, "", lang)
    : "";

  return (
    <DetailContainer>
      {/* Soft loading indicator */}
      {(isFetching || isMutating) && !isLoading && (
        <LinearProgress
          sx={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 1200 }}
        />
      )}

      {/* Global Breadcrumb */}
      <Breadcrumb
        items={[
          { label: t("business:title"), to: "/business" },
          { label: business?.name ?? t("business:detail_title") },
        ]}
      />

      {/* Header Card with Business Info and Embedded Tabs */}
      <Skeleton loading={isLoading}>
        <HeaderCard>
          <HeaderTopSection>
            <HeaderInfoContainer>
              <BusinessAvatarBox>
                <StorefrontOutlinedIcon sx={{ fontSize: 32 }} />
              </BusinessAvatarBox>

              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                    {business?.name ?? "..."}
                  </Typography>

                  <StatusPill active={business?.is_active ?? true}>
                    <StatusDot active={business?.is_active ?? true} />
                    {business?.is_active
                      ? t("business:status_active")
                      : t("business:status_inactive")}
                  </StatusPill>
                </Box>

                <HeaderMetaRow>
                  <Typography variant="caption" color="text.secondary">
                    {`ID: ${business?.id ?? ""}`}
                  </Typography>

                  {business?.owner && (
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                      <Avatar
                        src={business.owner.image_url ?? undefined}
                        alt={business.owner.name}
                        sx={{ width: 18, height: 18, fontSize: 10 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {business.owner.name} ({t("business:owner_badge")})
                      </Typography>
                    </Box>
                  )}
                </HeaderMetaRow>

                {descriptionText && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.5 }}>
                    {descriptionText}
                  </Typography>
                )}
              </Box>
            </HeaderInfoContainer>

            {/* Action buttons */}
            <HeaderActions>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditOutlinedIcon />}
                onClick={() => setIsEditModalOpen(true)}
                disabled={isBusy}
                sx={{ borderRadius: 2, textTransform: "none" }}
              >
                {t("business:action_update")}
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<GroupAddOutlinedIcon />}
                onClick={() => setIsCollaboratorModalOpen(true)}
                disabled={isBusy}
                sx={{ borderRadius: 2, textTransform: "none" }}
              >
                {t("business:action_add_collaborator")}
              </Button>
            </HeaderActions>
          </HeaderTopSection>

          {/* Embedded Navigation Tabs */}
          <TabsWrapper>
            <StyledTabs
              value={activeTab}
              onChange={handleTabChange}
              variant="scrollable"
              scrollButtons="auto"
            >
              <StyledTab
                icon={<DashboardOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={t("business:tab_overview")}
                data-testid="tab-overview"
              />
              <StyledTab
                icon={<StorefrontOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    {t("business:tab_providers")}
                    <Chip label={totalProviders} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                  </Box>
                }
                data-testid="tab-providers"
              />
              <StyledTab
                icon={<Inventory2OutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    {t("business:tab_products")}
                    <Chip label={totalProducts} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                  </Box>
                }
                data-testid="tab-products"
              />
              <StyledTab
                icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    {t("business:tab_invoices")}
                    <Chip label={totalInvoices} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                  </Box>
                }
                data-testid="tab-invoices"
              />
              <StyledTab
                icon={<PeopleOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                label={
                  <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                    {t("business:tab_collaborators")}
                    <Chip label={totalCollaborators} size="small" sx={{ height: 18, fontSize: "0.68rem" }} />
                  </Box>
                }
                data-testid="tab-collaborators"
              />
            </StyledTabs>
          </TabsWrapper>
        </HeaderCard>
      </Skeleton>

      {/* Tab Panels */}
      {business && (
        <Box sx={{ width: "100%", mt: 1 }}>
          {activeTab === 0 && (
            <OverviewTab
              businessId={business.id}
              onSwitchTab={(tabIdx) => setActiveTab(tabIdx)}
              onOpenNewProvider={() => {
                setActiveTab(1);
                setDirectNewProviderOpen(true);
              }}
              onOpenNewProduct={() => {
                setActiveTab(2);
                setDirectNewProductOpen(true);
              }}
              onOpenNewInvoice={() => {
                setActiveTab(3);
                setDirectNewInvoiceOpen(true);
              }}
            />
          )}

          {activeTab === 1 && (
            <ProvidersTab
              businessId={business.id}
              isCreateModalOpenDirectly={directNewProviderOpen}
              onCloseDirectCreateModal={() => setDirectNewProviderOpen(false)}
            />
          )}

          {activeTab === 2 && (
            <ProductsTab
              businessId={business.id}
              isCreateModalOpenDirectly={directNewProductOpen}
              onCloseDirectCreateModal={() => setDirectNewProductOpen(false)}
            />
          )}

          {activeTab === 3 && (
            <InvoicesTab
              businessId={business.id}
              isCreateModalOpenDirectly={directNewInvoiceOpen}
              onCloseDirectCreateModal={() => setDirectNewInvoiceOpen(false)}
            />
          )}

          {activeTab === 4 && (
            <CollaboratorsTab
              collaborators={business.collaborators}
              onOpenAddCollaborator={() => setIsCollaboratorModalOpen(true)}
              isBusy={isBusy}
            />
          )}
        </Box>
      )}

      {/* Header Modals */}
      {business && (
        <>
          <BusinessModal
            open={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSubmit={handleUpdateSubmit}
            initialData={business}
            isSubmitting={updateMutation.isPending}
          />

          <BusinessCollaboratorModal
            open={isCollaboratorModalOpen}
            onClose={() => setIsCollaboratorModalOpen(false)}
            businessId={business.id}
            businessName={business.name}
            initialCollaborators={business.collaborators}
          />
        </>
      )}
    </DetailContainer>
  );
};

export default BusinessDetail;
