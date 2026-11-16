# ADR-105 — Noticias públicas y acceso separado por fuente

> Estado: propuesto
> Fecha:2026-11-16

## Contexto

El usuario confirma Noticias pública debajo de Home; fuentes gratuitas sin cupo
periódico para anónimos y fuentes con cuota sólo para sesiones Nodia válidas,
independientemente de rol/módulo. El [plan105§8](../../mvp/105-on-demand-tech-news.md#8-news-01-acceso-público-y-catálogo-inicial--2026-11-16)
sucede la propuesta previa de asignación por módulo. Afecta navegación, auth,
política HTTP y caché. Crear la página no puede abrir otros recursos privados.

La solicitud posterior [105§9](../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
reserva toda obtención externa al super_admin, también las fuentes públicas;
cualquier otra persona sólo lee lo conservado. Esta revisión sustituye la
obtención por cualquier sesión o anónimos propuesta en el corte anterior.

## Opciones consideradas

### Opción A — Módulo privado con acceso automático general

- Ventaja: reutiliza GuardStrict y asignaciones.
- Desventajas: excluye anónimos o exige crear identidades/asignaciones ficticias;
  confunde acceso público con permisos de módulos.

### Opción B — Destino público y contratos separados por capa de fuente

- Ventajas: cumple acceso anónimo y protege cuota/datos de fuentes limitadas;
  permite mantener autorización privada actual sin un bypass por prefijo.
- Desventajas: requiere delimitar rutas exactas, identidad y separación de caché,
  además de resolver recuperación de sesión sin bloquear la lectura pública.

### Opción C — Proxy público único para cualquier fuente

- Ventaja: simplifica superficialmente Client.
- Desventajas: expone fuentes con cuota y puede filtrar feeds personales. Un
  token compartido tampoco cumple por sí solo condiciones de los proveedores.

## Decisión

Proponer B para implementar el requisito funcional confirmado; ADR pendiente de
aprobación documental. `/news` y el enlace fijo Home→Noticias no requieren módulo,
rol, demo ni sesión. Los grupos privados mantienen su catálogo y autoridad89.
Una sesión válida habilita acceso de producto a fuentes limitadas, pero no sustituye
permisos del proveedor. daily.dev sigue bloqueada por las condiciones del catálogo.

Server separará operaciones públicas y autenticadas con políticas por handler
exacto. Usar metadata pública sólo en handlers de lectura de fuentes públicas;
no aplicarla al controller completo ni eximir toda la familia `news` de auth.
`POST /news/refresh` exige sesión real y super_admin activo, con política exacta
sin asignación de módulo y validación de rol en el caso de uso contra BD actual.
El cliente no decide la capa ni envía el actor. DTOs/paths en
[contratos NEWS-02/03](../../features/news/http-contract.md).

Caché pública sólo para metadatos autorizados de fuentes públicas; caché limitada
aislada por actor/cuenta. Dedupe no mezcla procedencias privadas en respuesta pública.
Cambiar clasificación o deshabilitar fuente impide servir caché antigua por una
capa que ya no corresponde. Logout/cambio de cuenta descarta datos limitados y
mantiene lectura pública. GET de lectura no provoca consultas a proveedores;
actualización sólo por intención explícita, con coordinación y límites propios.

La primera implementación conserva un snapshot JSONB por fuente pública,
máximo100artículos normalizados, y estado/reserva con token de fencing. Retención
7días, enfriamiento15minutos; SQL transaccional en reserva/finalización, nunca
durante descarga. Un snapshot acotado evita consultas N+1 y no constituye un
archivo completo; múltiples fuentes o conexiones privadas requieren ampliar
su propio contrato. Migración reversible aparte, sin alterar asignaciones.

## Consecuencias

- Positivas: acceso público explícito, control de consumo y aislamiento por fuente.
- Costos/riesgos: tráfico anónimo requiere caché compartida, enfriamiento y límites
  de bytes/concurrencia; no equivale a cuota diaria del editor ni acceso ilimitado.
- Trabajo posterior: AuthSessionProvider envuelve RouterProvider y retiene vistas
  durante recuperación; no basta quitar GuardStrict para garantizar lectura anónima
  o ante sesión histórica inválida. Separar ese efecto sólo para destinos públicos,
  conservando recuperación, identidad y guards de todos los privados.
- Verificar anónimo, sesión válida/expirada/no disponible, cualquier rol/sin módulos,
  URL/API directa, logout/cambio de cuenta, caché vieja, dedupe, dos pestañas y abuso.
  Este ADR no implementa handlers, migra datos ni publica herramientas NodiaAI.

## Estado de implementación por alcance — 2026-11-16

[Plan105§9](../../mvp/105-on-demand-tech-news.md#9-obtención-exclusiva-super_admin-y-primera-integración-rss--2026-11-16)
implementó la primera fuente y la continuidad de la ruta pública durante
recuperación de sesión. [NEWS-04§12](../../mvp/105-on-demand-tech-news.md#12-news-04-segunda-fuente-rss-nodejs--solicitud2026-11-16)
amplía el contrato a web.dev/Node.js: snapshot/estado/reserva por fuente,
lectura por lote y una tarjeta por URL con procedencias/licencias vigentes,
sin mezclar contenido entre editores. POST sigue siendo una fuente explícita
con super_admin vigente; no se habilitan cuotas privadas ni conexiones daily.dev.

Migración aditiva amplía sólo fuentes admitidas; original intacta. Node limitado
a título/URL/fecha y aviso MIT conservado. Son implementaciones y verificaciones
locales según su [evidencia](../../evidence/news-nodejs-integration-20261116.md),
sin adopción de entorno o aprobación documental de este ADR.

## Referencias

- [Catálogo de fuentes](../../features/news/source-catalog.md) y
  [evidencia NEWS-01](../../evidence/news-source-discovery-20261116.md).
- [Autoridad89](../../mvp/89-module-access-and-user-data-scope.md),
  [ADR092](ADR-092-stable-module-navigation-routes.md).
- [AuthSessionProvider](../../../nodia-client/src/providers/AuthSessionProvider.tsx),
  [AuthGuard](../../../nodia-server/src/auth/auth.guard.ts) y
  [ModuleAccessGuard](../../../nodia-server/src/authorization/module-access.guard.ts).
