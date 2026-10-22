# ADR-060 — Búsqueda literal autorizada del historial de NodiaAI

> Estado: propuesto
> Fecha: 2026-10-18

## Contexto

AI-35 necesita buscar conversaciones por título y texto visible, con paginación y permisos actuales. La consulta previa recorría texto de adjuntos y transcripciones, fuera del alcance de búsqueda de la política50. Un índice sin restringir las fuentes no corrige esa exposición. La aplicación no necesita embeddings, un motor externo ni otra copia de mensajes.

## Opciones consideradas

1. Conservar ILIKE sin índice: mantiene la semántica literal, pero las búsquedas ausentes o poco frecuentes recorren muchos bytes.
2. Full-text/tsvector: útil para términos lingüísticos, cambia el contrato de subcadena literal y añade configuración por idioma.
3. Un GIN parcial pg_trgm sobre las partes textuales: conserva ILIKE y los escapes de comodines. Añade una extensión y coste de escritura/almacenamiento.
4. EXISTS correlacionado con el mismo índice: ensayado y descartado frente al semi-join; las búsquedas poco frecuentes/títulos/ausentes fueron notablemente peores. No se justifica una segunda ruta especial sólo para términos cortos con los resultados disponibles.

## Decisión

Usar un semi-join de mensajes con la conversación y un único índice GIN parcial sobre `nodia_ai_message_parts.text WHERE kind='text'`, con `public.gin_trgm_ops`. La búsqueda combina título y texto de mensajes del dueño o del asistente, con manifiesto de ámbito válido y autorizado. Excluye adjuntos, sus transcripciones/interpretaciones, resultados de herramientas, preferencias y snapshots. La consulta repite restricciones de dueño/vigencia dentro del conjunto candidato; el índice nunca concede autoridad. Conserva orden `updated_at DESC,id DESC`, cursor preciso y límite de tiempo existentes.

La migración `1793100000000` instala `pg_trgm` en public si falta. Si ya está en otro esquema, aborta sin trasladar una extensión compartida. Construye el índice dentro de la transacción de migración: exige ventana de mantenimiento/admisiones detenidas en una instalación poblada; no se presenta como despliegue concurrente sin bloqueo. El rollback elimina sólo el índice, nunca la extensión compartida. No modifica tablas ni columnas.

## Consecuencias

En PostgreSQL desechable, 20.023 conversaciones, 200.017 mensajes y unos84MB de texto, cinco muestras por perfil: término poco frecuente de unos1.169ms a7,93ms; título1.133→7,26ms; ausente1.195→7,10ms. Índice de unos13,8MB. Son datos sintéticos de laboratorio, no percentiles productivos. Los ensayos secuenciales amplios mostraron variaciones desfavorables de hasta8,7%; un ensayo posterior de cinco pares intercalados comprobó el mismo árbol sin usar GIN y no reprodujo ese empeoramiento (cuerpo amplio1.331→1.287ms; otro término amplio3.734→3.733ms). No se atribuye una causa de variación no medida. La búsqueda corta del ensayo final quedó1.162→1.150ms. El límite existente es5s por sentencia SQL y2s de espera de bloqueo, no un SLA de página; la auditoría puede añadir otras sentencias. AI-37 debe medir concurrencia, escrituras, crecimiento y planes con datos representativos. La auditoría actual de consultas globales super_admin conserva su coste por conversación; esta decisión no lo optimiza.

La paginación por una fecha mutable puede mover registros ante cambios concurrentes; no promete una fotografía inmutable. Fijar es un filtro/metadato, no una ordenación local que altere páginas del servidor. La extensión debe estar disponible y el rol migrador tener permisos suficientes; una instalación que no los tenga falla de forma explícita.

## Referencias

- [Entrega AI-35](../../mvp/81-nodia-ai-ai35-conversation-organization.md).
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md).
- [Medición intercalada](../../evidence/nodia-ai-ai35-search-performance.json).
- [Integración SQL](../../../nodia-server/test/nodia-ai-ai35-search.integration.mjs).
- [Migración](../../../nodia-server/src/migrations/1793100000000-AddNodiaAiTextSearchIndex.ts).
