# AI-38 — Gates por entorno y procedencia

Estado: herramienta offline y matriz inicial; no aceptación del entorno ni aprobación documental. El contrato aplica los gates existentes del [plan45](../mvp/45-nodia-ai-implementation-plan.md), [publicación52](../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md) y [límites AI-37](../mvp/83-nodia-ai-ai37-performance-recovery.md). No añade una autoridad de aprobación ni un endpoint de producción.

## Hechos y pendientes

| Capa | Hecho comprobado anterior | Lo que no demuestra para AI-38 |
|---|---|---|
| MCP por capacidad | C05 acumula 4/7: propuestas, operaciones, descripción de adjuntos y conjuntos. Faltan preparar/listar preferencias y preparar creación de movimiento financiero. | Ni siquiera las cuatro históricas se trasladan automáticamente a una instancia/paquete nuevo. Los 77 candidatos restantes siguen sin publicar; la cobertura estructural no habilita herramientas. |
| Artefacto | AI-37 candidato04: build/SQL/procesos aislados correctos, sin adopción. | No identifica el código que atiende actualmente la app. |
| Operación | La fotografía AI-37 conserva Node932 y cuatro servicios activos, sin pendientes. | Health, sesión o catálogo no acreditan inferencia, MCP ni modalidades actuales. La fotografía tiene fecha y no garantiza estado posterior. |
| Adjuntos/R2 | AI-32 documenta audio/MIME, micrófono, purga y copia real en sus instancias y ensayos. | Un formato válido o un éxito histórico no habilita otro MIME, modelo, sesión o imagen. |
| Restore | AI-37 prueba fences, cuarentena y restore SQL aislados; devuelve `release_authorized:false`. | No acredita rotación/cifrado reales, journal continuo externo, todas las versiones cloud, conciliación del dominio actual o liberación del restore. |
| Integraciones posteriores | API de pago exige su adaptador y selección explícita; Codex se desarrolla en AI-39/40. | No es necesario implementar estas integraciones para entregar el alcance Gemini de AI-38. Tampoco se activan como fallback. |

## Procedencia del conocimiento

La [adenda AI-37](nodia-ai-ai37-documentation-finalization.json) compara el manifiesto anterior `bde409…` y el resultado `c70317…`: cambia únicamente el hash del plan45 como fuente de una ficha y, por consecuencia, el `release_id`. El contenido aprobado, los bindings, schemas, fragmentos y permisos son iguales. Ese caso requiere un build oficial y paquete nuevo con pins coherentes; no requiere aprobar nuevamente el contenido idéntico ni publicar una capacidad nueva. Los artefactos y comparadores históricos se conservan como historia, aunque su comparación con el siguiente build ya no pase.

Esto no es una regla para ignorar diferencias futuras: cada cambio de fuentes debe clasificarse según su diff real. Una modificación de reglas/cuerpo/esquema vuelve a aplicar [52](../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md). El checksum leído del propio manifiesto no constituye por sí solo un pin de confianza.

## Herramienta

[El validador](scripts/nodia-ai-ai38-gates.cjs) sólo lee archivos locales y calcula hashes. Un input describe **un entorno y un paquete**, con diez gates derivados de los contratos existentes. Estados: `passed`, `failed`, `unknown`. La falta de observaciones conserva `unknown`; no existe `not_applicable` para omitir silenciosamente un gate del alcance solicitado. Las integraciones futuras están excluidas expresamente de esta entrega Gemini.

Para un `passed` se exige entorno y SHA256 del manifiesto del paquete, scope correcto y al menos un recibo con checksum. Cada recibo debe ser JSON y contener la misma identidad en el objeto indicado por `context_pointer`. Así, un input no puede reetiquetar accidentalmente un reporte de otro paquete/entorno. Para gates de proveedor también se vinculan identidad del runtime y selección exacta: conexión, modo, modelo dinámico y esfuerzo (puede ser `null` si no existe). No se fija ningún modelo comercial en la herramienta.

Un recibo puede respaldar varios gates sólo tras revisar sus aserciones: el validador verifica integridad/procedencia, **no entiende semánticamente un resultado ni acredita honestidad del productor**. El scope afirmado se revisa con el ensayo real. Incluso diez gates estructuralmente completos producen `evidence_coverage_complete_requires_semantic_review`, siempre `release_authorized:false` y `productive_acceptance:false`. El runbook operativo y el cierre humano/documental real siguen separados.

```text
node docs/evidence/scripts/nodia-ai-ai38-gates.cjs --self-test
node docs/evidence/scripts/nodia-ai-ai38-gates.cjs --check
node docs/evidence/scripts/nodia-ai-ai38-gates.cjs --write --input docs/evidence/nodia-ai-ai38-gates-isolated-input.json --output docs/evidence/nodia-ai-ai38-gates-isolated.json
node docs/evidence/scripts/nodia-ai-ai38-gates.cjs --check --input docs/evidence/nodia-ai-ai38-gates-isolated-input.json --output docs/evidence/nodia-ai-ai38-gates-isolated.json
```

`--write` usa creación exclusiva: no reemplaza un reporte anterior. Inputs/reportes de una observación posterior deben usar otro nombre. `--check` reproduce exactamente la salida y rechaza drift de input, recibos o script. No recalcula ni reemplaza evidencias históricas. Los fixtures internos de `--self-test` están en memoria y nunca representan respuestas de Gemini.

La [matriz inicial](nodia-ai-ai38-gates.json) no tiene paquete/entorno todavía. Sus diez gates son desconocidos; los documentos AI-36/37 sólo aparecen como antecedentes. Se generarán matrices separadas para `ai38-isolated-ui-api-sql` y `linux_lab` cuando existan sus recibos exactos. Un éxito UI/API/SQL aislado no satisface un gate de proveedor o infraestructura del laboratorio operativo.

## Cortes finales de esta entrega

La matriz [aislada R03](nodia-ai-ai38-gates-isolated-r03.json) registra tres gates comprobados y siete desconocidos; la de [VM Linux local R03](nodia-ai-ai38-gates-linux-lab-r03.json), un gate de integridad del artefacto y nueve desconocidos. El objetivo operativo es la VM local elegida por el usuario. Ambas fijan el paquete `0751160b…` y conservan sus inputs verificables. Los cortes R02 previos se mantienen: R03 incorpora el diagnóstico de reloj R02 y aclara el bridge de ejecución del ensayo, sin cambiar los conteos.

UI R06 acredita veinte checks y cleanup R02 retira sus procesos/BD propios. La ejecución usa los casos reales Claim/Execute mediante un bridge cerrado del arnés; no prueba el proceso worker standalone. Las regresiones nuevas de AI-36 (24 checks) y contexto largo (36) tienen los alcances sintéticos declarados y no acreditan hot reload ni publicación de un producto nuevo. El fallo inicial del fixture AI-34 se conserva en su recibo.

La consulta de modos es no generativa. El canario MCP real separado falla sin nonce después de un envío; acredita cierre/ACK, no aceptación de capacidades ni adopción de ese adaptador. Las diferencias de reloj entre Windows/VM se documentan con sus fuentes: la VM informa NTP sincronizado y la fecha HTTPS independiente concuerda con ella; Windows tiene el servicio de hora detenido. No se ajustó ningún reloj ni se deduce que ese desfase causara el fallo MCP.

## Formato mínimo de observación

```json
{
  "gate_id": "isolated_UI_API_SQL",
  "status": "passed",
  "scope": "isolated",
  "reason": "Describir las aserciones reales y sus límites.",
  "evidence": [{
    "path": "docs/evidence/recibo-real-del-ensayo.json",
    "sha256": "SHA256_REAL_DEL_RECIBO",
    "context_pointer": "/context"
  }]
}
```

El recibo enlazado debe contener `context:{environment_id,package_manifest_sha256}`. En proveedor se añaden dentro del mismo contexto `runtime_identity_sha256` y `selection:{connection_id,mode,model_id,effort_id}`; el input repite estos dos campos bajo `provider_context` y el validador exige igualdad exacta. Los valores del ejemplo son instrucciones de formato, no una observación operativa ni un fixture de producción.
