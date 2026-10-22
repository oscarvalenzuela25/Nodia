# NodiaAI — AI-02: viabilidad Gemini Web

> Estado: spike AI-02 completado; loop Web viable en el ensayo real, runtime/herramientas productivas sin publicar
> Fecha: 2026-10-14
> Etapa: E0; [plan45](45-nodia-ai-implementation-plan.md), [contratos AI-01](46-nodia-ai-ai01-contract-baseline.md)
> Evidencia: [informe sanitizado](../evidence/nodia-ai-ai02-gemini-web-viability.json)
> Aprobación documental: pendiente; la autorización de ejecutar AI-02 no aprueba este documento

## Resultado actual

**Alcance posterior confirmado:** [política48](48-nodia-ai-mode-routing-policy.md) deja Web sólo conversacional y Agentic con MCP, con switch de alternancia opt-in desde Web; API después. El resultado técnico de AI-02 se conserva, pero el loop de herramientas Web no se publicará en el producto. La alternancia es una nueva política del coordinador, no acceso MCP nativo de Web ni permiso de escritura.

Las **21 pruebas nuevas pasan en Linux** y las **151 pruebas existentes de la imagen desplegada** también pasan con su runner de aislamiento. El ensayo con cuenta completó los18 checks del segundo recorrido: siete invocaciones, solicitudes naturales de lectura/preparación, resultados con marcador impredecible, preview sin ejecución y continuidad mediante SDK e historial canónico. No hubo escrituras de negocio ni publicación de herramientas.

Primero `/web/status` devolvió `authenticated:false`, aunque existía perfil. Tras el login del usuario desde Nodia, autenticación real, descubrimiento y generación se comprobaron por separado. El modelo exacto configurado fue `56fdd199312815e2`, etiqueta descubierta `gemini-flash`, conexión2 y SDK2.1.1; son evidencia de esa sesión, no constantes del adaptador ni certificación de otros modelos.

Se reactivaron el frontend Windows en `http://localhost:5174` y su túnel SSH hacia la API de la VM; frontend y `/api/v1` a través de Vite respondieron200. Ambos ensayos detuvieron temporalmente sólo el propietario Web habitual y lo restauraron en `finally`. Se eliminaron únicamente los chats sintéticos creados; la comprobación posterior confirma sesión Web autenticada y API/Gemini/Nginx activos. No se copiaron credenciales al equipo Windows ni al chat.

Antes de generar, el harness exige coincidencia única por `model_id` configurado con el descubrimiento de la sesión. No usa aliases comerciales, primeros modelos ni fallback. Se hicieron dos recorridos independientes,14 invocaciones sintéticas en total: el primero completó el loop, pero sus preguntas de recuerdo incluían los valores esperados y no bastaban para demostrar continuidad. Se corrigieron esas preguntas y el segundo recorrido recuperó monto/fechas sin proporcionarlos en la pregunta. La evidencia autoritativa es ese segundo ensayo; no hubo retry automático de una generación incierta.

## Protocolo bajo evaluación

El SDK instalado `gemini-webapi2.1.1` expone `start_chat`, `generate_content(..., chat=...)`, metadata de continuidad y `delete_chat`. Se inspeccionó el código instalado y se contrastaron hashes de `gemini_service.py`, `main.py` e `interactive_login.py` con el checkout. La firma no demuestra function calling nativo ni MCP. AI-02 evalúa **un loop JSON gestionado por Nodia**, sobre la generación de texto Web, sin publicar endpoints.

Código opt-in: [harness](../../nodia-gemini-microservice/experiments/probe_nodia_ai_web.py) y [protocolo](../../nodia-gemini-microservice/experiments/nodia_ai_web_protocol.py). No son imports de `main.py`. El [schema de fixtures](../evidence/nodia-ai-ai02-fixture-protocol.schema.json) se genera desde los modelos Pydantic del harness y no añade herramientas al catálogo de producción.

| Entrada del ensayo | Validación y efecto |
|---|---|
| `fixture.availability.read` | Casa sintética fija, fechas civiles válidas y fin posterior al inicio; devuelve disponibilidad fixture y marcador aleatorio |
| `fixture.expense.prepare` | Nombre, importe entero como string, categoría fixture y estado explícito; devuelve preview sintética `awaiting_human_confirmation`, `executed:false` |
| `answer` | Texto acotado; no despacha una herramienta |
| Confirmar, ejecutar, SQL, HTTP o herramienta desconocida | Rechazo; no hay binding, credencial, token de aprobación ni executor |

Sólo se acepta un documento JSON completo, opcionalmente dentro de una única envoltura Markdown `json`. Se rechazan duplicados, extras, múltiples objetos, números no finitos y coerciones. No se rescata texto corrupto ni se reenvía una generación para reparar automáticamente su salida. El límite16KiB de respuesta,4096 caracteres de respuesta final, importes y timeouts son **presupuestos del ensayo**, no cuotas/capacidades del proveedor ni políticas productivas AI-04.

Los resultados de fixture los construye el gateway de prueba, nunca el modelo. No implementan disponibilidad, dinero, autorización o idempotencia de negocio. Su deduplicación es local a la instancia del ensayo y sólo comprueba identidad/payload del fixture; no sustituye receipts transaccionales. No se envían datos de Nodia, documentos del usuario, cookies de Nodia ni credenciales de la API al modelo.

## Matriz de comprobación

| Garantía | Evidencia actual | Pendiente |
|---|---|---|
| Selección exacta | `Selection` AI-01, lectura de configuración, descubrimiento y generación del mismo ID | Revalidar en cada admisión futura; otros IDs no certificados |
| Petición natural de lectura/preparación | Modelo produjo ambas solicitudes válidas con fechas/importe/estado solicitados | Contratos/autoridad de dominios reales en AI-14..29 |
| Ida/vuelta de herramienta | Respuestas finales citaron el marcador aleatorio del resultado | Salidas reales por schema registrado |
| Chat de varios turnos | Lectura → resultado → preparación → resultado en siete invocaciones | Admisión/persistencia/UI productivas |
| Rehidratación opaca | ChatSession reconstruido desde JSON privado recuperó monto/fechas sin recibirlos en la pregunta | Reinicio real del proceso no probado; no habilitar adapter_states por esta evidencia sola |
| Historia canónica | Chat Web nuevo recuperó monto/fechas desde el historial sin solicitar otra herramienta | Persistencia, compactación y presupuesto de contexto AI-10/12/34 |
| Separación de confirmación | Gateway rechaza confirmación/SQL/HTTP; preview sin ejecución; modelo respondió sin solicitar confirmación | UI/challenge/executor reales en AI-18; el rechazo del modelo no sustituye barrera del backend |
| Fallo/cancelación/timeout | Pruebas de transporte simulado: `unknown`, una invocación, sin retry; output inválido queda `invalid_response` | Recuperación tras caída real del proceso/proveedor y persistencia en AI-11/20; no inferir rollback remoto |
| OCR durante chat | Caso aislado del adaptador devuelve `web_busy` antes de inicializar SDK/leer archivo | Admisión compartida instalada en runtime NodiaAI |
| Logout durante chat | Caso aislado devuelve `web_session_busy` sin limpiar sesión | Mantener exclusión al integrar chat |
| Login durante chat | Diagnóstico aislado comprueba que el guard actual admite login bajo `_analysis_lock` | Exclusión compartida chat/OCR/login/discovery; gate de AI-04/11/12 |
| Limpieza/restauración | Ambos ensayos limpiaron chats propios y restauraron runtime; autenticación posterior comprobada | No equivale a purga física de Google o prueba de backup/VPS |

La falta de exclusión de login es un hallazgo del spike: `assert_login_allowed` comprueba limpieza/desconexión pendiente, pero no el lock de generación. Las rutas de chat todavía no existen; no hay una regresión de chat instalada. Antes de incorporarlas, la reserva común del runtime debe abarcar generación, OCR, renovación/login y descubrimiento. No basta con copiar el lock de OCR y llamar directamente al SDK desde un worker separado. La arquitectura43/AI-11 ya exige el propietario compartido; esta evidencia concreta su necesidad.

## Operación del ensayo real

1. Completar login Web desde Nodia y comprobar el estado autenticado, conservando conexión y selección del usuario. Si falta modelo o desaparece del descubrimiento, detenerse; no asignar otro.
2. En la VM privada, comprobar que no hay trabajo del usuario en curso. Detener temporalmente el propietario habitual **antes** de crear otro cliente: dos procesos no comparten perfil/caché. El frontend/API siguen activos durante la prueba.
3. Ejecutar el harness dentro de la misma imagen y mounts privados mediante `docker compose run --rm -T --no-deps --entrypoint python`, sin `--service-ports`, montando sólo los scripts del ensayo readonly. Usar los cuatro overlays que registra `nodia-gemini-lab`; no copiar `.env` o sesiones a Windows ni modificar configuración persistida.
4. Pasar `--live-web --model ID_CONFIGURADO --connection-id ID_CONFIGURADO` explícitos. El programa exige ID canónico positivo y modelo descubierto exacto; se detiene al primer error/salida inválida, sin sustituir cuenta/motor/modelo. Hasta siete invocaciones sintéticas con presupuesto120s por turno; conteo de invocaciones no se presenta como conteo de HTTP del proveedor.
5. El harness elimina únicamente los chats que creó y cierra su cliente. El supervisor restaura `nodia-gemini-lab` también ante fallo/timeout, elimina sólo su contenedor de ensayo por identidad y verifica health/estado habitual. No borrar sesiones o chats previos para hacer pasar la prueba.
6. Conservar sólo checks, fechas, selección, hashes, clases de error y tiempos; excluir prompts completos, respuestas crudas, cookies y continuidad opaca. Marcar una eventual autenticación posterior como observación nueva; no reemplazar el antecedente negativo por éxito ficticio.

Comandos de desarrollo reproducibles:

```text
python run_tests.py
python -m experiments.probe_nodia_ai_web --live-web --model ID_CONFIGURADO --connection-id ID_CONFIGURADO
```

El segundo requiere el entorno privado, dependencias y propiedad exclusiva de la sesión; no ejecutarlo en paralelo al servicio habitual. La suite unitaria nunca inicia ese comando. La imagen de laboratorio contiene las151 pruebas previas; las21 nuevas se comprobaron desde un directorio temporal con el mismo SDK/runtime y `test_support` antes de construir servicios, sin cambiar la imagen ni desplegar endpoints.

`node docs/evidence/scripts/validate-nodia-ai-ai02.cjs` compila el schema fixture con Ajv2020 estricto, consume `Selection` del contrato AI-01, comprueba barrera de herramientas y coherencia de18 checks/hashes/artefactos. Ese comando verifica evidencia guardada; no repite las pruebas Python ni las inferencias. Sintaxis Python y `git diff --check` también comprobados. El runner previo mantiene un warning de deprecación Starlette/httpx; no se cambiaron dependencias por este spike.

## Puerta de publicación

**AI-02 cierra la investigación con resultado positivo para el loop JSON observado; Gemini Web con herramientas continúa sin publicar.** La evidencia alcanza esa sesión/SDK/modelo/protocolo y el laboratorio Linux local. Antes de publicación faltan autoridad y contratos por dominio, propietario/slots compartidos con login, confirmación durable, límites y runtime productivos. La rehidratación probada no fija una ventana de contexto ni acredita compactación; no necesita activar `adapter_states` todavía. Agentic conserva su evaluación independiente AI-03 y E0 sigue abierto junto con AI-04.
