# AI-38 — Verificaciones posteriores a MCP High

Fecha: 2026-10-20. Estado: verificaciones funcionales satisfactorias con alcance acotado; **AI-38 continúa parcial**. [Entrega84](../mvp/84-nodia-ai-ai38-environment-acceptance.md) y [validación reproducible](nodia-ai-ai38-verifications-r01.json).

| Verificación | Resultado y alcance acreditado |
|---|---|
| Tres capacidades pendientes del primer lote C05 | Preparar/listar preferencias y preparar un movimiento financiero aceptadas con Gemini High real. Cuatro inicios y cuatro ACK; confirmación HTTP exacta, efecto/recibo únicamente en PostgreSQL desechable. [Delta](nodia-ai-ai38-c05-current-delta-r01.json) |
| Web→Agentic→Web | Trece controles, cinco generaciones y cinco ACK. Conversación Web, delegación opt-in, descubrimiento y lectura MCP de productos, continuidad del historial y siguiente turno nuevamente Web. [Prueba real](nodia-ai-ai38-live-routing-routing01.json) |
| Archivos Agentic | PNG, PDF, WAV y WebM: cuatro respuestas semánticamente verificadas, terminal `completed`, ACK y ningún pendiente. [Cohorte](nodia-ai-ai38-modalities-agentic-cohort-02.json) |
| Archivos Web | Los mismos cuatro MIME exactos, con las mismas condiciones de aceptación. [Validación](nodia-ai-ai38-modalities-web-validation.json) |
| Evolución del contexto | Catorce controles con compilador real, PostgreSQL y dos procesos aislados: run antiguo conserva A, B no lo reclama; siguiente turno del mismo chat recibe producto revisado y función nueva de B. Historia, autoridad y recibo anteriores intactos. Dos dispatches sintéticos, cero proveedor. [Evidencia](nodia-ai-ai38-context-evolution-validation.json) |
| Worker independiente | Once controles sobre el proceso compilado real: consume ejecución confirmada, guarda un efecto y un recibo, permite consultarlos al volver y no duplica al repetir la confirmación. Salida limpia ante SIGTERM tras finalizar el trabajo; no prueba drenaje de una ejecución activa. [Evidencia](nodia-ai-ai38-worker-process02.json) |
| Instalación de producción limpia | Un `npm ci --omit=dev` real, lifecycle/TLS normales, versiones exactas del lock y 2.827 outputs intactos. Se repiten los once controles del worker con dependencias frescas; no son once casos de negocio nuevos. [Evidencia](nodia-ai-ai38-dependencies-r01.json) |
| Bootstrap API de producción | Once controles sobre `dist/main.js` con dependencias frescas, sin Nest Testing: acceso público, sesión fixture, propiedad, módulo y revocación; ocho GET funcionales. PostgreSQL/Redis desechables, cero proveedor. [Evidencia](nodia-ai-ai38-fresh-api-process-validation.json) |

Son **17 solicitudes generativas explícitas, todas completadas y reconocidas mediante ACK**, sin replay automático: cuatro C05, cinco routing y ocho archivos. No son una medición de llamadas internas, tokens, cuotas ni facturación. Los dispatches sintéticos y observaciones no generativas se contabilizan por separado. Los fallos de arnés previos quedan preservados: casts/identificadores de fixture, composición de repositorios y carga tardía de variables antes de importar el adaptador. La cohorte Agentic inicial de formatos no despachó ninguna inferencia; corregir el arnés no es una corrección de producción ni un retry de resultado incierto.

El primer lote C05 alcanza **aceptación representativa acumulada de siete de siete**: tres capacidades verificadas en esta época y cuatro históricas con sus contratos contrastados. No se reejecutaron las siete en la época actual. AI-36 sigue abierto por publicación/aceptación restante: 74 capacidades publicadas en el catálogo del paquete candidato, 77 candidatas sin publicar; no se actualizó el Node operativo. No se cambiaron contratos, permisos, herramientas o fichas aprobadas.

Las pruebas nativas de archivos verifican exclusivamente `image/png`, `application/pdf`, `audio/wav` y `audio/webm`. El audio es TTS sintético conocido; no acredita un micrófono físico, nueva aceptación de UI/R2/copia a factura o archivo+MCP combinado. No habilita JPEG, WebP, Ogg, MP3 ni MP4 por analogía. Web sigue conversacional y MCP corresponde a Agentic; la delegación requiere el switch y conserva el botón humano para escrituras.

Los ensayos de contexto acreditan evolución entre procesos fijados a releases distintas, **sin hot reload**: un rollout debe drenar o conservar un consumidor compatible con el trabajo anterior. API y worker reales aíslan PostgreSQL/Redis y usan sesiones emitidas como fixture; no verifican login OAuth Google o el shell completo. Estas pruebas no adoptan los paquetes completos Node/Client en servicios operativos.

## Cierre operativo

Se [pausaron](nodia-ai-ai38-verifications-pause-r01.json) sólo API/worker para serializar la sesión real y se [reanudaron](nodia-ai-ai38-verifications-resume-r01.json) a las 20:01 UTC. Los cuatro servicios quedan activos; Gemini mantiene contenedor `802d6d…`, imagen diagnóstica `b8efad…` y arranque 19:14:35 UTC, sin otro reinicio. Se conserva Node operativo de 932 outputs y su hash original.

La [observación final](nodia-ai-ai38-verifications-modalities-final-r01.json) devuelve Web/Agentic disponibles, MCP false/true respectivamente y los cuatro MIME verificados en ambos. Conserva selección/configuración/sesión; es metadato posterior a las pruebas generativas, no otra inferencia. [Inventario final](nodia-ai-ai38-verifications-final-inventory-r01.json) y [cierre nativo](nodia-ai-ai38-verifications-final-native-closure-r01.json): cero trabajos, intentos, slots, pruebas o temporales pendientes. No hubo escrituras comerciales operativas, R2, cambio de proveedor, modelo o intensidad, ni cambios de reloj.

## Pendientes concretos

- Adopción/reversión de los paquetes completos Node/Client, origen/proxy de destino y aceptación del flujo autenticado de UI sobre ese despliegue exacto. Las sesiones fixture y los procesos aislados no sustituyen esos gates.
- Infraestructura real de conservación: copias cifradas con recuperación de claves y rotación conforme a política50, journal continuo de eliminación, inventario de versiones/objetos y restore externo en cuarentena con conciliación. La [observación acotada](nodia-ai-ai38-infrastructure-observation-r01.md) acredita permisos/artefactos, no cifrado, cobertura o rotación. No encontrar un timer en el inventario consultado no demuestra ausencia global.
- Publicación y aceptación del catálogo restante de AI-36; otras modalidades y etapas API/Codex conservan su alcance propio.

No se amplía la retención de conversaciones o auditoría ni se declara borrado remoto del proveedor. Las matrices históricas y plan45 permanecen intactos. La ficha operativa revisión8 continúa draft/unregistered/approval null; el contexto aprobado conserva release `c70317…`, 31 documentos/fragmentos y 74 capacidades en el catálogo candidato. Los timeouts históricos no adquieren una causa demostrada por estos éxitos.
