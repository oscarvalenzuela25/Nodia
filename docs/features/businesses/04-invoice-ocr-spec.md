# Especificación Técnica: Pipeline de Facturas e Inteligencia Artificial (OCR)

> Estado: borrador preliminar para contraste con base de datos
> Fecha de creación: 2026-09-15
> Tecnologías: Gemini 2.5 Flash Multimodal, Cloudflare R2 / S3 Storage, TypeScript

---

## 1. Justificación de Tecnologías: Gemini vs Tesseract

### ¿Por qué Tesseract no es adecuado para facturas heterogéneas?
1. **Pérdida de estructura tabular:** Tesseract extrae una cadena plana de texto plano (OCR clásico de caracteres). Al no comprender el diseño visual, mezcla celdas de precios con cantidades o descripciones adyacentes.
2. **Fragilidad ante proveedores variables:** Cada factura emitida por un proveedor distinto tiene un formato, tipografía y distribución espacial diferente. Tesseract exigiría crear y mantener expresiones regulares (regex) artesanales e hiperfrágiles por cada proveedor.
3. **Sensibilidad a imágenes de baja calidad:** Las fotografías de facturas tomadas con smartphones (con sombras, inclinación o arrugas) generan tasas de error inaceptables en OCR tradicional.

### Ventajas de Gemini 2.5 Flash Multimodal
1. **Comprensión contextual de documentos:** El modelo comprende la jerarquía visual humana (cabeceras, totales, tablas de ítems, descuentos y recargos).
2. **Salida JSON Estricta (Structured Outputs):** Mediante `responseSchema`, garantiza que el resultado sea siempre un objeto JSON válido con los tipos de datos exactos (números para precios, strings limpios para nombres).
3. **Eficiencia en costos y latencia:** Gemini 2.5 Flash ofrece procesamiento en menos de 2 segundos y costos de fracciones de centavo por comprobante (~$0.0001 USD), permitiendo operar dentro de los tiers gratuitos de Google AI Studio.

---

## 2. Estrategia de Autenticación y Consumo de IA (Google AI Pro / BYOK)

* **Soporte Híbrido (Clave del Sistema o Plan Propio del Usuario):**
  1. **Clave por Defecto del Sistema:** Si el usuario no proporciona una clave, el backend utiliza la clave configurada en sus variables de entorno (`GEMINI_API_KEY`).
  2. **Plan Propio Google AI Pro (BYOK - Bring Your Own Key):**
     * Si el usuario cuenta con suscripción / facturación de **Google AI Pro** en su cuenta de Google, genera su API Key en [Google AI Studio](https://aistudio.google.com/) con un clic.
     * En Nodia, el usuario ingresa su API Key en la configuración del negocio (guardada de forma cifrada en `businesses.gemini_api_key`).
     * Al procesar una factura, las peticiones se autentican con esa clave, consumiendo directamente los tokens y cuotas de su plan Pro.
* **Selección de Modelo en UI:**
  * **Modo Rápido:** `gemini-2.5-flash` (alta velocidad, costo mínimo).
  * **Modo Pro / Razonamiento Avanzado:** `gemini-2.5-pro` (aprovecha la potencia del plan Pro para deducir tablas contables complejas).
* **Métrica de Tokens Consumidos:**
  * En cada respuesta, Gemini devuelve el objeto `usageMetadata` con `promptTokenCount` y `candidatesTokenCount`.
  * El backend registra automáticamente el total en `invoices.tokens_consumed` y `invoices.model_used` para que el usuario pueda auditar su consumo exacto en la pestaña de Analítica del Negocio.

---

## 3. Almacenamiento de Comprobantes (Storage): Cloudflare R2 vs Google Drive

| Criterio | Cloudflare R2 (Recomendado) | Google Drive del Usuario |
|---|---|---|
| **Experiencia de Usuario** | **Inmediata y sin fricción:** El usuario solo sube la foto y el sistema la gestiona. | **Alta fricción:** Requiere autorizaciones adicionales, vincular carpetas y lidiar con límites de cuota personal. |
| **Complejidad Técnica** | **Baja:** Compatible con el estándar S3 (`@aws-sdk/client-s3`). Presigned URLs y control de acceso backend. | **Muy alta:** Requiere ampliar los scopes de Google OAuth (`drive.file`), gestionar refresh tokens de Google y superar pantallas de verificación de app. |
| **Costos** | 10 GB de almacenamiento gratuito perpetuo y **$0 por transferencia de salida (egress free)**. | Depende del plan del usuario personal. |

**Decisión:** Se implementará un `StorageService` en NestJS configurado por defecto con **Cloudflare R2** (o cualquier proveedor S3 compatible). La arquitectura queda desacoplada mediante interfaz para permitir conectar Google Drive en el futuro si se deseara como opción opcional.

---

## 4. Pipeline de Conciliación y Matching de Productos

```
[ Factura (Imagen/PDF) + provider_id ]
         │
         ▼
[ Inyección de Plantilla (invoice_fields) ]
   └── Mapeo de columnas específicas del proveedor
         │
         ▼
[ Gemini 2.5 Flash / Pro ] ──> JSON Estructurado: { proveedor, items: [...], delivery_cost }
         │
         ▼
[ Algoritmo de Matching & Cálculo de Costo ]
   ├── 1. Coincidencia exacta por SKU / Código
   ├── 2. Coincidencia por similitud fonética/texto (Trigram / Levenshtein)
   └── 3. Prorrateo de Delivery: Si provider.include_delivery_in_cost es true,
          costo_unitario_efectivo = unit_price + (delivery_cost / total_unidades)
         │
         ▼
[ Vista de Conciliación en UI ]
   ├── Producto A: [Existente] Costo anterior: $10.00 ──> Factura (+delivery): $12.50 (+25% 🔺)
   ├── Producto B: [Existente] Costo anterior: $50.00 ──> Factura (+delivery): $48.00 (-4% 🔻)
   └── Producto C: [Nuevo detectado] ──> Opción de crear producto con 1 clic
         │
         ▼
[ Confirmación del Usuario ]
   ├── Actualización masiva de `products.cost_price` y `last_cost_price`
   ├── Inserción cronológica en `product_logs` (con snapshot anterior y delivery aplicado)
   └── Actualización de estado en `invoices`
```

### Esquema JSON Solicitado a Gemini

```json
{
  "supplierName": "Distribuidora Mayorista S.A.",
  "invoiceNumber": "F-00045892",
  "invoiceDate": "2026-09-14",
  "totalAmount": 154200.00,
  "items": [
    {
      "code": "BEB-001",
      "name": "Bebida Cola 1.5L",
      "quantity": 24,
      "unitPrice": 1250.00,
      "totalPrice": 30000.00
    }
  ]
}
```

---

## 5. Exportación a CSV

El sistema ofrecerá dos opciones de exportación inmediata mediante utilidades en cliente/servidor:
1. **Exportación de Factura:** Descarga directa de la tabla de extracción resultante del análisis (con columnas: Código, Descripción, Cantidad, Precio Unitario, Total, Coincidencia en Sistema).
2. **Exportación de Catálogo:** Descarga de los productos del negocio con sus costos y precios actuales tras la reconciliación.
