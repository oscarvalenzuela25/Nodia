from pathlib import Path
import json
root=Path.cwd()
notes={
'41-nodia-ai-v1-contracts.md':'> Continuidad AI-27: [administración Core73](73-nodia-ai-ai27-core-administration.md) añade17 preparadores internos y el recibo cerrado `CoreEffectReceipt` (versión1, recurso/operación/ID bigint string, scope global vacío). Usuarios sólo create/update; roles, acciones, acciones de negocio, módulos y grupos también delete. El recibo congela el ID efectivo de upsert; `core_id_list` y `core_translations` permiten revisión estructurada. Identidades, impacto y autoridad se revalidan; escrituras MCP siguen sin publicar y Gemini pendiente.',
'42-nodia-ai-erd.md':'> Continuidad AI-27: [administración Core73](73-nodia-ai-ai27-core-administration.md) añade únicamente metadatos descriptivos `execution.localCoreAdministration`;17 puertos usan tablas Core y la intención/revisión/recibo existentes. Cero tablas, columnas o migraciones: instalado18/241, modelo completo propuesto23/298/62 FKs. La prueba transaccional de autoridad vive sólo en memoria durante el callback y no agrega almacenamiento.',
'43-nodia-ai-execution-architecture.md':'> Continuidad AI-27: [administración Core73](73-nodia-ai-ai27-core-administration.md) y [ADR-051](../architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md) incorporan17 escritores con la misma transacción nativa y recibo. Un hint acotado selecciona frontera exclusiva antes de cualquier lectura de ejecución; no concede autoridad y el dispatch vuelve a exigir prueba scoped del manager. No hay upgrade SHARE→exclusive. Los escritores nativos heredan manager, locks y plazos; la invalidación Redis ocurre fuera de SQL. Recibos históricos evitan consultar o repetir recursos ya eliminados. No añade ledger, cola, esquema o permisos, ni publica MCP.'}
for name,note in notes.items():
 p=root/'docs/mvp'/name;s=p.read_text(encoding='utf-8');head,rest=s.split('\n',1);p.write_text(head+'\n\n'+note+'\n'+rest,encoding='utf-8')
p=root/'docs/mvp/39-nodia-ai-current-capabilities-inventory.md';s=p.read_text(encoding='utf-8');anchor='## Reconciliación incremental hasta AI-26';assert anchor in s
addition='''## Reconciliación incremental hasta AI-27

El [reconciliador AI-27](../evidence/scripts/reconcile-nodia-ai-ai27.cjs) registra73 módulos locales (68 estáticos/5 condicionales),43 controladores,204 handlers,323 pares método/ruta y733 hashes productivos. No hay rutas nuevas:17 puertos Core elevan el registro interno48→65 ejecutores (12 financieros,14 de Negocios,22 de Reservas y17 Core). Usuarios conserva sólo create/update; cinco catálogos también delete y BusinessAction conserva su desactivación nativa. [Entrega73](73-nodia-ai-ai27-core-administration.md) documenta asociaciones, impacto y frontera exclusiva NI-13. El catálogo público mantiene67 lecturas/27 fragmentos; configuración IA sigue en AI-28/29. Las cifras siguientes son históricas.

'''
s=s.replace(anchor,addition+anchor,1);p.write_text(s,encoding='utf-8')
p=root/'docs/mvp/73-nodia-ai-ai27-core-administration.md';s=p.read_text(encoding='utf-8');s=s.replace('[conjuntos69](69-nodia-ai-ai23-dependent-workflows.md).','[conjuntos69](69-nodia-ai-ai23-dependent-workflows.md) y [ADR-051](../architecture/decisions/ADR-051-nodia-ai-core-exclusive-execution.md).');p.write_text(s,encoding='utf-8')
raw=(root/'.tmp/ai27-knowledge-validation.log').read_text(encoding='utf-8');data=json.loads(raw[raw.index('{'):]);(root/'docs/evidence/nodia-ai-ai27-knowledge-validation.json').write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
