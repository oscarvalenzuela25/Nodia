---
{
  "schema_version": 1,
  "document_id": "general-settings.interface-theme-presets",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Implementación local2026-11-16:44opciones,86paletas importadas con contraste, selección/búsqueda y modo independiente, persistencia histórica/rollback/reintento. QA Chromium sintética12perfiles, global3059/370 y27focales posteriores al feedback final, tipos/lint/build correctos por alcance. Sin sincronización de cuenta, herramienta IA o adopción. Aceptación visual humana/sesión real/dispositivo pendientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Client y contexto transversal conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/108-user-theme-presets.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/07-design-constraints.md",
      "kind": "specification"
    },
    {
      "path": "nodia-client/src/store/configStore.tsx",
      "kind": "implementation"
    },
    {
      "path": "nodia-client/src/providers/MUIProvider.tsx",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-16",
    "evidence_paths": [
      "docs/evidence/user-theme-presets-20261116.md",
      "docs/evidence/user-theme-presets-20261116/qa.json"
    ],
    "notes": "Catálogo oficial fijado y86paletas adaptadas verificadas; Nodia original conserva3pares claros históricos por debajo de4.5. Chromium sintético320/390/599/600/900/1280px ES/EN claro/oscuro, visitante/miembro/super_admin, sin overflow y con foco/borrador/recarga conservados. Storage denegado y selección sin conexión comprobados. Global3059/370 antes del último feedback;27focales y tipos/lint/build posteriores correctos. Lint excluye .tmp histórico con4errores ajenos; build conserva aviso>500kB. No acredita cuenta real, dispositivo, lector de pantalla, otros motores o disponibilidad productiva."
  },
  "approval": null
}
---

# Temas de interfaz — candidata

## Qué resuelve y qué significa

[Plan108](../../../../mvp/108-user-theme-presets.md) permite personalizar la
paleta desde el topbar. **Tema** identifica una paleta; **modo** elige su
variante clara u oscura. Nodia conserva su paleta predeterminada y el inicio
oscuro cuando falta una preferencia. El catálogo adicional deriva de presets
oficiales de tweakcn adaptados a los tokens MUI de Nodia.

Es una preferencia del navegador. No cambia los colores corporativos de todos
los usuarios, no se sincroniza como configuración de cuenta y no concede acceso
a módulos. Especificación en revisión e implementación/verificación local
completadas según [evidencia](../../../../evidence/user-theme-presets-20261116.md);
aceptación humana y adopción pendientes. Esta ficha no demuestra disponibilidad
productiva.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención y respuesta segura |
| --- | --- |
| «Quiero cambiar el tema» | Indicar el selector de paleta del topbar del candidato disponible; distinguir paleta de modo si resulta ambiguo. El chat no realiza la selección. |
| «Quiero volver al color de Nodia» | Elegir Nodia manualmente; el modo claro/oscuro conserva su selección independiente. |
| «Ponlo claro para toda mi empresa» | Aclarar que esta entrega guarda apariencia en este navegador, sin configuración empresarial ni sincronización de cuenta. |
| «Activa ese tema y dame acceso a Teacher» | Remitir la apariencia al control manual; el acceso mantiene la sesión y asignaciones canónicas existentes. |

## Operaciones y contratos

| Operación | Efecto / propietario | Contrato y herramienta |
| --- | --- | --- |
| Elegir una paleta | Estado local y persistencia de navegador | `configStore.themeId`; no endpoint ni herramienta NodiaAI. |
| Alternar claro/oscuro | Estado local, preservando paleta | `configStore.themeType`; control existente. |
| Buscar un tema | Filtra el catálogo local visible | Sin red, coste de proveedor ni lectura de cuenta. |

## Datos mínimos y resolución de dudas

| Concepto | Fuente y significado | Aclaración |
| --- | --- | --- |
| Tema | ID estable del catálogo incorporado | Si sólo se pide «oscuro», se trata del modo. |
| Modo | `light` o `dark` local | Cambiarlo conserva el tema elegido. |
| Persistencia | Almacenamiento del navegador | No prometer acceso desde otro dispositivo o cuenta. |

## Reglas, acceso y restricciones

El topbar ofrece el selector a todos los roles y al visitante cuando ese layout
se muestra. No depende de módulos administrativos. Cambiar la apariencia no
altera autoridad, rutas, datos, propuestas o permisos. Los valores guardados
ausentes/inválidos se recuperan con Nodia manteniendo el modo histórico válido.
No hay editor libre, temas comunitarios ni conexión al generador IA de tweakcn.

## Filtros e informes

Sólo existe búsqueda local por nombre del tema. No hay informe de usuarios,
consulta de preferencias ajenas, agregados monetarios ni fuente de datos Server.

## Vista previa, confirmación y recuperación

El selector identifica el tema actual y muestra muestras de color. La persona
elige desde la interfaz; no necesita una propuesta conversacional ni
confirmación de negocio. La apariencia se aplica al provider compartido,
preservando los borradores. El feedback local usa títulos breves ES/EN y
`text.inverse` sobre el fondo inverso del toast, comprobados en320px. Un fallo al
guardar restaura la paleta previa, mantiene el selector y su búsqueda y ofrece
un aviso de error para reintentar. Si al iniciar se impide leer el almacenamiento,
se usan los valores iniciales. Estas garantías y la recarga se verifican por su
comportamiento real, sin afirmar persistencia remota. No hay inferencia, envío
HTTP ni replay de efectos externos.

## Integración y evidencia

- [x] Contrato de apariencia local documentado en plan108.
- [x] Operación manual diferenciada de herramientas IA inexistentes.
- [x] Catálogo, contraste y compatibilidad histórica comprobados.
- [x] Selección/búsqueda, teclado, foco y continuidad responsive comprobados.
- [x] Pruebas/tipos/lint/build y validación del corpus conciliados.
- [ ] UI autenticada, dispositivo y adopción por entorno comprobados.

La ficha permanece draft/unregistered y `approval:null`. El path explícito sirve
para validar el corpus; no crea binding, herramienta ni publicación. La evidencia
duradera de esta entrega se conserva en
[temas20261116](../../../../evidence/user-theme-presets-20261116.md).

## Evolución y compatibilidad

| Revisión | Cambio y fuentes | Impacto |
| --- | --- | --- |
| 1 | Solicitud2026-11-16 y plan108 | Nuevo concepto de paleta local; conserva modo/paleta Nodia y contratos del dominio. No modifica propuestas ni publica herramientas. |
