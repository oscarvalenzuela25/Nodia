import type { ReactNode, ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";

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

export interface IconDefinition {
  key: string;
  label: string;
  category: string;
  Component: ComponentType<SvgIconProps>;
}

export const ICON_REGISTRY: Record<string, ComponentType<SvgIconProps>> = {
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

export const AVAILABLE_ICONS: IconDefinition[] = [
  // General & System
  { key: "ViewModuleOutlined", label: "Módulos", category: "Sistema", Component: ViewModuleOutlinedIcon },
  { key: "SettingsOutlined", label: "Ajustes", category: "Sistema", Component: SettingsOutlinedIcon },
  { key: "CategoryOutlined", label: "Grupos / Categorías", category: "Sistema", Component: CategoryOutlinedIcon },
  { key: "WidgetsOutlined", label: "Widgets", category: "Sistema", Component: WidgetsOutlinedIcon },
  { key: "DashboardOutlined", label: "Dashboard", category: "Sistema", Component: DashboardOutlinedIcon },
  { key: "AppsOutlined", label: "Aplicaciones", category: "Sistema", Component: AppsOutlinedIcon },
  { key: "GridViewOutlined", label: "Cuadrícula", category: "Sistema", Component: GridViewOutlinedIcon },
  { key: "ViewAgendaOutlined", label: "Agenda", category: "Sistema", Component: ViewAgendaOutlinedIcon },
  { key: "TuneOutlined", label: "Preferencias", category: "Sistema", Component: TuneOutlinedIcon },
  { key: "BuildOutlined", label: "Herramientas", category: "Sistema", Component: BuildOutlinedIcon },
  { key: "AdminPanelSettingsOutlined", label: "Admin Panel", category: "Sistema", Component: AdminPanelSettingsOutlinedIcon },
  { key: "HomeOutlined", label: "Inicio", category: "Sistema", Component: HomeOutlinedIcon },

  // Identity & Security
  { key: "PersonOutlined", label: "Usuario", category: "Seguridad", Component: PersonOutlinedIcon },
  { key: "PeopleOutlined", label: "Usuarios", category: "Seguridad", Component: PeopleOutlinedIcon },
  { key: "GroupOutlined", label: "Grupo Usuarios", category: "Seguridad", Component: GroupOutlinedIcon },
  { key: "BadgeOutlined", label: "Credencial", category: "Seguridad", Component: BadgeOutlinedIcon },
  { key: "SecurityOutlined", label: "Seguridad / Roles", category: "Seguridad", Component: SecurityOutlinedIcon },
  { key: "ShieldOutlined", label: "Protección", category: "Seguridad", Component: ShieldOutlinedIcon },
  { key: "LockOutlined", label: "Bloqueo", category: "Seguridad", Component: LockOutlinedIcon },
  { key: "KeyOutlined", label: "Llave", category: "Seguridad", Component: KeyOutlinedIcon },
  { key: "BoltOutlined", label: "Acciones / Permisos", category: "Seguridad", Component: BoltOutlinedIcon },
  { key: "AddReactionOutlined", label: "Usuarios Reacción", category: "Seguridad", Component: AddReactionOutlinedIcon },

  // Business & Commerce
  { key: "StorefrontOutlined", label: "Negocios / Tienda", category: "Negocios", Component: StorefrontOutlinedIcon },
  { key: "BusinessCenterOutlined", label: "Empresa", category: "Negocios", Component: BusinessCenterOutlinedIcon },
  { key: "ApartmentOutlined", label: "Corporativo", category: "Negocios", Component: ApartmentOutlinedIcon },
  { key: "Inventory2Outlined", label: "Inventario / Productos", category: "Negocios", Component: Inventory2OutlinedIcon },
  { key: "LocalOfferOutlined", label: "Ofertas", category: "Negocios", Component: LocalOfferOutlinedIcon },
  { key: "SellOutlined", label: "Ventas / Catálogo", category: "Negocios", Component: SellOutlinedIcon },
  { key: "ShoppingCartOutlined", label: "Carrito", category: "Negocios", Component: ShoppingCartOutlinedIcon },
  { key: "ShoppingBagOutlined", label: "Bolsa de compra", category: "Negocios", Component: ShoppingBagOutlinedIcon },
  { key: "PointOfSaleOutlined", label: "Punto de Venta", category: "Negocios", Component: PointOfSaleOutlinedIcon },

  // Invoices & Accounting
  { key: "ReceiptOutlined", label: "Facturas", category: "Facturación", Component: ReceiptOutlinedIcon },
  { key: "ReceiptLongOutlined", label: "Factura Detallada", category: "Facturación", Component: ReceiptLongOutlinedIcon },
  { key: "AttachMoneyOutlined", label: "Dinero / Precios", category: "Facturación", Component: AttachMoneyOutlinedIcon },
  { key: "AccountBalanceOutlined", label: "Bancos / Finanzas", category: "Facturación", Component: AccountBalanceOutlinedIcon },
  { key: "CreditCardOutlined", label: "Tarjetas", category: "Facturación", Component: CreditCardOutlinedIcon },
  { key: "RequestQuoteOutlined", label: "Cotizaciones", category: "Facturación", Component: RequestQuoteOutlinedIcon },
  { key: "AccountBalanceWalletOutlined", label: "Billetera", category: "Facturación", Component: AccountBalanceWalletOutlinedIcon },
  { key: "DescriptionOutlined", label: "Documentos", category: "Facturación", Component: DescriptionOutlinedIcon },
  { key: "FactCheckOutlined", label: "Auditoría Contable", category: "Facturación", Component: FactCheckOutlinedIcon },

  // Logistics & Providers
  { key: "LocalShippingOutlined", label: "Proveedores / Envíos", category: "Logística", Component: LocalShippingOutlinedIcon },
  { key: "WarehouseOutlined", label: "Almacén", category: "Logística", Component: WarehouseOutlinedIcon },
  { key: "QrCodeOutlined", label: "Código QR", category: "Logística", Component: QrCodeOutlinedIcon },
  { key: "QrCodeScannerOutlined", label: "Escáner OCR", category: "Logística", Component: QrCodeScannerOutlinedIcon },
  { key: "AssignmentOutlined", label: "Asignaciones", category: "Logística", Component: AssignmentOutlinedIcon },

  // Analytics & Reports
  { key: "AnalyticsOutlined", label: "Analítica", category: "Métricas", Component: AnalyticsOutlinedIcon },
  { key: "AssessmentOutlined", label: "Reportes", category: "Métricas", Component: AssessmentOutlinedIcon },
  { key: "BarChartOutlined", label: "Gráfico de Barras", category: "Métricas", Component: BarChartOutlinedIcon },
  { key: "TrendingUpOutlined", label: "Tendencias", category: "Métricas", Component: TrendingUpOutlinedIcon },
  { key: "InsightsOutlined", label: "Métricas Clave", category: "Métricas", Component: InsightsOutlinedIcon },
  { key: "PieChartOutlined", label: "Gráfico Circular", category: "Métricas", Component: PieChartOutlinedIcon },
  { key: "ShowChartOutlined", label: "Gráfico Líneas", category: "Métricas", Component: ShowChartOutlinedIcon },

  // Communication & Tools
  { key: "EmailOutlined", label: "Correo", category: "Utilidades", Component: EmailOutlinedIcon },
  { key: "NotificationsOutlined", label: "Notificaciones", category: "Utilidades", Component: NotificationsOutlinedIcon },
  { key: "ChatOutlined", label: "Chat", category: "Utilidades", Component: ChatOutlinedIcon },
  { key: "TranslateOutlined", label: "Traducciones", category: "Utilidades", Component: TranslateOutlinedIcon },
  { key: "LanguageOutlined", label: "Idiomas", category: "Utilidades", Component: LanguageOutlinedIcon },
  { key: "FolderOutlined", label: "Carpetas", category: "Utilidades", Component: FolderOutlinedIcon },
  { key: "FolderSharedOutlined", label: "Archivos Compartidos", category: "Utilidades", Component: FolderSharedOutlinedIcon },
  { key: "CloudOutlined", label: "Nube", category: "Utilidades", Component: CloudOutlinedIcon },
  { key: "StorageOutlined", label: "Almacenamiento", category: "Utilidades", Component: StorageOutlinedIcon },
  { key: "HelpOutlineOutlined", label: "Ayuda", category: "Utilidades", Component: HelpOutlineOutlinedIcon },
  { key: "InfoOutlined", label: "Información", category: "Utilidades", Component: InfoOutlinedIcon },
  { key: "CheckCircleOutlineOutlined", label: "Verificado", category: "Utilidades", Component: CheckCircleOutlineOutlinedIcon },
];

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
    default:
      return <CategoryOutlinedIcon {...props} />;
  }
};
