# Indicadores de modos IA en el topbar

Solicitud del usuario del 2026-10-08; implementación local, sin aprobación automática de documentos.

## Comportamiento

- Sin una conexión `is_default: true`, no se renderiza este grupo opcional. Con predeterminado, muestra hasta tres iconos según los modos habilitados de esa instancia: llave para `api_key`, globo para `token_plan_web` y razonamiento para `token_plan_agentic`. Los flags explícitos false prevalecen sobre el modo histórico.
- Solo se monta para una sesión validada con acción `ai:manage` y acceso al módulo `/settings/ai-providers`, conforme al endpoint y al guard de la página. No modifica los permisos del servidor.
- Consume `GET /ai-providers/health` mediante el hook y caché existentes `ai-providers-health`, con intervalo de 30 segundos. No agrega una consulta al listado ni a `gemini-engines`.
- Punto verde (`theme.palette.success.main`): sesión Web/Agentic disponible y autenticada en la observación correspondiente. Para Codex usa `codexSession` de la misma conexión y respeta `usageAllowed: false`. El tooltip aclara que una sesión disponible no acredita inferencia.
- Punto rojo (`theme.palette.error.main`): requiere revisión o estado sin verificar. Datos ausentes, inválidos o un refetch fallido no acreditan disponibilidad. En API, solo un estado saludable observado del propio modo puede ser verde; la respuesta actual de Server mantiene la API configurada como `unverified`, por lo que una clave/modelo guardados no producen verde.
- Durante revalidación conserva los iconos y deshabilita sus botones. Al fallar, conserva el acceso al panel, marca la observación como sin verificar y utiliza el toast global de QueryCache; no agrega feedback duplicado.
- Clic: `/settings/ai-providers?provider=<ID>&mode=<modo>`, abriendo la instancia exacta y su pestaña habilitada. No inicia OAuth automáticamente. Web/Agentic ofrecen sus acciones de login existentes; API ofrece gestión de claves.
- En menos de 600 px, los indicadores ocupan una segunda fila para conservar juntos menú, idioma, tema y avatar. Desde 600 px quedan en una fila. Nombres accesibles y tooltips traducidos ES/EN; controles accesibles por teclado.

## Evidencia y límites

Pruebas sintéticas de componentes: ausencia de predeterminado, tres modos independientes, caché compartida, navegación por ID/modo, permisos, configuración histórica, cambio de predeterminado, datos ausentes/malformados, sesión Codex propia/uso denegado, revalidación pendiente, fallo con datos previos, recuperación y traducciones. Pruebas de página/detalle comprueban apertura por URL de la pestaña solicitada y regreso al resumen.

Suite completa Client: 946 pruebas en 157 archivos correctas. Revalidación focalizada posterior a ajustes de UI y navegación: 55 pruebas en cuatro archivos correctas. Tipado/lint/build comprobados al cierre. Navegador local con fixtures aislados comprobó 320/600/1280 px, temas claro/oscuro, ES/EN y recorrido Tab entre indicadores; los botones permanecen dentro del ancho del header. Fixtures temporales retirados tras QA.

No se autenticaron cuentas, consumieron inferencias, modificaron claves/BD ni reiniciaron servicios del usuario. La UI utiliza el contrato de salud existente; no implementa un probe de inferencia API. Verificación autenticada contra los servicios reales pendiente.
