# Evidencia de QA

Esta carpeta conserva resultados textuales que respaldan verificaciones documentadas.
Por solicitud del usuario del2026-11-16, las imágenes de validación se mantienen
fuera de Git: capturas nuevas en `output/` o `.tmp/`, ambos ignorados.

Las247capturas históricas retiradas (16486902bytes) conservan sus originales y
SHA256 en el [catálogo de archivo](validation-images-archive-20261116.md).
Los enlaces permanentes permiten consultar los bytes históricos sin volver a
versionarlos; no se reescribe el historial Git ni se modifican JSON firmados.

| Carpeta | Evidencia | Contexto |
| --- | --- | --- |
| [mobile-navigation](mobile-navigation/) | `responsive-evidence.json` con medidas de layout; capturas en el catálogo | [Plan móvil, verificación local](../mvp/35-mobile-cards-shortcuts-plan.md) |
| [Archivo de capturas](validation-images-archive-20261116.json) | Incluye `ai-provider-health/loading-dark-es.png` y las demás capturas históricas | [Registro de progreso](../mvp/00-progress.md) |

Estas verificaciones utilizaron fixtures aislados. Las capturas y medidas no acreditan autenticación, inferencia ni disponibilidad de servicios reales.

Los resultados descartables, capturas y logs pertenecen al almacenamiento local.
Incorporar aquí únicamente evidencia textual revisada y enlazada desde su
documento correspondiente, sin secretos ni datos de usuarios reales. La regla
de capturas no elimina assets funcionales o diagramas mantenidos como código.
