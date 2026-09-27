import type { ReactNode, ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";

// AI & Automation
import SmartToyIcon from "@mui/icons-material/SmartToy";
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

export interface IconDefinition {
  key: string;
  label: string;
  category: string;
  keywords?: string[];
  Component: ComponentType<SvgIconProps>;
}

export const ICON_REGISTRY: Record<string, ComponentType<SvgIconProps>> = {
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

export const AVAILABLE_ICONS: IconDefinition[] = [
  // AI & Automation
  {
    key: "SmartToy",
    label: "Robot / IA (Relleno)",
    category: "IA y Automatización",
    keywords: ["robot", "ia", "ai", "bot", "inteligencia artificial", "smarttoy", "proveedores", "gemini", "agente", "asistente", "proveedores de ia"],
    Component: SmartToyIcon,
  },
  {
    key: "SmartToyOutlined",
    label: "Robot / IA",
    category: "IA y Automatización",
    keywords: ["robot", "ia", "ai", "bot", "inteligencia artificial", "smarttoy", "proveedores", "gemini", "agente", "asistente", "proveedores de ia"],
    Component: SmartToyOutlinedIcon,
  },
  {
    key: "PsychologyOutlined",
    label: "Cerebro / IA Cognitiva",
    category: "IA y Automatización",
    keywords: ["cerebro", "ia", "ai", "inteligencia", "mente", "cognitivo", "neuronal", "red neuronal", "modelo"],
    Component: PsychologyOutlinedIcon,
  },
  {
    key: "AutoAwesomeOutlined",
    label: "Generación / Magia IA",
    category: "IA y Automatización",
    keywords: ["ia", "ai", "magia", "destellos", "generativo", "asistente", "auto", "stars", "sparkles"],
    Component: AutoAwesomeOutlinedIcon,
  },
  {
    key: "PrecisionManufacturingOutlined",
    label: "Automatización / Procesos",
    category: "IA y Automatización",
    keywords: ["automatizacion", "robotica", "fabrica", "industria", "proceso", "maquinaria"],
    Component: PrecisionManufacturingOutlinedIcon,
  },
  {
    key: "ModelTrainingOutlined",
    label: "Entrenamiento de Modelos",
    category: "IA y Automatización",
    keywords: ["modelo", "ia", "ai", "entrenamiento", "training", "machine learning", "ml", "pesos"],
    Component: ModelTrainingOutlinedIcon,
  },
  {
    key: "AutoFixHighOutlined",
    label: "Mejora Automática / Prompting",
    category: "IA y Automatización",
    keywords: ["autofix", "correccion", "varita", "asistente", "ia", "ai", "mejora"],
    Component: AutoFixHighOutlinedIcon,
  },
  {
    key: "SupportAgentOutlined",
    label: "Agente de Asistencia / Bot",
    category: "IA y Automatización",
    keywords: ["agente", "soporte", "asistente", "bot", "virtual", "servicio", "auriculares"],
    Component: SupportAgentOutlinedIcon,
  },

  // Integrations & Dev
  {
    key: "ApiOutlined",
    label: "API / Endpoints",
    category: "Integraciones",
    keywords: ["api", "endpoints", "rest", "servicio", "integracion", "backend", "web services"],
    Component: ApiOutlinedIcon,
  },
  {
    key: "WebhookOutlined",
    label: "Webhooks / Eventos",
    category: "Integraciones",
    keywords: ["webhook", "eventos", "http", "callback", "integracion", "notificaciones"],
    Component: WebhookOutlinedIcon,
  },
  {
    key: "HubOutlined",
    label: "Nodos / Conexiones",
    category: "Integraciones",
    keywords: ["hub", "red", "nodos", "conexion", "central", "conectores"],
    Component: HubOutlinedIcon,
  },
  {
    key: "CodeOutlined",
    label: "Código / Desarrollo",
    category: "Integraciones",
    keywords: ["codigo", "script", "desarrollo", "programacion", "code", "dev"],
    Component: CodeOutlinedIcon,
  },
  {
    key: "TerminalOutlined",
    label: "Consola / Terminal",
    category: "Integraciones",
    keywords: ["terminal", "consola", "shell", "bash", "comando", "cli"],
    Component: TerminalOutlinedIcon,
  },
  {
    key: "DataObjectOutlined",
    label: "Objeto de Datos / JSON",
    category: "Integraciones",
    keywords: ["datos", "json", "objeto", "schema", "payload", "estructura"],
    Component: DataObjectOutlinedIcon,
  },
  {
    key: "DatasetOutlined",
    label: "Conjunto de Datos / Datasets",
    category: "Integraciones",
    keywords: ["dataset", "datos", "tablas", "ml", "coleccion", "big data"],
    Component: DatasetOutlinedIcon,
  },
  {
    key: "MemoryOutlined",
    label: "Hardware / Procesamiento",
    category: "Integraciones",
    keywords: ["procesador", "cpu", "memoria", "hardware", "chip", "computo"],
    Component: MemoryOutlinedIcon,
  },
  {
    key: "ExtensionOutlined",
    label: "Plugins / Extensiones",
    category: "Integraciones",
    keywords: ["plugin", "extension", "complemento", "modulo", "addon", "pieza"],
    Component: ExtensionOutlinedIcon,
  },

  // General & System
  { key: "ViewModuleOutlined", label: "Módulos", category: "Sistema", keywords: ["modulo", "seccion", "sistema"], Component: ViewModuleOutlinedIcon },
  { key: "SettingsOutlined", label: "Ajustes", category: "Sistema", keywords: ["configuracion", "ajustes", "opciones", "preferencias"], Component: SettingsOutlinedIcon },
  { key: "CategoryOutlined", label: "Grupos / Categorías", category: "Sistema", keywords: ["grupo", "categoria", "clasificacion"], Component: CategoryOutlinedIcon },
  { key: "WidgetsOutlined", label: "Widgets", category: "Sistema", keywords: ["widgets", "componentes", "bloques"], Component: WidgetsOutlinedIcon },
  { key: "DashboardOutlined", label: "Dashboard", category: "Sistema", keywords: ["dashboard", "tablero", "inicio", "panel"], Component: DashboardOutlinedIcon },
  { key: "AppsOutlined", label: "Aplicaciones", category: "Sistema", keywords: ["apps", "aplicaciones", "catalogo"], Component: AppsOutlinedIcon },
  { key: "GridViewOutlined", label: "Cuadrícula", category: "Sistema", keywords: ["cuadricula", "rejilla", "grid"], Component: GridViewOutlinedIcon },
  { key: "ViewAgendaOutlined", label: "Agenda", category: "Sistema", keywords: ["agenda", "calendario", "planificacion"], Component: ViewAgendaOutlinedIcon },
  { key: "TuneOutlined", label: "Preferencias", category: "Sistema", keywords: ["tune", "filtros", "parametros", "controles"], Component: TuneOutlinedIcon },
  { key: "BuildOutlined", label: "Herramientas", category: "Sistema", keywords: ["herramientas", "utilidades", "mantenimiento"], Component: BuildOutlinedIcon },
  { key: "AdminPanelSettingsOutlined", label: "Admin Panel", category: "Sistema", keywords: ["admin", "administrador", "panel de control"], Component: AdminPanelSettingsOutlinedIcon },
  { key: "HomeOutlined", label: "Inicio", category: "Sistema", keywords: ["inicio", "home", "principal"], Component: HomeOutlinedIcon },
  { key: "HistoryOutlined", label: "Historial / Actividad", category: "Sistema", keywords: ["historial", "tiempo", "registro", "actividad", "logs"], Component: HistoryOutlinedIcon },
  { key: "ManageHistoryOutlined", label: "Registro de Cambios", category: "Sistema", keywords: ["auditoria", "historial", "cambios", "trazabilidad"], Component: ManageHistoryOutlinedIcon },
  { key: "SyncOutlined", label: "Sincronización", category: "Sistema", keywords: ["sincronizacion", "sync", "recargar", "actualizar"], Component: SyncOutlinedIcon },

  // Identity & Security
  { key: "PersonOutlined", label: "Usuario", category: "Seguridad", keywords: ["usuario", "perfil", "persona", "cuenta"], Component: PersonOutlinedIcon },
  { key: "PeopleOutlined", label: "Usuarios", category: "Seguridad", keywords: ["usuarios", "equipo", "personas", "miembros"], Component: PeopleOutlinedIcon },
  { key: "GroupOutlined", label: "Grupo Usuarios", category: "Seguridad", keywords: ["grupo", "equipo", "comunidad"], Component: GroupOutlinedIcon },
  { key: "BadgeOutlined", label: "Credencial", category: "Seguridad", keywords: ["credencial", "identificacion", "gafete"], Component: BadgeOutlinedIcon },
  { key: "SecurityOutlined", label: "Seguridad / Roles", category: "Seguridad", keywords: ["seguridad", "roles", "permisos", "proteccion"], Component: SecurityOutlinedIcon },
  { key: "ShieldOutlined", label: "Protección", category: "Seguridad", keywords: ["escudo", "proteccion", "defensa", "antivirus"], Component: ShieldOutlinedIcon },
  { key: "LockOutlined", label: "Bloqueo", category: "Seguridad", keywords: ["candado", "bloqueo", "privado", "seguro"], Component: LockOutlinedIcon },
  { key: "KeyOutlined", label: "Llave", category: "Seguridad", keywords: ["llave", "acceso", "clave", "credenciales"], Component: KeyOutlinedIcon },
  { key: "VpnKeyOutlined", label: "Claves de Acceso", category: "Seguridad", keywords: ["claves", "api keys", "tokens", "credencial", "acceso"], Component: VpnKeyOutlinedIcon },
  { key: "BoltOutlined", label: "Acciones / Permisos", category: "Seguridad", keywords: ["acciones", "rayo", "permisos", "rapido", "operaciones"], Component: BoltOutlinedIcon },
  { key: "AddReactionOutlined", label: "Usuarios Reacción", category: "Seguridad", keywords: ["reaccion", "usuarios", "interaccion"], Component: AddReactionOutlinedIcon },
  { key: "ManageAccountsOutlined", label: "Gestión de Cuentas", category: "Seguridad", keywords: ["cuentas", "gestion", "usuarios", "administracion"], Component: ManageAccountsOutlinedIcon },
  { key: "SecurityUpdateGoodOutlined", label: "Seguridad Verificada", category: "Seguridad", keywords: ["seguridad", "escudo", "verificado", "actualizado"], Component: SecurityUpdateGoodOutlinedIcon },

  // Business & Commerce
  { key: "StorefrontOutlined", label: "Negocios / Tienda", category: "Negocios", keywords: ["tienda", "negocio", "sucursal", "comercio"], Component: StorefrontOutlinedIcon },
  { key: "BusinessCenterOutlined", label: "Empresa", category: "Negocios", keywords: ["empresa", "maletin", "corporativo", "negocios"], Component: BusinessCenterOutlinedIcon },
  { key: "ApartmentOutlined", label: "Corporativo", category: "Negocios", keywords: ["edificio", "corporativo", "oficinas", "sede"], Component: ApartmentOutlinedIcon },
  { key: "AccountTreeOutlined", label: "Estructura / Sucursales", category: "Negocios", keywords: ["arbol", "estructura", "sucursales", "organigrama", "jerarquia"], Component: AccountTreeOutlinedIcon },
  { key: "Inventory2Outlined", label: "Inventario / Productos", category: "Negocios", keywords: ["inventario", "cajas", "productos", "stock"], Component: Inventory2OutlinedIcon },
  { key: "LocalOfferOutlined", label: "Ofertas", category: "Negocios", keywords: ["ofertas", "descuentos", "etiquetas", "promociones"], Component: LocalOfferOutlinedIcon },
  { key: "SellOutlined", label: "Ventas / Catálogo", category: "Negocios", keywords: ["ventas", "catalogo", "etiqueta", "precios"], Component: SellOutlinedIcon },
  { key: "ShoppingCartOutlined", label: "Carrito", category: "Negocios", keywords: ["carrito", "compras", "pedidos"], Component: ShoppingCartOutlinedIcon },
  { key: "ShoppingBagOutlined", label: "Bolsa de compra", category: "Negocios", keywords: ["bolsa", "compras", "retail"], Component: ShoppingBagOutlinedIcon },
  { key: "PointOfSaleOutlined", label: "Punto de Venta", category: "Negocios", keywords: ["pos", "caja", "punto de venta", "terminal"], Component: PointOfSaleOutlinedIcon },

  // Invoices & Accounting
  { key: "ReceiptOutlined", label: "Facturas", category: "Facturación", keywords: ["facturas", "recibo", "boleta", "comprobante"], Component: ReceiptOutlinedIcon },
  { key: "ReceiptLongOutlined", label: "Factura Detallada", category: "Facturación", keywords: ["factura", "detalle", "comprobante", "ticket"], Component: ReceiptLongOutlinedIcon },
  { key: "AttachMoneyOutlined", label: "Dinero / Precios", category: "Facturación", keywords: ["dinero", "moneda", "precio", "dolar", "importe"], Component: AttachMoneyOutlinedIcon },
  { key: "AccountBalanceOutlined", label: "Bancos / Finanzas", category: "Facturación", keywords: ["banco", "finanzas", "institucion", "cuentas"], Component: AccountBalanceOutlinedIcon },
  { key: "CreditCardOutlined", label: "Tarjetas", category: "Facturación", keywords: ["tarjeta", "credito", "debito", "pago"], Component: CreditCardOutlinedIcon },
  { key: "RequestQuoteOutlined", label: "Cotizaciones", category: "Facturación", keywords: ["cotizacion", "presupuesto", "estimacion"], Component: RequestQuoteOutlinedIcon },
  { key: "AccountBalanceWalletOutlined", label: "Billetera", category: "Facturación", keywords: ["billetera", "saldo", "wallet", "fondos"], Component: AccountBalanceWalletOutlinedIcon },
  { key: "DescriptionOutlined", label: "Documentos", category: "Facturación", keywords: ["documento", "archivo", "hoja", "contrato"], Component: DescriptionOutlinedIcon },
  { key: "FactCheckOutlined", label: "Auditoría Contable", category: "Facturación", keywords: ["auditoria", "revision", "verificacion", "check"], Component: FactCheckOutlinedIcon },
  { key: "CalculateOutlined", label: "Cálculo / Impuestos", category: "Facturación", keywords: ["calculadora", "impuestos", "calculo", "iva", "contabilidad"], Component: CalculateOutlinedIcon },
  { key: "PriceCheckOutlined", label: "Control de Precios", category: "Facturación", keywords: ["precios", "tarifa", "aprobacion", "costo"], Component: PriceCheckOutlinedIcon },
  { key: "PaymentsOutlined", label: "Pagos y Cobros", category: "Facturación", keywords: ["pagos", "cobros", "transferencias", "dinero"], Component: PaymentsOutlinedIcon },

  // Logistics & Providers
  { key: "LocalShippingOutlined", label: "Proveedores / Envíos", category: "Logística", keywords: ["proveedores", "envios", "camion", "transporte", "despacho"], Component: LocalShippingOutlinedIcon },
  { key: "WarehouseOutlined", label: "Almacén", category: "Logística", keywords: ["almacen", "bodega", "deposito", "stock"], Component: WarehouseOutlinedIcon },
  { key: "QrCodeOutlined", label: "Código QR", category: "Logística", keywords: ["qr", "codigo qr", "barra"], Component: QrCodeOutlinedIcon },
  { key: "QrCodeScannerOutlined", label: "Escáner OCR", category: "Logística", keywords: ["escaner", "ocr", "lector", "camara"], Component: QrCodeScannerOutlinedIcon },
  { key: "AssignmentOutlined", label: "Asignaciones", category: "Logística", keywords: ["asignacion", "orden", "tarea", "guia"], Component: AssignmentOutlinedIcon },

  // Analytics & Reports
  { key: "AnalyticsOutlined", label: "Analítica", category: "Métricas", keywords: ["analitica", "metricas", "kpi", "estadisticas"], Component: AnalyticsOutlinedIcon },
  { key: "AssessmentOutlined", label: "Reportes", category: "Métricas", keywords: ["reportes", "informes", "evaluacion"], Component: AssessmentOutlinedIcon },
  { key: "BarChartOutlined", label: "Gráfico de Barras", category: "Métricas", keywords: ["grafico", "barras", "estadisticas", "kpi"], Component: BarChartOutlinedIcon },
  { key: "TrendingUpOutlined", label: "Tendencias", category: "Métricas", keywords: ["tendencia", "crecimiento", "subida", "progreso"], Component: TrendingUpOutlinedIcon },
  { key: "InsightsOutlined", label: "Métricas Clave", category: "Métricas", keywords: ["insights", "metricas", "hallazgos", "resumen"], Component: InsightsOutlinedIcon },
  { key: "PieChartOutlined", label: "Gráfico Circular", category: "Métricas", keywords: ["torta", "pie", "porcentajes", "distribucion"], Component: PieChartOutlinedIcon },
  { key: "ShowChartOutlined", label: "Gráfico Líneas", category: "Métricas", keywords: ["lineas", "evolucion", "tiempo", "curva"], Component: ShowChartOutlinedIcon },

  // Communication & Tools
  { key: "EmailOutlined", label: "Correo", category: "Utilidades", keywords: ["correo", "email", "mensajes", "buzon"], Component: EmailOutlinedIcon },
  { key: "NotificationsOutlined", label: "Notificaciones", category: "Utilidades", keywords: ["notificaciones", "campana", "alertas", "avisos"], Component: NotificationsOutlinedIcon },
  { key: "ChatOutlined", label: "Chat", category: "Utilidades", keywords: ["chat", "conversacion", "dialogo", "mensajeria"], Component: ChatOutlinedIcon },
  { key: "TranslateOutlined", label: "Traducciones", category: "Utilidades", keywords: ["traduccion", "idiomas", "lenguaje", "internacionalizacion"], Component: TranslateOutlinedIcon },
  { key: "LanguageOutlined", label: "Idiomas", category: "Utilidades", keywords: ["idioma", "mundo", "global", "region"], Component: LanguageOutlinedIcon },
  { key: "FolderOutlined", label: "Carpetas", category: "Utilidades", keywords: ["carpeta", "directorio", "archivos"], Component: FolderOutlinedIcon },
  { key: "FolderSharedOutlined", label: "Archivos Compartidos", category: "Utilidades", keywords: ["compartido", "red", "carpeta compartida"], Component: FolderSharedOutlinedIcon },
  { key: "CloudOutlined", label: "Nube", category: "Utilidades", keywords: ["nube", "cloud", "almacenamiento en nube"], Component: CloudOutlinedIcon },
  { key: "StorageOutlined", label: "Almacenamiento", category: "Utilidades", keywords: ["disco", "servidor", "base de datos", "storage"], Component: StorageOutlinedIcon },
  { key: "HelpOutlineOutlined", label: "Ayuda", category: "Utilidades", keywords: ["ayuda", "soporte", "faq", "pregunta"], Component: HelpOutlineOutlinedIcon },
  { key: "InfoOutlined", label: "Información", category: "Utilidades", keywords: ["informacion", "detalle", "info"], Component: InfoOutlinedIcon },
  { key: "CheckCircleOutlineOutlined", label: "Verificado", category: "Utilidades", keywords: ["verificado", "exito", "check", "aprobado"], Component: CheckCircleOutlineOutlinedIcon },
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
