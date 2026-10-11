import type { ReactNode, ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";

// AI & Automation
import SmartToyIcon from "@mui/icons-material/SmartToy";
import HolidayVillageOutlinedIcon from "@mui/icons-material/HolidayVillageOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import PsychologyOutlinedIcon from "@mui/icons-material/PsychologyOutlined";
import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import PrecisionManufacturingOutlinedIcon from "@mui/icons-material/PrecisionManufacturingOutlined";
import ModelTrainingOutlinedIcon from "@mui/icons-material/ModelTrainingOutlined";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";

// Integrations & Dev
import ApiOutlinedIcon from "@mui/icons-material/ApiOutlined";
import WebhookOutlinedIcon from "@mui/icons-material/WebhookOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import CodeOutlinedIcon from "@mui/icons-material/CodeOutlined";
import TerminalOutlinedIcon from "@mui/icons-material/TerminalOutlined";
import DataObjectOutlinedIcon from "@mui/icons-material/DataObjectOutlined";
import DatasetOutlinedIcon from "@mui/icons-material/DatasetOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";

// General & System
import ViewModuleOutlinedIcon from "@mui/icons-material/ViewModuleOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import WidgetsOutlinedIcon from "@mui/icons-material/WidgetsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import ViewAgendaOutlinedIcon from "@mui/icons-material/ViewAgendaOutlined";
import TuneOutlinedIcon from "@mui/icons-material/TuneOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ManageHistoryOutlinedIcon from "@mui/icons-material/ManageHistoryOutlined";
import SyncOutlinedIcon from "@mui/icons-material/SyncOutlined";

// Identity & Security
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import KeyOutlinedIcon from "@mui/icons-material/KeyOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import AddReactionOutlinedIcon from "@mui/icons-material/AddReactionOutlined";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import SecurityUpdateGoodOutlinedIcon from "@mui/icons-material/SecurityUpdateGoodOutlined";

// Business & Commerce
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import BusinessCenterOutlinedIcon from "@mui/icons-material/BusinessCenterOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import PointOfSaleOutlinedIcon from "@mui/icons-material/PointOfSaleOutlined";
import AccountTreeOutlinedIcon from "@mui/icons-material/AccountTreeOutlined";

// Invoices & Accounting
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AttachMoneyOutlinedIcon from "@mui/icons-material/AttachMoneyOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import PriceCheckOutlinedIcon from "@mui/icons-material/PriceCheckOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";

// Logistics & Providers
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import WarehouseOutlinedIcon from "@mui/icons-material/WarehouseOutlined";
import QrCodeOutlinedIcon from "@mui/icons-material/QrCodeOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";

// Analytics & Reports
import AnalyticsOutlinedIcon from "@mui/icons-material/AnalyticsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PieChartOutlinedIcon from "@mui/icons-material/PieChartOutlined";
import ShowChartOutlinedIcon from "@mui/icons-material/ShowChartOutlined";

// Communication & Tools
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import TranslateOutlinedIcon from "@mui/icons-material/TranslateOutlined";
import LanguageOutlinedIcon from "@mui/icons-material/LanguageOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import FolderSharedOutlinedIcon from "@mui/icons-material/FolderSharedOutlined";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";

export const DEFAULT_MODULE_ICON_KEY = "ViewModuleOutlined";
export const DEFAULT_GROUP_ICON_KEY = "CategoryOutlined";

export const ICON_REGISTRY: Record<string, ComponentType<SvgIconProps>> = {
  HolidayVillageOutlined: HolidayVillageOutlinedIcon,
  // AI & Automation
  SmartToy: SmartToyIcon,
  SmartToyOutlined: SmartToyOutlinedIcon,
  PsychologyOutlined: PsychologyOutlinedIcon,
  AutoAwesomeOutlined: AutoAwesomeOutlinedIcon,
  PrecisionManufacturingOutlined: PrecisionManufacturingOutlinedIcon,
  ModelTrainingOutlined: ModelTrainingOutlinedIcon,
  AutoFixHighOutlined: AutoFixHighOutlinedIcon,
  SupportAgentOutlined: SupportAgentOutlinedIcon,

  // Integrations & Dev
  ApiOutlined: ApiOutlinedIcon,
  WebhookOutlined: WebhookOutlinedIcon,
  HubOutlined: HubOutlinedIcon,
  CodeOutlined: CodeOutlinedIcon,
  TerminalOutlined: TerminalOutlinedIcon,
  DataObjectOutlined: DataObjectOutlinedIcon,
  DatasetOutlined: DatasetOutlinedIcon,
  MemoryOutlined: MemoryOutlinedIcon,
  ExtensionOutlined: ExtensionOutlinedIcon,

  // General & System
  ViewModuleOutlined: ViewModuleOutlinedIcon,
  SettingsOutlined: SettingsOutlinedIcon,
  CategoryOutlined: CategoryOutlinedIcon,
  WidgetsOutlined: WidgetsOutlinedIcon,
  DashboardOutlined: DashboardOutlinedIcon,
  AppsOutlined: AppsOutlinedIcon,
  GridViewOutlined: GridViewOutlinedIcon,
  ViewAgendaOutlined: ViewAgendaOutlinedIcon,
  TuneOutlined: TuneOutlinedIcon,
  BuildOutlined: BuildOutlinedIcon,
  AdminPanelSettingsOutlined: AdminPanelSettingsOutlinedIcon,
  HomeOutlined: HomeOutlinedIcon,
  HistoryOutlined: HistoryOutlinedIcon,
  ManageHistoryOutlined: ManageHistoryOutlinedIcon,
  SyncOutlined: SyncOutlinedIcon,

  // Identity & Security
  PersonOutlined: PersonOutlinedIcon,
  PeopleOutlined: PeopleOutlinedIcon,
  GroupOutlined: GroupOutlinedIcon,
  BadgeOutlined: BadgeOutlinedIcon,
  SecurityOutlined: SecurityOutlinedIcon,
  ShieldOutlined: ShieldOutlinedIcon,
  LockOutlined: LockOutlinedIcon,
  KeyOutlined: KeyOutlinedIcon,
  BoltOutlined: BoltOutlinedIcon,
  AddReactionOutlined: AddReactionOutlinedIcon,
  ManageAccountsOutlined: ManageAccountsOutlinedIcon,
  VpnKeyOutlined: VpnKeyOutlinedIcon,
  SecurityUpdateGoodOutlined: SecurityUpdateGoodOutlinedIcon,

  // Business & Commerce
  StorefrontOutlined: StorefrontOutlinedIcon,
  BusinessCenterOutlined: BusinessCenterOutlinedIcon,
  ApartmentOutlined: ApartmentOutlinedIcon,
  Inventory2Outlined: Inventory2OutlinedIcon,
  LocalOfferOutlined: LocalOfferOutlinedIcon,
  SellOutlined: SellOutlinedIcon,
  ShoppingCartOutlined: ShoppingCartOutlinedIcon,
  ShoppingBagOutlined: ShoppingBagOutlinedIcon,
  PointOfSaleOutlined: PointOfSaleOutlinedIcon,
  AccountTreeOutlined: AccountTreeOutlinedIcon,

  // Invoices & Accounting
  ReceiptOutlined: ReceiptOutlinedIcon,
  ReceiptLongOutlined: ReceiptLongOutlinedIcon,
  AttachMoneyOutlined: AttachMoneyOutlinedIcon,
  AccountBalanceOutlined: AccountBalanceOutlinedIcon,
  CreditCardOutlined: CreditCardOutlinedIcon,
  RequestQuoteOutlined: RequestQuoteOutlinedIcon,
  AccountBalanceWalletOutlined: AccountBalanceWalletOutlinedIcon,
  DescriptionOutlined: DescriptionOutlinedIcon,
  FactCheckOutlined: FactCheckOutlinedIcon,
  CalculateOutlined: CalculateOutlinedIcon,
  PriceCheckOutlined: PriceCheckOutlinedIcon,
  PaymentsOutlined: PaymentsOutlinedIcon,

  // Logistics & Providers
  LocalShippingOutlined: LocalShippingOutlinedIcon,
  WarehouseOutlined: WarehouseOutlinedIcon,
  QrCodeOutlined: QrCodeOutlinedIcon,
  QrCodeScannerOutlined: QrCodeScannerOutlinedIcon,
  AssignmentOutlined: AssignmentOutlinedIcon,

  // Analytics & Reports
  AnalyticsOutlined: AnalyticsOutlinedIcon,
  AssessmentOutlined: AssessmentOutlinedIcon,
  BarChartOutlined: BarChartOutlinedIcon,
  TrendingUpOutlined: TrendingUpOutlinedIcon,
  InsightsOutlined: InsightsOutlinedIcon,
  PieChartOutlined: PieChartOutlinedIcon,
  ShowChartOutlined: ShowChartOutlinedIcon,

  // Communication & Tools
  EmailOutlined: EmailOutlinedIcon,
  NotificationsOutlined: NotificationsOutlinedIcon,
  ChatOutlined: ChatOutlinedIcon,
  TranslateOutlined: TranslateOutlinedIcon,
  LanguageOutlined: LanguageOutlinedIcon,
  FolderOutlined: FolderOutlinedIcon,
  FolderSharedOutlined: FolderSharedOutlinedIcon,
  CloudOutlined: CloudOutlinedIcon,
  StorageOutlined: StorageOutlinedIcon,
  HelpOutlineOutlined: HelpOutlineOutlinedIcon,
  InfoOutlined: InfoOutlinedIcon,
  CheckCircleOutlineOutlined: CheckCircleOutlineOutlinedIcon,
};

/**
 * Returns a ReactNode rendering the icon component registered under the given key.
 * If not found or null, renders the provided fallback (or null).
 */
export const getIconByKey = (
  iconKey?: string | null,
  fallback: ReactNode = null,
  props?: SvgIconProps
): ReactNode => {
  if (!iconKey) return fallback;
  const IconComp = ICON_REGISTRY[iconKey];
  if (!IconComp) return fallback;
  return <IconComp {...props} />;
};

/**
 * Resolves the icon for a module.
 * Prioritizes dynamic `iconKey` from database. If absent or invalid,
 * falls back to legacy module key name mapping, and finally to default `ViewModuleOutlined`.
 */
export const getModuleIcon = (
  key: string,
  iconKey?: string | null,
  props?: SvgIconProps
): ReactNode => {
  if (iconKey && ICON_REGISTRY[iconKey]) {
    const IconComp = ICON_REGISTRY[iconKey];
    return <IconComp {...props} />;
  }

  const normalized = (key || "").toLowerCase();
  switch (normalized) {
    case "usuarios":
    case "users":
      return <AddReactionOutlinedIcon {...props} />;
    case "roles":
      return <SecurityOutlinedIcon {...props} />;
    case "acciones":
    case "actions":
      return <BoltOutlinedIcon {...props} />;
    case "modulos":
    case "modules":
      return <ViewModuleOutlinedIcon {...props} />;
    case "negocios":
    case "business":
    case "businesses":
      return <StorefrontOutlinedIcon {...props} />;
    case "ai-providers":
    case "ai_providers":
    case "proveedores-ia":
    case "proveedores_ia":
    case "ai":
    case "ia":
      return <SmartToyIcon {...props} />;
    default:
      return <ViewModuleOutlinedIcon {...props} />;
  }
};

/**
 * Resolves the icon for a module group.
 * Prioritizes dynamic `iconKey` from database. If absent or invalid,
 * falls back to legacy group key name mapping, and finally to default `CategoryOutlined`.
 */
export const getGroupIcon = (
  key: string,
  iconKey?: string | null,
  props?: SvgIconProps
): ReactNode => {
  if (iconKey && ICON_REGISTRY[iconKey]) {
    const IconComp = ICON_REGISTRY[iconKey];
    return <IconComp {...props} />;
  }

  const normalized = (key || "").toLowerCase();
  switch (normalized) {
    case "negocios":
    case "business":
    case "businesses":
      return <StorefrontOutlinedIcon {...props} />;
    case "ajustes-generales":
    case "general-settings":
    case "general_settings":
    case "settings":
      return <SettingsOutlinedIcon {...props} />;
    case "ai":
    case "ia":
    case "ai-providers":
    case "proveedores-ia":
      return <SmartToyIcon {...props} />;
    default:
      return <CategoryOutlinedIcon {...props} />;
  }
};
