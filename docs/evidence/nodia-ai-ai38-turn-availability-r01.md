# AI-38 — disponibilidad entre turnos: corrección Client

Fecha local: 2026-10-22. Alcance: fuente Client y pruebas sintéticas; no sustituye la aceptación del paquete en la VM ni acredita inferencia nueva.

## Hechos y causa acotada

La aceptación anterior conservó un compositor bloqueado tras terminar el turno y recargar; no preservó el motivo público de esa observación. No se atribuye a caducidad, cuota, timeout ni ocupación concreta del proveedor sin evidencia operativa adicional.

En fuente, `useNodiaAiEligibility` consultaba por actor/sesión/selección, pero no revalidaba al terminar el trabajo del mismo chat. Por eso una respuesta negativa podía permanecer en el observador hasta una reconsulta explícita. `staleTime: 0` no provoca por sí solo una lectura tras cualquier render.

Se encontró además una condición independiente: React Query conserva datos previos ante fallo de refetch. El compositor calculaba `usable` con `available: true` de esos datos aunque la observación actual estuviera en error. Se bloquea ahora esa selección hasta una comprobación exitosa.

## Cambio

- Una transición de actividad a inactividad en el mismo chat, actor/sesión y selección invalida exactamente su consulta de elegibilidad una vez. Si una lectura previa sigue en vuelo, espera a que termine antes de la lectura final; evita reutilizar su promesa inicial y conservar una observación tomada durante la actividad. No hay polling, cambio automático de configuración, llamada de generación ni replay de mensaje o ejecución. Navegar a otro chat o cambiar sesión/selección no se interpreta como finalización de la actividad anterior.
- Si el primer chequeo al recargar informa indisponibilidad, el chat ofrece «Volver a comprobar» sin requerir abrir el drawer. Durante la lectura, el envío y el reintento dependiente permanecen deshabilitados; el borrador y los resultados existentes se conservan.
- Chat y drawer presentan traducciones ES/EN de categorías públicas permitidas por `ObserveNodiaAiEligibilityUseCase`, incluyendo `runtime_busy`, `session_required`, transporte no disponible, configuración, modelo/intensidad incompatible e integración sin verificar. Un motivo desconocido o ausente muestra el aviso genérico; nunca se refleja texto libre del proveedor. No se crea una categoría de timeout que el contrato no entrega.
- Un fallo de reconsulta bloquea también un `available: true` previo. La recuperación explícita hace únicamente GET de la misma selección; un rechazo persistente no genera bucles ni mutaciones.

El GET de elegibilidad sigue siendo una observación no generativa: no demuestra inferencia ni uso efectivo de MCP. Si el servidor aún informa ocupación al terminar el turno, se mantiene ese motivo y la recuperación explícita; no se inventa disponibilidad ni se lanzan reintentos automáticos por tiempo.

## Regresiones y evaluación de contexto

Pruebas nuevas: lectura única al terminar actividad, error sin bucle, navegación y cambio de sesión/selección, busy→terminal con borrador intacto, recuperación después de reapertura, rechazo persistente con razón desconocida y fallo de refetch sobre disponibilidad positiva. Las traducciones públicas y el descarte de nombres heredados del prototipo se comprueban en pruebas aisladas. Fixtures y transporte son sintéticos, sin cuenta ni inferencias reales.

Contratos HTTP, modelo persistente, permisos, catálogo y publicación de herramientas no cambian. No se modifican fichas aprobadas ni se amplían capacidades; esta evidencia registra la mejora de recuperación/presentación de una observación ya existente. La documentación de entrega y su aceptación por entorno las integra la tarea principal.

Verificación final sobre fuente estable: `npm run test` **229 archivos / 1802 pruebas correctas**, salida0 y147,22s, corrida aislada iniciada14:46:21 del reloj de la herramienta; sin compilaciones pesadas concurrentes y después del build aislado del empaquetador. `npm run typecheck`, `npm run lint` y `npm run build` correctos; build2709 módulos, con advertencia de chunks mayores de500kB que no se modifica en este alcance. Las ejecuciones completas anteriores compartieron carga con un build; también pasaron, pero no se usan como evidencia aislada final. Se corrigió esa omisión de AGENTS180 y se repitió sin cambiar timeouts ni quitar assertions.

El paquete Client sucesor se congeló con fuentes estables antes de esta corrida, sin edits posteriores: manifest SHA256 `cdc832c045cb26a4050d4fcceb979b9b7ef910b3ce3471c56c05cd7f219a1a93`,171outputs y648pins de fuente de producción, según la evidencia del empaquetador de la tarea principal. La adopción y la comprobación con la conexión real las documenta la tarea principal; este archivo no las sustituye. [Recibo de QA y hashes](nodia-ai-ai38-turn-availability-qa-r01.json).
