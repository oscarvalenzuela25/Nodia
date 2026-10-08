# Tarjeta Resumen de Conexión API (OpenAI / Gemini) en Ajustes IA

Fecha: 2026-10-07. Implementación aprobada y validada según el contrato funcional de proveedores IA.

## Contexto y problema resuelto

Anteriormente, las conexiones con canal API Key habilitado (como OpenAI / ChatGPT, o Gemini en modo API) caían erróneamente en la tarjeta vacía *"Sin configurar"* si la inferencia generativa aún no había sido ejecutada o comprobada contra el backend. Esto generaba confusión visual:
- Se ocultaban los datos reales configurados en la base de datos (claves registradas, modelo seleccionado, nivel de razonamiento, rotación).
- Se mostraba un texto genérico invitando a configurar una sesión Web o Agentic que OpenAI no posee.
- No se distinguía entre una conexión no configurada, requisitos incompletos (falta de clave o modelo) y una conexión con configuración guardada pendiente de verificación.

## Solución implementada

Se actualizó la tarjeta de proveedor (`ProviderCard.tsx`) y el caso de uso unificado de salud (`GetAiProvidersHealthUseCase`) para estructurar y presentar con veracidad las conexiones con modo API habilitado:

1. **Corrección de la clasificación visual:**
   - La tarjeta vacía fallback (*"Sin configurar"*) ahora solo se renderiza cuando el proveedor realmente **no tiene canales de conexión configurados** (`!provider.use_api_key && !provider.use_token_plan_web && !provider.use_token_plan_agentic`).
   - Toda conexión con API habilitada y conexión en base de datos renderiza la tarjeta estructurada completa, sin importar si su inferencia fue o no verificada.

2. **Estructura visual coherente (modelo Gemini):**
   - **Cabecera:** Icono del proveedor, nombre, badge `Predeterminado` (si aplica), subtítulo *"Canal configurado: API Key"* (o plural si comparte canales). Status pill en esquina superior derecha (*"SIN VERIFICAR"*, *"DESACTIVADO"*, etc.).
   - **Métricas:** Bloque con `ESTADO DE SERVICIO` (información comprobable sobre configuración o requisitos pendientes) y `ÚLTIMA COMPROBACIÓN` (*"Sin comprobación verificada"* mientras no exista una comprobación real con timestamp).
   - **Panel API Reutilizable:** Diseñado para aprovechar el ancho disponible de la tarjeta (100% de ancho en OpenAI, proporcional en tarjetas con múltiples modos).
   - **Switch:** `Proveedor Predeterminado` disponible cuando existen múltiples conexiones.
   - **Acciones inferiores:** `Ir al detalle`, `Configurar Proveedor` y `Modelos`.

3. **Información expuesta en el panel API:**
   - **Modelo seleccionado:** Nombre del modelo en `CodeBadge`. Si falta, muestra explícitamente *"Sin asignar"* con botón directo para configurar modelo.
   - **Modelo OCR asignado:** Mostrado si está configurado en `fields.api_key`.
   - **Nivel de razonamiento (`thinking_level`):** Preferencia configurada (Low / Medium / High) o *"Por defecto del modelo"*.
   - **Claves registradas:** Conteo real de claves asociadas a la conexión en la base de datos.
   - **Clave seleccionada:** Etiqueta pública y máscara segura (`display_hint`, ej. `sk-...4321`). **Cero exposición de secretos completos.** Si falta clave seleccionada, muestra advertencia *"Sin clave seleccionada"* con botón para configurar clave en el detalle.
   - **Rotación automática:** Estado de `auto_rotate_api_keys` (*"Habilitada"* / *"Deshabilitada"*).

4. **Veracidad de información:**
   - No se inventan fechas, latencias, saldos, cuotas ni porcentajes operativos.
   - No se hardcodean nombres o fallbacks estáticos de modelos.
   - Estados de servicio claros y honestos: *"API configurada; inferencia sin verificar"*, *"Falta configurar clave API y modelo"*, o *"Proveedor desactivado"*.

## Garantías y regresiones cubiertas

- **Server (`GetAiProvidersHealthUseCase.spec.ts`):**
  - Conexión API con clave y modelo reporta `status: 'unverified'`, `statusBadge: 'SIN VERIFICAR'`, `serviceState: 'API configurada; inferencia sin verificar'`, `selectedApiKey` con máscara y conteo de claves.
  - Ausencia de clave o modelo reporta `status: 'degraded'` con detalle de requisitos pendientes.
  - Proveedor desactivado reporta `statusBadge: 'DESACTIVADO'` y `serviceState: 'Proveedor desactivado'`.
- **Client (`ProviderCard.test.tsx`):**
  - Renderizado completo de cabecera, panel API, métricas y acciones.
  - Requisitos faltantes muestran badges de advertencia y botones directos hacia el detalle, sin caer en la tarjeta vacía.
  - Proveedor desactivado muestra estado DESACTIVADO.
  - Tarjeta vacía se restringe exclusivamente a proveedores sin ningún canal configurado.
