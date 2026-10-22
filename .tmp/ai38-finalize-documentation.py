from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
summary = '''# AI-38 — Verificaciones posteriores a MCP High

Fecha: 2026-10-20. Estado: verificaciones funcionales satisfactorias con alcance acotado; **AI-38 continúa parcial**. [Entrega84](../mvp/84-nodia-ai-ai38-environment-acceptance.md) y [validación reproducible](nodia-ai-ai38-verifications-r01.json).

| Verificación | Resultado y alcance acreditado |
|---|---|
| Tres capacidades pendientes del primer lote C05 | Preparar/listar preferencias y preparar un movimiento financiero aceptadas con Gemini High real. Cuatro inicios y cuatro ACK; confirmación HTTP exacta, efecto/recibo únicamente en PostgreSQL desechable. [Delta](nodia-ai-ai38-c05-current-delta-r01.json) |
| Web→Agentic→Web | Trece controles, cinco generaciones y cinco ACK. Conversación Web, delegación opt-in, descubrimiento y lectura MCP de productos, continuidad del historial y siguiente turno nuevamente Web. [Prueba real](nodia-ai-ai38-live-routing-routing01.json) |
| Archivos Agentic | PNG, PDF, WAV y WebM: cuatro respuestas semánticamente verificadas, terminal `completed`, ACK y ningún pendiente. [Cohorte](nodia-ai-ai38-modalities-agentic-cohort-02.json) |
| Archivos Web | Los mismos cuatro MIME exactos, con las mismas condiciones de aceptación. [Validación](nodia-ai-ai38-modalities-web-validation.json) |
| Evolución del contexto | Catorce controles con compilador real, PostgreSQL y dos procesos aislados: run antiguo conserva A, B no lo reclama; siguiente turno del mismo chat recibe producto revisado y función nueva de B. Historia, autoridad y recibo anteriores intactos. Dos dispatches sintéticos, cero proveedor. [Evidencia](nodia-ai-ai38-context-evolution-validation.json) |
| Worker independiente | Once controles sobre el proceso compilado real: consume ejecución confirmada, guarda un efecto y un recibo, permite consultarlos al volver y no duplica al repetir la confirmación. SIGTERM limpio. [Evidencia](nodia-ai-ai38-worker-process02.json) |
| Instalación de producción limpia | Un `npm ci --omit=dev` real, lifecycle/TLS normales, versiones exactas del lock y 2.827 outputs intactos. Se repiten los once controles del worker con dependencias frescas; no son once casos de negocio nuevos. [Evidencia](nodia-ai-ai38-dependencies-r01.json) |
| Bootstrap API de producción | Once controles sobre `dist/main.js` con dependencias frescas, sin Nest Testing: acceso público, sesión fixture, propiedad, módulo y revocación; ocho GET funcionales. PostgreSQL/Redis desechables, cero proveedor. [Evidencia](nodia-ai-ai38-fresh-api-process-validation.json) |

Son **17 solicitudes generativas explícitas, todas completadas y reconocidas mediante ACK**, sin replay automático: cuatro C05, cinco routing y ocho archivos. No son una medición de llamadas internas, tokens, cuotas ni facturación. Los dispatches sintéticos y observaciones no generativas se contabilizan por separado. Los fallos de arnés previos quedan preservados: casts/identificadores de fixture, composición de repositorios y carga tardía de variables antes de importar el adaptador. La cohorte Agentic inicial de formatos no despachó ninguna inferencia; corregir el arnés no es una corrección de producción ni un retry de resultado incierto.

El primer lote C05 alcanza **aceptación representativa acumulada de siete de siete**: tres capacidades verificadas en esta época y cuatro históricas con sus contratos contrastados. No se reejecutaron las siete en la época actual. AI-36 sigue abierto por publicación/aceptación restante: 74 capacidades publicadas, 77 candidatas sin publicar. No se cambiaron contratos, permisos, herramientas o fichas aprobadas.

Las pruebas nativas de archivos verifican exclusivamente `image/png`, `application/pdf`, `audio/wav` y `audio/webm`. El audio es TTS sintético conocido; no acredita un micrófono físico, nueva aceptación de UI/R2/copia a factura o archivo+MCP combinado. No habilita JPEG, WebP, Ogg, MP3 ni MP4 por analogía. Web sigue conversacional y MCP corresponde a Agentic; la delegación requiere el switch y conserva el botón humano para escrituras.

Los ensayos de contexto acreditan evolución entre procesos fijados a releases distintas, **sin hot reload**: un rollout debe drenar o conservar un consumidor compatible con el trabajo anterior. API y worker reales aíslan PostgreSQL/Redis y usan sesiones emitidas como fixture; no verifican login OAuth Google o el shell completo. Estas pruebas no adoptan los paquetes completos Node/Client en servicios operativos.

## Cierre operativo

Se [pausaron](nodia-ai-ai38-verifications-pause-r01.json) sólo API/worker para serializar la sesión real y se [reanudaron](nodia-ai-ai38-verifications-resume-r01.json) a las 20:01 UTC. Los cuatro servicios quedan activos; Gemini mantiene contenedor `802d6d…`, imagen diagnóstica `b8efad…` y arranque 19:14:35 UTC, sin otro reinicio. Se conserva Node operativo de 932 outputs y su hash original.

La [observación final](nodia-ai-ai38-verifications-modalities-final-r01.json) devuelve Web/Agentic disponibles, MCP false/true respectivamente y los cuatro MIME verificados en ambos. Conserva selección/configuración/sesión; es metadato posterior a las pruebas generativas, no otra inferencia. [Inventario final](nodia-ai-ai38-verifications-final-inventory-r01.json) y [cierre nativo](nodia-ai-ai38-verifications-final-native-closure-r01.json): cero trabajos, intentos, slots, pruebas o temporales pendientes. No hubo escrituras comerciales operativas, R2, cambio de proveedor, modelo o intensidad, ni cambios de reloj.

## Pendientes concretos

- Adopción/reversión de los paquetes completos Node/Client, origen/proxy de destino y aceptación del flujo autenticado de UI sobre ese despliegue exacto. Las sesiones fixture y los procesos aislados no sustituyen esos gates.
- Infraestructura real de conservación: copias cifradas con recuperación de claves y rotación conforme a política50, journal continuo de eliminación, inventario de versiones/objetos y restore externo en cuarentena con conciliación. La [observación acotada](nodia-ai-ai38-infrastructure-observation-r01.md) acredita permisos/artefactos, no cifrado, cobertura o rotación. No encontrar un timer en el inventario consultado no demuestra ausencia global.
- Publicación y aceptación del catálogo restante de AI-36; otras modalidades y etapas API/Codex conservan su alcance propio.

No se amplía la retención de conversaciones o auditoría ni se declara borrado remoto del proveedor. Las matrices históricas y plan45 permanecen intactos. La ficha operativa revisión8 continúa draft/unregistered/approval null; el contexto aprobado conserva release `c70317…`, 31 documentos/fragmentos y 74 capacidades. Los timeouts históricos no adquieren una causa demostrada por estos éxitos.
'''
report = ROOT/'docs/evidence/nodia-ai-ai38-verifications-r01.md'
assert not report.exists()
report.write_text(summary, encoding='utf-8')

entry = 'Estado actual NodiaAI AI-38, 2026-10-20: [verificaciones posteriores a MCP High](../evidence/nodia-ai-ai38-verifications-r01.md) completan las tres capacidades pendientes del primer lote C05 (aceptación representativa acumulada7/7, cuatro históricas), Web→Agentic→Web real y PNG/PDF/WAV/WebM en ambos modos:17 solicitudes generativas completadas con ACK, sin replay o efectos comerciales operativos. Contexto entre dos procesos14 controles, worker independiente11 y API de producción11; instalación fresca del lock verificada. Cuatro servicios reanudados, misma época Gemini/Node932 intacto y cero pendientes. Sin adopción completa Node/Client, nuevas herramientas o aprobación; AI-38 continúa parcial por despliegue/reversión/UI autenticada e infraestructura real de retención/restore. AI-36 conserva77 candidatas sin publicar; [evidencia consolidada](../evidence/nodia-ai-ai38-verifications-r01.json).'
for name in ['README.md','00-progress.md']:
 p = ROOT/'docs/mvp'/name
 text = p.read_text(encoding='utf-8')
 text = text.replace('Actualización NodiaAI AI-38 MCP, 2026-10-20:', 'Corte histórico NodiaAI AI-38 MCP, 2026-10-20:', 1)
 text = text.replace('Estado actual NodiaAI, 2026-10-20:', 'Estado histórico NodiaAI, 2026-10-20:', 1)
 first,rest = text.split('\n',1)
 p.write_text(first+'\n\n'+entry+'\n'+rest, encoding='utf-8')

p = ROOT/'docs/mvp/84-nodia-ai-ai38-environment-acceptance.md'
text = p.read_text(encoding='utf-8')
text = text.replace('## Evidencia de esta etapa\n','## Evidencia de esta etapa — corte inicial histórico\n',1)
new_section = '''## Continuación: verificaciones funcionales con High y procesos reales

El [corte nuevo](../evidence/nodia-ai-ai38-verifications-r01.md) y su [validación](../evidence/nodia-ai-ai38-verifications-r01.json) completan los ensayos funcionales siguientes. Los cortes anteriores y sus límites se conservan; no representan el estado actual de disponibilidad.

| Frente | Evidencia nueva |
|---|---|
| C05 | Preparar/listar preferencias y preparar gasto aceptados con High real y SQL desechable. Primer lote:7/7 acumuladas, tres actuales y cuatro históricas contrastadas; no siete reaceptadas en la misma época. |
| Routing | Web→Agentic opt-in con descubrimiento/lectura MCP→siguiente turno Web;13 controles,5 solicitudes y5 ACK, selección base e historial conservados. |
| Modalidades | PNG/PDF/WAV/WebM verificados semánticamente en ambos modos;8 solicitudes/8 ACK. TTS sintético; no micrófono físico, R2, flujo UI ni otros MIME. |
| Evolución |14 controles PostgreSQL/compilador/dos procesos: A completa su trabajo fijado, B no lo reclama; siguiente turno del chat utiliza B con producto revisado/función nueva. Sin hot reload, dos dispatches sintéticos. |
| Procesos y dependencias | Worker compilado independiente11 controles; instalación única real `npm ci --omit=dev` y repetición del worker sobre dependencias frescas; `dist/main.js` producción11 controles HTTP/autoridad sin Nest Testing. Sesiones fixture, no OAuth Google. |

Total17 solicitudes generativas explícitas completadas/ACK, sin replay automático ni efectos comerciales operativos. Los efectos/confirmaciones de negocio sólo usan bases desechables; no equivalen a aceptación de todas las74 herramientas publicadas. Las77 candidatas restantes de AI-36 siguen sin publicar. Los intentos fallidos de composición del arnés se conservan y no se atribuyen al proveedor.

API/worker se pausaron para serializar las pruebas y se reanudaron tras quietud. La observación final conserva Web conversacional/MCPfalse y Agentic High/MCPtrue, los cuatro MIME exactos, selección/configuración/sesión y la misma época Gemini. Cuatro servicios activos, Node operativo932/hash intacto, cero pendientes SQL/nativos. No se adoptaron los paquetes completos Node/Client ni se reinició Gemini en este corte.

La [observación de infraestructura](../evidence/nodia-ai-ai38-infrastructure-observation-r01.md) no acredita cifrado/rotación de copias, continuidad del journal de eliminación, inventario completo de versiones u objetos ni restore externo. Esos gates y la adopción/reversión operativa con aceptación del flujo autenticado completo conservan AI-38 parcial. Las matrices históricas no se relabelan como aceptadas con pruebas de otro entorno; plan45 y los31 documentos aprobados permanecen intactos. La ficha operativa revisión8 sigue draft/unregistered/approval null, sin cambio de publicación c703.

'''
text = text.replace('## Criterio de cierre\n',new_section+'## Criterio de cierre\n',1)
p.write_text(text, encoding='utf-8')

p = ROOT/'docs/nodia-ai/knowledge/nodia-ai/features/runtime-policy.md'
snapshot = ROOT/'docs/evidence/nodia-ai-ai38-verifications-runtime-policy-entry.md'
assert not snapshot.exists()
snapshot.write_bytes(p.read_bytes())
_,raw,body = p.read_text(encoding='utf-8').split('---',2)
meta = json.loads(raw)
assert meta['revision']==7 and meta['approval'] is None
meta['revision']=8
meta['implementation']['notes']='AI-37 implementa observación, mantenimiento y preparación de restore en cuarentena. AI-38 verifica contexto entre releases/procesos aislados, worker independiente y API de producción con instalación fresca del lock, sin adoptar los paquetes completos Node/Client. Gemini High real completa las tres capacidades pendientes del primer lote C05; siete aceptadas acumuladas, cuatro históricas. Web→Agentic opt-in→Web y cuatro MIME exactos por modo verificados. Continúan gates de despliegue/reversión/UI autenticada, infraestructura de retención/restore y publicación restante AI-36. No nuevas capacidades, permisos o aprobación; ver entrega84 y consolidado de verificaciones.'
meta['verification']['evidence_paths'].append('docs/evidence/nodia-ai-ai38-verifications-r01.json')
assert len(meta['verification']['evidence_paths'])==32
meta['verification']['notes']='Cortes anteriores conservados en sus evidencias. Continuación AI-38:17 solicitudes generativas explícitas completadas y ACK (C05 cuatro, routing cinco, archivos ocho), sin replay ni negocio operativo. Tres capacidades actuales más cuatro históricas: primer lote C05 siete de siete acumuladas, sin reejecutar las siete en esta época. PNG/PDF/WAV/WebM en Web y Agentic; audio TTS, no micrófono/UI/R2 ni otros MIME. Contexto14 checks con dos procesos/compilador/PostgreSQL y dispatches sintéticos; worker standalone11, repetidos con dependencias frescas; API production11 con sesiones fixture, no OAuth real. Un npm ci real, lock/versiones intactos. Paquetes no adoptados; c703 y31 fichas aprobadas conservados. Cuatro servicios reanudados, misma época Gemini/Node932, cero pendientes. Infraestructura y adopción/reversión requieren pruebas propias; 77 candidatas sin publicar. No se atribuye causa a timeouts históricos ni se extiende la conservación. No repetir las suites completas previas sin cambios de producción: esta continuación agrega arneses y evidencia; QA focal y compilación de conocimiento verifican el delta.'
body += '\n\n## Anexo AI-38: verificación funcional posterior a MCP High\n\nEl [consolidado](../../../../evidence/nodia-ai-ai38-verifications-r01.md) distingue17 solicitudes reales completadas/ACK de las pruebas aisladas: C05 tres capacidades actuales, routing opt-in y cuatro formatos exactos en ambos modos. El primer lote C05 alcanza siete aceptadas acumuladas sin trasladar las cuatro históricas a la época actual. No publica nuevas herramientas.\n\nEl contexto evoluciona mediante releases fijadas por proceso: el trabajo admitido conserva su versión y el siguiente turno puede usar la nueva; el rollout conserva o drena consumidores compatibles. No se promete hot reload. Worker y API de producción con dependencias frescas funcionan en PostgreSQL/Redis desechables y sesiones fixture, sin acreditar OAuth Google ni adopción completa.\n\nServicios reanudados con la misma época Gemini y Node932 intacto, cero pendientes. Los gates de infraestructura de conservación/restore y despliegue/reversión con UI autenticada mantienen AI-38 parcial. No se amplía retención ni se acredita eliminación remota. Esta revisión8 sigue draft/unregistered/approval null y queda excluida del contexto publicado c703.\n'
p.write_text('---\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n---'+body,encoding='utf-8')
print('Documentation and runtime-policy revision8 written; approval/publication unchanged')
