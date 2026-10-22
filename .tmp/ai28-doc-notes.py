from pathlib import Path
import json
r=Path.cwd();notes={
'41-nodia-ai-v1-contracts.md':'> Continuidad AI-28: [configuración IA74](74-nodia-ai-ai28-provider-configuration.md) incorpora cuatro preparadores internos no secretos y `AiProviderEffectReceipt` cerrado (versión1, recurso `ai_providers` o `ai_provider_catalog`, operación create/update e ID bigint string; scope global vacío). Paths explícitos por canal, modelos persistidos exactos y preferencias de razonamiento no equivalen a disponibilidad. El recibo excluye comandos, fields y credenciales. Traducciones conservan upsert nativo; las propuestas Core anteriores afectadas requieren revisión nueva mediante un marcador material, sin invalidar sus recibos históricos. MCP de escritura y sincronización remota conservan gates.',
'42-nodia-ai-erd.md':'> Continuidad AI-28: [configuración IA74](74-nodia-ai-ai28-provider-configuration.md) agrega únicamente metadatos descriptivos `execution.localAiProviderConfiguration`; cuatro puertos usan las tablas nativas y la intención/revisión/recibo existentes. Cero tablas, columnas o migraciones: instalado18/241, modelo completo propuesto23/298/62 FKs. La prueba de locks de autoridad heredados consulta el manager actual; no crea almacenamiento.',
'43-nodia-ai-execution-architecture.md':'> Continuidad AI-28: [configuración IA74](74-nodia-ai-ai28-provider-configuration.md) y [ADR-052](../architecture/decisions/ADR-052-nodia-ai-provider-configuration.md) comparten escritores nativos y manager con cuatro efectos locales. Revalidan actor/ai:manage y módulos, bloquean catálogo→conexiones para conservar el predeterminado y preservan preferencias por canal. Una sincronización nativa relee y combina observaciones después de la red, sin mantener SQL abierto ni pisar preferencias. Transacción activa no demuestra locks: el escritor heredado comprueba la frontera actual y no reinicia plazos. Sincronizar/cerrar sesión mediante NodiaAI sigue su gate externo; no se disfraza de efecto SQL.'}
for name,note in notes.items():
 p=r/'docs/mvp'/name;s=p.read_text(encoding='utf-8');head,rest=s.split('\n',1);p.write_text(head+'\n\n'+note+'\n'+rest,encoding='utf-8')
p=r/'docs/mvp/39-nodia-ai-current-capabilities-inventory.md';s=p.read_text(encoding='utf-8');anchor='## Reconciliación incremental hasta AI-27';assert anchor in s
s=s.replace(anchor,'''## Reconciliación incremental hasta AI-28

El [reconciliador AI-28](../evidence/scripts/reconcile-nodia-ai-ai28.cjs) conserva43 controladores,204 handlers y323 pares método/ruta; registra74 módulos locales (69 estáticos/5 condicionales) y741 hashes productivos. Las rutas IA mantienen `ai:manage` y ahora derivan el actor para los cuatro escritores compartidos de conexión/catálogo. No hay endpoints nuevos:69 ejecutores internos (12 financieros,14 de Negocios,22 de Reservas,17 Core y4 de configuración IA). [Entrega74](74-nodia-ai-ai28-provider-configuration.md) distingue estos efectos de67 lecturas/27 fragmentos publicados, sincronización remota pendiente y canales seguros AI-29. Las cifras siguientes son históricas.

'''+anchor,1);p.write_text(s,encoding='utf-8')
p=r/'docs/mvp/74-nodia-ai-ai28-provider-configuration.md';s=p.read_text(encoding='utf-8');s=s.replace('[recuperación66](66-nodia-ai-ai20-execution-recovery.md).','[recuperación66](66-nodia-ai-ai20-execution-recovery.md) y [ADR-052](../architecture/decisions/ADR-052-nodia-ai-provider-configuration.md).',1)
s=s.replace('Crear una conexión no inventa modelos.','Crear una conexión no inventa modelos. Al crear, un default_mode explícito null se normaliza al modo que realmente resuelve el escritor nativo según los canales habilitados, con origen contract_default visible; actualizar con null sí conserva null.',1)
s=s.replace('Quitar una intensidad específica por modelo puede conservar la intensidad general del modo cuando exista; la vista previa debe explicar esta consecuencia.','Limpiar thinking_level elimina la preferencia general y la del modelo seleccionado. Low/Medium/High son preferencias permitidas por el contrato nativo aun sin modelos u observaciones; valores adicionales requieren configuración anterior o metadatos dinámicos permitidos. La vista previa congela el nivel del modelo destino y distingue el booleano histórico enable_extended_thinking.',1)
anchor='## Client y navegación'
insert='''## Compatibilidad y concurrencia

Los escritores nativos usan una autoridad SHARE previa a lecturas; en conjuntos mixtos con Core heredan la frontera exclusiva. Un manager heredado debe mantener los locks actuales de las nueve relaciones de autoridad: estar activo no basta. No reinicia timeouts ni abre un commit independiente. Catálogo y conexiones se bloquean en un orden compartido; predeterminados, traducciones y recibo son atómicos.

Los parches omiten únicamente undefined y conservan false/null/0 conforme al contrato. La configuración histórica plana se conserva en su modo original al introducir el primer canal, incluido enable_extended_thinking. La persistencia nativa de descubrimiento remoto relee y combina solamente los modelos del canal observado, con límites SQL propios, preservando ediciones realizadas durante la llamada externa. No habilita el preparador MCP de sincronización.

Traducciones son upsert por clave, no reemplazo ni borrado. Las claves existentes omitidas se conservan y se muestran en la propuesta; retirarlas o vaciar una colección existente se rechaza antes de confirmar. La misma corrección se aplica a roles, acciones, acciones de negocio, módulos y grupos Core. El marcador material translation_semantics=upsert-preview/1 invalida las propuestas previas afectadas antes del escritor y conserva sus recibos históricos sin cambiar el contrato de identidad.

Nuevas activaciones explícitas de OpenAI Web se rechazan conforme a la retirada previa del producto. Datos históricos ajenos a un patch se preservan; ningún flag crea un adaptador o una sesión.

'''
assert anchor in s;s=s.replace(anchor,insert+anchor,1);p.write_text(s,encoding='utf-8')
p=r/'docs/mvp/ai-provider-feature-contract.md';s=p.read_text(encoding='utf-8');s+='''

## Configuración no secreta compartida — AI-28, 2026-10-17

[Entrega74](74-nodia-ai-ai28-provider-configuration.md) y [ADR-052](../architecture/decisions/ADR-052-nodia-ai-provider-configuration.md) registran la implementación y su evidencia; no constituyen aprobación documental automática. Crear/editar conexión y catálogo comparte casos de uso nativos con NodiaAI, actor/sesión actuales, ai:manage y una transacción que incluye predeterminados y traducciones. Los DTOs compilados no convierten propiedades omitidas undefined en cambios; false/null/0 conservan su significado.

Al introducir scopes de modo se preserva la configuración plana original, incluido enable_extended_thinking. Guardar observaciones de modelos después de una llamada externa relee y combina sólo el canal observado, sin reescribir preferencias de un snapshot anterior ni mantener SQL durante la red. Modelos/credenciales/datos históricos de otros canales se conservan. Las traducciones se agregan o actualizan por clave; no hay borrado implícito. Nuevas activaciones de OpenAI Web siguen rechazadas conforme a la retirada explícita del producto.

Los cuatro puertos SQL internos no publican MCP, prueban disponibilidad ni abren flujos de secretos. Sincronización remota y cierres de sesión del chat conservan su protocolo/gate externo; login/claves/códigos siguen AI-29. Seleccionar conexión para conversar no modifica su configuración global.
''';p.write_text(s,encoding='utf-8')
p=r/'docs/nodia-ai/knowledge/general-settings/features/confirmed-administration.md';raw=p.read_text(encoding='utf-8');parts=raw.split('---',2);f=json.loads(parts[1]);source={'path':'docs/mvp/74-nodia-ai-ai28-provider-configuration.md','kind':'specification'}
if source not in f['sources']:f['sources'].append(source)
parts[2]+='\n\nContinuidad AI-28: traducciones Core se agregan o actualizan por clave; claves omitidas se conservan. La propuesta muestra la colección resultante y rechaza quitar claves ya guardadas. Un marcador material exige nueva revisión de propuestas previas afectadas; los recibos completados continúan legibles. [Detalle74](../../../../mvp/74-nodia-ai-ai28-provider-configuration.md).\n'
p.write_text('---\n'+json.dumps(f,ensure_ascii=False,indent=2)+'\n---'+parts[2],encoding='utf-8')
