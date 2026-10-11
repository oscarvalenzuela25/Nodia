import type { ComponentType } from "react";
import type { SvgIconProps } from "@mui/material";
import { ICON_REGISTRY } from "./moduleIcons";

export interface IconDefinition {
  key: string;
  label: string;
  category: string;
  keywords?: string[];
  Component: ComponentType<SvgIconProps>;
}

export const AVAILABLE_ICONS: IconDefinition[] = [
  // AI & Automation
  {
    key: "SmartToy",
    label: "Robot / IA (Relleno)",
    category: "IA y Automatización",
    keywords: ["robot", "ia", "ai", "bot", "inteligencia artificial", "smarttoy", "proveedores", "gemini", "agente", "asistente", "proveedores de ia"],
    Component: ICON_REGISTRY.SmartToy,
  },
  {
    key: "SmartToyOutlined",
    label: "Robot / IA",
    category: "IA y Automatización",
    keywords: ["robot", "ia", "ai", "bot", "inteligencia artificial", "smarttoy", "proveedores", "gemini", "agente", "asistente", "proveedores de ia"],
    Component: ICON_REGISTRY.SmartToyOutlined,
  },
  {
    key: "PsychologyOutlined",
    label: "Cerebro / IA Cognitiva",
    category: "IA y Automatización",
    keywords: ["cerebro", "ia", "ai", "inteligencia", "mente", "cognitivo", "neuronal", "red neuronal", "modelo"],
    Component: ICON_REGISTRY.PsychologyOutlined,
  },
  {
    key: "AutoAwesomeOutlined",
    label: "Generación / Magia IA",
    category: "IA y Automatización",
    keywords: ["ia", "ai", "magia", "destellos", "generativo", "asistente", "auto", "stars", "sparkles"],
    Component: ICON_REGISTRY.AutoAwesomeOutlined,
  },
  {
    key: "PrecisionManufacturingOutlined",
    label: "Automatización / Procesos",
    category: "IA y Automatización",
    keywords: ["automatizacion", "robotica", "fabrica", "industria", "proceso", "maquinaria"],
    Component: ICON_REGISTRY.PrecisionManufacturingOutlined,
  },
  {
    key: "ModelTrainingOutlined",
    label: "Entrenamiento de Modelos",
    category: "IA y Automatización",
    keywords: ["modelo", "ia", "ai", "entrenamiento", "training", "machine learning", "ml", "pesos"],
    Component: ICON_REGISTRY.ModelTrainingOutlined,
  },
  {
    key: "AutoFixHighOutlined",
    label: "Mejora Automática / Prompting",
    category: "IA y Automatización",
    keywords: ["autofix", "correccion", "varita", "asistente", "ia", "ai", "mejora"],
    Component: ICON_REGISTRY.AutoFixHighOutlined,
  },
  {
    key: "SupportAgentOutlined",
    label: "Agente de Asistencia / Bot",
    category: "IA y Automatización",
    keywords: ["agente", "soporte", "asistente", "bot", "virtual", "servicio", "auriculares"],
    Component: ICON_REGISTRY.SupportAgentOutlined,
  },

  // Integrations & Dev
  {
    key: "ApiOutlined",
    label: "API / Endpoints",
    category: "Integraciones",
    keywords: ["api", "endpoints", "rest", "servicio", "integracion", "backend", "web services"],
    Component: ICON_REGISTRY.ApiOutlined,
  },
  {
    key: "WebhookOutlined",
    label: "Webhooks / Eventos",
    category: "Integraciones",
    keywords: ["webhook", "eventos", "http", "callback", "integracion", "notificaciones"],
    Component: ICON_REGISTRY.WebhookOutlined,
  },
  {
    key: "HubOutlined",
    label: "Nodos / Conexiones",
    category: "Integraciones",
    keywords: ["hub", "red", "nodos", "conexion", "central", "conectores"],
    Component: ICON_REGISTRY.HubOutlined,
  },
  {
    key: "CodeOutlined",
    label: "Código / Desarrollo",
    category: "Integraciones",
    keywords: ["codigo", "script", "desarrollo", "programacion", "code", "dev"],
    Component: ICON_REGISTRY.CodeOutlined,
  },
  {
    key: "TerminalOutlined",
    label: "Consola / Terminal",
    category: "Integraciones",
    keywords: ["terminal", "consola", "shell", "bash", "comando", "cli"],
    Component: ICON_REGISTRY.TerminalOutlined,
  },
  {
    key: "DataObjectOutlined",
    label: "Objeto de Datos / JSON",
    category: "Integraciones",
    keywords: ["datos", "json", "objeto", "schema", "payload", "estructura"],
    Component: ICON_REGISTRY.DataObjectOutlined,
  },
  {
    key: "DatasetOutlined",
    label: "Conjunto de Datos / Datasets",
    category: "Integraciones",
    keywords: ["dataset", "datos", "tablas", "ml", "coleccion", "big data"],
    Component: ICON_REGISTRY.DatasetOutlined,
  },
  {
    key: "MemoryOutlined",
    label: "Hardware / Procesamiento",
    category: "Integraciones",
    keywords: ["procesador", "cpu", "memoria", "hardware", "chip", "computo"],
    Component: ICON_REGISTRY.MemoryOutlined,
  },
  {
    key: "ExtensionOutlined",
    label: "Plugins / Extensiones",
    category: "Integraciones",
    keywords: ["plugin", "extension", "complemento", "modulo", "addon", "pieza"],
    Component: ICON_REGISTRY.ExtensionOutlined,
  },

  // General & System
  { key: "ViewModuleOutlined", label: "Módulos", category: "Sistema", keywords: ["modulo", "seccion", "sistema"], Component: ICON_REGISTRY.ViewModuleOutlined },
  { key: "SettingsOutlined", label: "Ajustes", category: "Sistema", keywords: ["configuracion", "ajustes", "opciones", "preferencias"], Component: ICON_REGISTRY.SettingsOutlined },
  { key: "CategoryOutlined", label: "Grupos / Categorías", category: "Sistema", keywords: ["grupo", "categoria", "clasificacion"], Component: ICON_REGISTRY.CategoryOutlined },
  { key: "WidgetsOutlined", label: "Widgets", category: "Sistema", keywords: ["widgets", "componentes", "bloques"], Component: ICON_REGISTRY.WidgetsOutlined },
  { key: "DashboardOutlined", label: "Dashboard", category: "Sistema", keywords: ["dashboard", "tablero", "inicio", "panel"], Component: ICON_REGISTRY.DashboardOutlined },
  { key: "AppsOutlined", label: "Aplicaciones", category: "Sistema", keywords: ["apps", "aplicaciones", "catalogo"], Component: ICON_REGISTRY.AppsOutlined },
  { key: "GridViewOutlined", label: "Cuadrícula", category: "Sistema", keywords: ["cuadricula", "rejilla", "grid"], Component: ICON_REGISTRY.GridViewOutlined },
  { key: "ViewAgendaOutlined", label: "Agenda", category: "Sistema", keywords: ["agenda", "calendario", "planificacion"], Component: ICON_REGISTRY.ViewAgendaOutlined },
  { key: "TuneOutlined", label: "Preferencias", category: "Sistema", keywords: ["tune", "filtros", "parametros", "controles"], Component: ICON_REGISTRY.TuneOutlined },
  { key: "BuildOutlined", label: "Herramientas", category: "Sistema", keywords: ["herramientas", "utilidades", "mantenimiento"], Component: ICON_REGISTRY.BuildOutlined },
  { key: "AdminPanelSettingsOutlined", label: "Admin Panel", category: "Sistema", keywords: ["admin", "administrador", "panel de control"], Component: ICON_REGISTRY.AdminPanelSettingsOutlined },
  { key: "HomeOutlined", label: "Inicio", category: "Sistema", keywords: ["inicio", "home", "principal"], Component: ICON_REGISTRY.HomeOutlined },
  { key: "HistoryOutlined", label: "Historial / Actividad", category: "Sistema", keywords: ["historial", "tiempo", "registro", "actividad", "logs"], Component: ICON_REGISTRY.HistoryOutlined },
  { key: "ManageHistoryOutlined", label: "Registro de Cambios", category: "Sistema", keywords: ["auditoria", "historial", "cambios", "trazabilidad"], Component: ICON_REGISTRY.ManageHistoryOutlined },
  { key: "SyncOutlined", label: "Sincronización", category: "Sistema", keywords: ["sincronizacion", "sync", "recargar", "actualizar"], Component: ICON_REGISTRY.SyncOutlined },

  // Identity & Security
  { key: "PersonOutlined", label: "Usuario", category: "Seguridad", keywords: ["usuario", "perfil", "persona", "cuenta"], Component: ICON_REGISTRY.PersonOutlined },
  { key: "PeopleOutlined", label: "Usuarios", category: "Seguridad", keywords: ["usuarios", "equipo", "personas", "miembros"], Component: ICON_REGISTRY.PeopleOutlined },
  { key: "GroupOutlined", label: "Grupo Usuarios", category: "Seguridad", keywords: ["grupo", "equipo", "comunidad"], Component: ICON_REGISTRY.GroupOutlined },
  { key: "BadgeOutlined", label: "Credencial", category: "Seguridad", keywords: ["credencial", "identificacion", "gafete"], Component: ICON_REGISTRY.BadgeOutlined },
  { key: "SecurityOutlined", label: "Seguridad / Roles", category: "Seguridad", keywords: ["seguridad", "roles", "permisos", "proteccion"], Component: ICON_REGISTRY.SecurityOutlined },
  { key: "ShieldOutlined", label: "Protección", category: "Seguridad", keywords: ["escudo", "proteccion", "defensa", "antivirus"], Component: ICON_REGISTRY.ShieldOutlined },
  { key: "LockOutlined", label: "Bloqueo", category: "Seguridad", keywords: ["candado", "bloqueo", "privado", "seguro"], Component: ICON_REGISTRY.LockOutlined },
  { key: "KeyOutlined", label: "Llave", category: "Seguridad", keywords: ["llave", "acceso", "clave", "credenciales"], Component: ICON_REGISTRY.KeyOutlined },
  { key: "VpnKeyOutlined", label: "Claves de Acceso", category: "Seguridad", keywords: ["claves", "api keys", "tokens", "credencial", "acceso"], Component: ICON_REGISTRY.VpnKeyOutlined },
  { key: "BoltOutlined", label: "Acciones / Permisos", category: "Seguridad", keywords: ["acciones", "rayo", "permisos", "rapido", "operaciones"], Component: ICON_REGISTRY.BoltOutlined },
  { key: "AddReactionOutlined", label: "Usuarios Reacción", category: "Seguridad", keywords: ["reaccion", "usuarios", "interaccion"], Component: ICON_REGISTRY.AddReactionOutlined },
  { key: "ManageAccountsOutlined", label: "Gestión de Cuentas", category: "Seguridad", keywords: ["cuentas", "gestion", "usuarios", "administracion"], Component: ICON_REGISTRY.ManageAccountsOutlined },
  { key: "SecurityUpdateGoodOutlined", label: "Seguridad Verificada", category: "Seguridad", keywords: ["seguridad", "escudo", "verificado", "actualizado"], Component: ICON_REGISTRY.SecurityUpdateGoodOutlined },

  // Business & Commerce
  { key: "StorefrontOutlined", label: "Negocios / Tienda", category: "Negocios", keywords: ["tienda", "negocio", "sucursal", "comercio"], Component: ICON_REGISTRY.StorefrontOutlined },
  { key: "BusinessCenterOutlined", label: "Empresa", category: "Negocios", keywords: ["empresa", "maletin", "corporativo", "negocios"], Component: ICON_REGISTRY.BusinessCenterOutlined },
  { key: "ApartmentOutlined", label: "Corporativo", category: "Negocios", keywords: ["edificio", "corporativo", "oficinas", "sede"], Component: ICON_REGISTRY.ApartmentOutlined },
  { key: "AccountTreeOutlined", label: "Estructura / Sucursales", category: "Negocios", keywords: ["arbol", "estructura", "sucursales", "organigrama", "jerarquia"], Component: ICON_REGISTRY.AccountTreeOutlined },
  { key: "Inventory2Outlined", label: "Inventario / Productos", category: "Negocios", keywords: ["inventario", "cajas", "productos", "stock"], Component: ICON_REGISTRY.Inventory2Outlined },
  { key: "LocalOfferOutlined", label: "Ofertas", category: "Negocios", keywords: ["ofertas", "descuentos", "etiquetas", "promociones"], Component: ICON_REGISTRY.LocalOfferOutlined },
  { key: "SellOutlined", label: "Ventas / Catálogo", category: "Negocios", keywords: ["ventas", "catalogo", "etiqueta", "precios"], Component: ICON_REGISTRY.SellOutlined },
  { key: "ShoppingCartOutlined", label: "Carrito", category: "Negocios", keywords: ["carrito", "compras", "pedidos"], Component: ICON_REGISTRY.ShoppingCartOutlined },
  { key: "ShoppingBagOutlined", label: "Bolsa de compra", category: "Negocios", keywords: ["bolsa", "compras", "retail"], Component: ICON_REGISTRY.ShoppingBagOutlined },
  { key: "PointOfSaleOutlined", label: "Punto de Venta", category: "Negocios", keywords: ["pos", "caja", "punto de venta", "terminal"], Component: ICON_REGISTRY.PointOfSaleOutlined },

  // Invoices & Accounting
  { key: "ReceiptOutlined", label: "Facturas", category: "Facturación", keywords: ["facturas", "recibo", "boleta", "comprobante"], Component: ICON_REGISTRY.ReceiptOutlined },
  { key: "ReceiptLongOutlined", label: "Factura Detallada", category: "Facturación", keywords: ["factura", "detalle", "comprobante", "ticket"], Component: ICON_REGISTRY.ReceiptLongOutlined },
  { key: "AttachMoneyOutlined", label: "Dinero / Precios", category: "Facturación", keywords: ["dinero", "moneda", "precio", "dolar", "importe"], Component: ICON_REGISTRY.AttachMoneyOutlined },
  { key: "AccountBalanceOutlined", label: "Bancos / Finanzas", category: "Facturación", keywords: ["banco", "finanzas", "institucion", "cuentas"], Component: ICON_REGISTRY.AccountBalanceOutlined },
  { key: "CreditCardOutlined", label: "Tarjetas", category: "Facturación", keywords: ["tarjeta", "credito", "debito", "pago"], Component: ICON_REGISTRY.CreditCardOutlined },
  { key: "RequestQuoteOutlined", label: "Cotizaciones", category: "Facturación", keywords: ["cotizacion", "presupuesto", "estimacion"], Component: ICON_REGISTRY.RequestQuoteOutlined },
  { key: "AccountBalanceWalletOutlined", label: "Billetera", category: "Facturación", keywords: ["billetera", "saldo", "wallet", "fondos"], Component: ICON_REGISTRY.AccountBalanceWalletOutlined },
  { key: "DescriptionOutlined", label: "Documentos", category: "Facturación", keywords: ["documento", "archivo", "hoja", "contrato"], Component: ICON_REGISTRY.DescriptionOutlined },
  { key: "FactCheckOutlined", label: "Auditoría Contable", category: "Facturación", keywords: ["auditoria", "revision", "verificacion", "check"], Component: ICON_REGISTRY.FactCheckOutlined },
  { key: "CalculateOutlined", label: "Cálculo / Impuestos", category: "Facturación", keywords: ["calculadora", "impuestos", "calculo", "iva", "contabilidad"], Component: ICON_REGISTRY.CalculateOutlined },
  { key: "PriceCheckOutlined", label: "Control de Precios", category: "Facturación", keywords: ["precios", "tarifa", "aprobacion", "costo"], Component: ICON_REGISTRY.PriceCheckOutlined },
  { key: "PaymentsOutlined", label: "Pagos y Cobros", category: "Facturación", keywords: ["pagos", "cobros", "transferencias", "dinero"], Component: ICON_REGISTRY.PaymentsOutlined },

  // Logistics & Providers
  { key: "LocalShippingOutlined", label: "Proveedores / Envíos", category: "Logística", keywords: ["proveedores", "envios", "camion", "transporte", "despacho"], Component: ICON_REGISTRY.LocalShippingOutlined },
  { key: "WarehouseOutlined", label: "Almacén", category: "Logística", keywords: ["almacen", "bodega", "deposito", "stock"], Component: ICON_REGISTRY.WarehouseOutlined },
  { key: "QrCodeOutlined", label: "Código QR", category: "Logística", keywords: ["qr", "codigo qr", "barra"], Component: ICON_REGISTRY.QrCodeOutlined },
  { key: "QrCodeScannerOutlined", label: "Escáner OCR", category: "Logística", keywords: ["escaner", "ocr", "lector", "camara"], Component: ICON_REGISTRY.QrCodeScannerOutlined },
  { key: "AssignmentOutlined", label: "Asignaciones", category: "Logística", keywords: ["asignacion", "orden", "tarea", "guia"], Component: ICON_REGISTRY.AssignmentOutlined },

  // Analytics & Reports
  { key: "AnalyticsOutlined", label: "Analítica", category: "Métricas", keywords: ["analitica", "metricas", "kpi", "estadisticas"], Component: ICON_REGISTRY.AnalyticsOutlined },
  { key: "AssessmentOutlined", label: "Reportes", category: "Métricas", keywords: ["reportes", "informes", "evaluacion"], Component: ICON_REGISTRY.AssessmentOutlined },
  { key: "BarChartOutlined", label: "Gráfico de Barras", category: "Métricas", keywords: ["grafico", "barras", "estadisticas", "kpi"], Component: ICON_REGISTRY.BarChartOutlined },
  { key: "TrendingUpOutlined", label: "Tendencias", category: "Métricas", keywords: ["tendencia", "crecimiento", "subida", "progreso"], Component: ICON_REGISTRY.TrendingUpOutlined },
  { key: "InsightsOutlined", label: "Métricas Clave", category: "Métricas", keywords: ["insights", "metricas", "hallazgos", "resumen"], Component: ICON_REGISTRY.InsightsOutlined },
  { key: "PieChartOutlined", label: "Gráfico Circular", category: "Métricas", keywords: ["torta", "pie", "porcentajes", "distribucion"], Component: ICON_REGISTRY.PieChartOutlined },
  { key: "ShowChartOutlined", label: "Gráfico Líneas", category: "Métricas", keywords: ["lineas", "evolucion", "tiempo", "curva"], Component: ICON_REGISTRY.ShowChartOutlined },

  // Communication & Tools
  { key: "EmailOutlined", label: "Correo", category: "Utilidades", keywords: ["correo", "email", "mensajes", "buzon"], Component: ICON_REGISTRY.EmailOutlined },
  { key: "NotificationsOutlined", label: "Notificaciones", category: "Utilidades", keywords: ["notificaciones", "campana", "alertas", "avisos"], Component: ICON_REGISTRY.NotificationsOutlined },
  { key: "ChatOutlined", label: "Chat", category: "Utilidades", keywords: ["chat", "conversacion", "dialogo", "mensajeria"], Component: ICON_REGISTRY.ChatOutlined },
  { key: "TranslateOutlined", label: "Traducciones", category: "Utilidades", keywords: ["traduccion", "idiomas", "lenguaje", "internacionalizacion"], Component: ICON_REGISTRY.TranslateOutlined },
  { key: "LanguageOutlined", label: "Idiomas", category: "Utilidades", keywords: ["idioma", "mundo", "global", "region"], Component: ICON_REGISTRY.LanguageOutlined },
  { key: "FolderOutlined", label: "Carpetas", category: "Utilidades", keywords: ["carpeta", "directorio", "archivos"], Component: ICON_REGISTRY.FolderOutlined },
  { key: "FolderSharedOutlined", label: "Archivos Compartidos", category: "Utilidades", keywords: ["compartido", "red", "carpeta compartida"], Component: ICON_REGISTRY.FolderSharedOutlined },
  { key: "CloudOutlined", label: "Nube", category: "Utilidades", keywords: ["nube", "cloud", "almacenamiento en nube"], Component: ICON_REGISTRY.CloudOutlined },
  { key: "StorageOutlined", label: "Almacenamiento", category: "Utilidades", keywords: ["disco", "servidor", "base de datos", "storage"], Component: ICON_REGISTRY.StorageOutlined },
  { key: "HelpOutlineOutlined", label: "Ayuda", category: "Utilidades", keywords: ["ayuda", "soporte", "faq", "pregunta"], Component: ICON_REGISTRY.HelpOutlineOutlined },
  { key: "InfoOutlined", label: "Información", category: "Utilidades", keywords: ["informacion", "detalle", "info"], Component: ICON_REGISTRY.InfoOutlined },
  { key: "CheckCircleOutlineOutlined", label: "Verificado", category: "Utilidades", keywords: ["verificado", "exito", "check", "aprobado"], Component: ICON_REGISTRY.CheckCircleOutlineOutlined },
];

