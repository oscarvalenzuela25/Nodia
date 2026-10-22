from pathlib import Path
root=Path(__file__).resolve().parents[1]
readme=root/'docs/mvp/README.md'
text=readme.read_text(encoding='utf-8')
entry='**AI-24 implementado y verificado en laboratorio privado**: [casas/configuración/acceso70](70-nodia-ai-ai24-rental-configuration.md) y [evidencia](../evidence/nodia-ai-ai24-validation.json). Seis operaciones individuales de casas, colaboradores y políticas de cancelación, con escritores nativos, confirmación exacta y recibo atómico. Editor estructurado de reglas ES/EN, archivo que conserva historial/ocupación/dinero y recuperación sin duplicados. 2.418 pruebas Server/191 archivos, 1.441 Client/202 y227 comprobaciones SQL/HTTP/procesos (36 nuevas+191 de regresión, incluyendo282 peticiones HTTP nativas); builds/tipado/lint y QA sintético correctos. Sin tablas, columnas ni migraciones nuevas; backup y despliegue verificado con824 archivos dist,32 ejecutores y0 pendientes. API/worker/Client/túnel activos;67 lecturas/27 fragmentos conservados. **Siguiente bloque AI-25**, disponibilidad y ciclo comercial de reservas. Preparadores MCP de escritura siguen sin publicar y no se acredita escritura con Gemini; AI-15/22 y AI-32 conservan sus gates. Fichas y documento70 en revisión, sin aprobación automática. Las entradas siguientes registran estados históricos.\n\n'
marker='## Cómo continuar\n\n'
assert marker in text
text=text.replace(marker,marker+entry,1)
text=text.replace('**Siguiente bloque de desarrollo AI-24**, casas/configuración/acceso de Reservas.','En ese cierre, el siguiente bloque era AI-24, casas/configuración/acceso de Reservas.',1)
readme.write_text(text,encoding='utf-8')
progress=root/'docs/mvp/00-progress.md'
text=progress.read_text(encoding='utf-8')
entry='- 2026-10-17: **AI-24 implementado y verificado en laboratorio privado**: [entrega70](70-nodia-ai-ai24-rental-configuration.md) y [evidencia](../evidence/nodia-ai-ai24-validation.json). Seis puertos internos para crear/editar casas, colaboradores y políticas, reutilizando los escritores nativos con actor real, autoridad compartida, snapshots materiales, botón sobre revisión exacta y recibo atómico. Archivo conserva historia/ocupación/dinero; reglas de cancelación con editor estructurado ES/EN e invalidación nativa. Manager heredado mantiene deadline/timeout, mapa de errores y restaura wrappers sin apropiarse de commit/rollback. Integración detectó y corrigió exportación DI de Nest y wire público de ámbito/orígenes; SQL comprueba rollback conjunto, revocación, SIGKILL/reanudación y COMMIT perdido sin duplicados. Server2.418/191 y Client1.441/202;227 checks SQL (36 nuevos+191 regresiones,282 HTTP nativas), builds/tipado/lint y QA sintético correctos. Contratos136/184/134,354 fixtures/670 hashes. Sin crecimiento de esquema:25 migraciones/18 tablas NodiaAI/241 columnas;32 ejecutores y0 trabajos/intentos/slots pendientes. Backup y activación con igualdad824 dist/862 archivos de paquete; API/worker/Client5174/túnel3100 activos y HTTP/proxy200. Registro47 fuentes/20 excluidas,67 lecturas/27 fragmentos conservados; sólo cambia digest de registry/release. Preparación MCP sin publicar, sin nueva inferencia o escritura por Gemini; AI-15/22 y AI-32 conservan gates independientes. Ficha draft/unregistered y documento70 en revisión; siguiente desarrollo AI-25.\n\n'
assert text.startswith('# Progreso del MVP — Nodia\n\n')
text=text.replace('# Progreso del MVP — Nodia\n\n','# Progreso del MVP — Nodia\n\n'+entry,1)
progress.write_text(text,encoding='utf-8')
plan=root/'docs/mvp/45-nodia-ai-implementation-plan.md'
text=plan.read_text(encoding='utf-8')
marker='- [ ] **AI-24 — casas, configuración y acceso.**'
assert marker in text
text=text.replace(marker,'- [x] **AI-24 — casas, configuración y acceso.**',1)
line=next(line for line in text.splitlines() if line.startswith('- [x] **AI-24'))
addition='  - [Entrega70](70-nodia-ai-ai24-rental-configuration.md) y [evidencia](../evidence/nodia-ai-ai24-validation.json): seis puertos individuales, confirmación exacta, recibos y editor estructurado de reglas; archivo conserva historia/ocupación/dinero. Server2.418/191, Client1.441/202 y227 checks SQL/HTTP/procesos. Backup/activación sin esquema nuevo,32 ejecutores y0 pendientes;67 lecturas/27 fragmentos intactos. Preparadores MCP de escritura internos y aceptación Gemini pendiente. Siguiente AI-25; no cierra gates AI-15/22/32 ni aprueba fichas.\n'
text=text.replace(line+'\n',line+'\n'+addition,1)
plan.write_text(text,encoding='utf-8')
print('AI-24 indices and checklist updated')
