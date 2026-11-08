# NodiaAI — Web conversacional y alternancia autorizada a Agentic

## Decisión actual — retirada Web autorizada el 2026-10-27

El usuario solicita e autoriza retirar Web de los tres proyectos y conservar sólo **Agentic** (`agentic`) y **API key** (`api_key`). Esta petición sustituye la conservación anterior de Web y la delegación Web→Agentic; API requiere verificación real posterior con credencial provista por el usuario. [Plan90 y mapa por proyecto](90-agentic-api-only-web-retirement.md), [verificación reusable de nuevos proveedores91](91-ai-provider-onboarding-verification.md) y [ADR083](../architecture/decisions/ADR-083-agentic-and-api-only-ai-modes.md). Implementación y VM pendientes; documentos/fichas sin aprobación/publicación automática. Los apartados inferiores conservan sus fechas y límites históricos.

> Continuidad AI-09: [persistencia55](55-nodia-ai-ai09-conversation-persistence.md) materializa contratos cerrados de esfuerzo/routing/etapas/presupuesto y migración M1, sin publicar rutas, worker o inferencias. Modelo completo revisión3:23 tablas/298 columnas/62 FKs; M1:11/151. La auditoría vinculada al chat pasa a CASCADE conforme50; pendientes mínimos siguen separados. Las menciones anteriores de wire/ERD pendiente describen el baseline anterior; runtime permanece AI-10..12.

> Estado: decisiones funcionales confirmadas por el usuario; diseño técnico en revisión, runtime sin implementar
> Fecha: 2026-10-14
> Fuentes: [alcance38](38-nodia-ai-research-and-v1-plan.md), [contratos41](41-nodia-ai-v1-contracts.md), [arquitectura43](43-nodia-ai-execution-architecture.md), [plan45](45-nodia-ai-implementation-plan.md), [AI-02](47-nodia-ai-ai02-gemini-web-viability.md)
> Decisión técnica propuesta: [ADR-036](../architecture/decisions/ADR-036-nodia-ai-opt-in-agentic-routing.md)

## Cambio confirmado

El usuario decide que Web sea sólo conversación y que Agentic utilice MCP. Solicita un switch en el drawer de modos/modelos/intensidad para alternar automáticamente a una sesión capaz cuando sea necesario. Ante la duda de una API disponible sin sesión Agentic, precisa: **en v1 alternar sólo a Agentic; incorporar API más adelante**.

Esto sustituye la intención anterior de publicar herramientas de negocio en Web. El éxito técnico del harness AI-02 permanece como evidencia histórica; sus herramientas fixture no se publicarán en el modo Web. Una conversación conserva su historial y puede usar varios modos, pero Web no consulta la BD de negocio ni prepara operaciones por sí mismo. El backend sigue gestionando mensajes, fichas funcionales autorizadas y preferencias del chat; esta restricción no impide esas funciones internas de Nodia.

La autorización automática es una elección explícita del usuario, distinta de cambiar de modo por un error. No autoriza otro proveedor, otras cuentas, rotación de claves o saltarse validaciones. OCR y demás consumidores actuales mantienen su política existente; esta excepción pertenece exclusivamente al nuevo chat NodiaAI.

## Drawer y elegibilidad

Etiqueta propuesta: **Alternar automáticamente a Agentic**. Control apagado por defecto. Preferencia por conversación como propuesta técnica; no una habilitación global por tener acceso al módulo. Sólo se muestra usando Web y con un destino Agentic de la misma conexión que reúna habilitación, autoridad, sesión, modelo configurado/discubierto y protocolo MCP verificados. Un flag `can_use_*`, API key guardada o sesión autenticada por sí solos no cumplen ese gate.

Si la observación caduca o desaparece el destino, no utilizarlo; informar que la alternancia está indisponible y permitir volver a comprobar/configurar. Ocultar el switch no equivale a borrar el consentimiento almacenado ni a reactivar un destino automáticamente. Reautorizar y comprobar disponibilidad al despachar, aunque la UI mostrara elegibilidad antes. Si Web no tiene destino elegible, continúa como conversación y explica que la petición de datos requiere Agentic; no inventa datos de la BD.

Modelo e intensidad pertenecen al modo. Usar el modelo/esfuerzo Agentic configurado en esa conexión, mostrándolo como destino; no copiar el modelo Web ni seleccionar el primero del catálogo. Sin destino exacto, no habilitar la alternancia. API y su eventual elección/consentimiento se definirán en su etapa; tener una key no muestra el switch en esta v1.

## Flujo propuesto

1. Con el switch apagado, una petición que necesite datos/herramientas ofrece cambiar manualmente a Agentic y conserva el contexto. No despacha MCP desde Web.
2. Con el switch encendido, Web/coordinador puede identificar una necesidad de herramientas y proponer una delegación tipada. Una clasificación del modelo no concede autoridad; Server valida política y destino. La detección no se ejecuta por frases mágicas ni por instrucciones de archivos/datos recuperados.
3. Antes de comenzar la fase Agentic, fijar su conexión/modo/modelo/intensidad y release, rehidratar el historial canónico permitido y reservar el runtime real. Mostrar que Agentic atenderá esa fase; no presentar sus operaciones como hechas por Web.
4. El agente consulta o prepara mediante MCP/ToolGateway; todas las restricciones y mínimos de los dominios se conservan. Una escritura requiere preview exacta y botón humano independiente del switch. Permitir alternancia no es confirmar comandos, gastar por API ni aprobar herramientas desconocidas.
5. Devolver estado/resultados al mismo chat con procedencia. Se propone delegación temporal conservando Web como selección base; el retorno/estancia y su wire contract deben concretarse antes de AI-12/13. No transformar una inferencia Web ya despachada en Agentic ni reetiquetar el mismo intento.

Si falla Web, Agentic, la clasificación o un callback, conservar la categoría/error/unknown y no usar otro modo para reparar el fallo. No reenviar efectos o inferencias inciertos. Desactivar el switch impide futuras delegaciones aún no admitidas; una ejecución ya confirmada conserva su identidad y usa sus mecanismos explícitos de cancelación/recuperación.

## Contratos y tareas afectadas

Concreción AI-04 del2026-10-15 en[50](50-nodia-ai-ai04-runtime-policy.md): una delegación temporal por run/mensaje, Web como base del siguiente turno, presupuesto durable común, comprobación revisionada del consentimiento antes de admitir la fase y selección exacta por intento. Sin tablas de workflow/run anidado. El wire/schema/rutas/ERD se materializan juntos AI-09/12;50 cierra semántica, no los presenta implementados. Conserva el gate de publicación indicado abajo.

Los contratos AI-01 siguen describiendo selección exacta de un intento. No contienen aún la política de routing ni la procedencia de una delegación. **No entregar esta función utilizando campos JSON libres o cambiando una Selection ya congelada.** AI-04/50 define semántica/versionado del consentimiento, destino/elegibilidad, un run por mensaje y presupuestos del conjunto. AI-09/12 deben materializar wire/schema/rutas/ERD y eventos públicos con historial compartido; revisar42/43/44 y fixtures antes de usarlo, sin aprobar campos/tablas por este documento.

| Tarea | Cambio requerido |
|---|---|
| AI-02 | Evidencia conservada; loop de herramientas Web descartado como función productiva por decisión del usuario |
| AI-03 | Verificar Agentic/MCP realmente y su aislamiento; no activar por existencia de binario/sesión |
| AI-04 | Incluir límites y consentimiento del routing; bloquear loops de delegación y resultados inciertos |
| AI-12 | Web conversacional, routing autorizado y adaptador MCP; contratos/fases exactos antes de publicar |
| AI-13 | Drawer con selección por modo, esfuerzo comprobado, switch y destino/estado visibles; ES/EN |
| AI-18 | Confirmación humana independiente de modo y permiso de alternancia |
| AI-28/29 | Proyecciones operativas por conexión/modo y credenciales seguras; API en su etapa |

No se modifica UI, BD, modelos, credenciales ni configuración de las conexiones existentes por este cambio documental. Los documentos dependientes permanecen en revisión; la aceptación del producto no aprueba automáticamente este diseño ni acredita disponibilidad.
