# ADR-009 — Identidad verificable de motores Gemini y extracción estricta

> Estado: propuesto; mitigaciones locales implementadas por autorización del usuario
> Fecha: 2026-10-03

## Contexto

Nodia permite exclusivamente sesiones Antigravity y Gemini Web, sin API keys ni modelos estáticos. El adaptador agéntico anterior declaraba sesión por marcadores de entorno/directorios/Web y ejecutaba Web si no podía usar su SDK con key; además atribuía cuotas Web a Antigravity. El paquete instalado `google-antigravity` 0.1.20 tiene una validación de `GeminiAPIEndpoint` que exige API key en su camino local por defecto. Esto confirma la incompatibilidad de ese camino, no la imposibilidad de cualquier otra integración Antigravity.

## Opciones consideradas

### Opción A: conservar la delegación a Web y los defaults

- Ventaja: los análisis parecen continuar disponibles.
- Desventajas: consume otra cuota, falsea identidad/disponibilidad y contradice la política confirmada. No es admisible.

### Opción B: separar motores y fallar explícitamente hasta verificar un adaptador de sesión

- Ventajas: identidad y consumo comprobables; Web sigue siendo utilizable cuando está configurado; errores y borradores conservan su significado.
- Desventajas: el modo agéntico queda no disponible hasta implementar y probar una integración permitida; algunas configuraciones antiguas requieren sincronizar modelos.

### Vía pendiente de evaluación: CLI oficial con sesión Google

La [documentación oficial de Antigravity CLI](https://antigravity.google/docs/cli/overview) y su [repositorio](https://github.com/google-antigravity/antigravity-cli) describen el motor compartido con Antigravity y autenticación Google mediante keyring/navegador, también para SSH. Es un candidato de sesión diferente del camino por API key del SDK retirado. No demuestra por sí solo un contrato de OCR, descubrimiento/cuotas programático ni aislamiento apto para este microservicio. `agy` no se encontró en el PATH de este PC durante la revisión.

El usuario confirmó el 2026-10-03 que utiliza **la aplicación de escritorio**; se observó su instalación local sin inspeccionar credenciales ni ejecutar inferencia. La [documentación de autenticación de CLI](https://antigravity.google/docs/cli/install/) describe su propio login Google; importar conversaciones de escritorio no prueba reutilización de credenciales ni disponibilidad de OCR. Pendiente verificar un puente compatible con esa sesión, el protocolo/headless y el aislamiento de herramientas/archivos, además del entorno VPS. No ejecutar un agente con acceso al workspace/secretos de Nodia para analizar documentos.

## Decisión

Aplicar B como mitigación autorizada: Antigravity devuelve indisponibilidad explícita, catálogo vacío y cuota desconocida. Retirar SDK/ramas de key/catálogo estático sin borrar credenciales o perfiles operativos. La futura integración exige prueba independiente de sesión, inferencia y descubrimiento local/VPS sin key. Si no puede observarse cuota, indicar desconocida; no inventarla ni copiar Web. No declarar completado el soporte dual.

Los análisis requieren modelo explícito y coincidencia exacta con el descubrimiento de la sesión. Se admite el ID o nombre exacto reportado para compatibilidad; el catálogo expone ID real. Una recuperación de autenticación mantiene el mismo ID. Sin evidencia de capacidades, no habilitar razonamiento por nombre ni inventar ventana de contexto. No cambiar modelo/motor al reintentar.

Un parser compartido valida con Pydantic la extracción: números finitos, no negativos, cero conservado, faltantes nulos y productos estructuralmente válidos. Server preserva esos datos para revisión en Client y propaga los fallos HTTP sin texto bruto. No confundir extracción con confirmación transaccional de factura/stock, pendiente en Server.

Mantener un worker mientras perfil/locks/admisión sean locales al proceso. Aislar pruebas antes de importar clientes; limitar cuerpo/admisión antes de multipart. El acceso sigue privado conforme a ADR-007/008.

## Consecuencias

- Estado observable fiable y ausencia de consumo Web oculto desde el modo agéntico.
- El soporte Antigravity real y el login remoto privado continúan pendientes; requiere evidencia con sesión de prueba, no marcadores o mocks.
- Sincronizar modelos descubiertos y revisar configuraciones de razonamiento anteriores antes de usar la entrega con cuenta real. Server aún tiene trabajo pendiente S-07/S-08 en selección de instancia/modo/migración.
- Ensayar permisos de UID 10001, recuperación de volúmenes, límites de recursos y acceso desde fuera del VPS. La validación de Compose local no prueba esos controles.

## Referencias

- [Revisión y seguimiento](../../mvp/19-prelaunch-review.md)
- [ADR-005](ADR-005-gemini-web-session.md), [ADR-007](ADR-007-gemini-internal-access.md), [ADR-008](ADR-008-internal-microservices-only.md)
- [Configuración oficial del SDK](https://github.com/google-antigravity/antigravity-sdk-python/blob/main/skills/google-antigravity-sdk/references/agent_configuration.md): sus caminos de nube documentados usan API key o proyecto/ADC; no confundirlos con una sesión de suscripción Antigravity.
- `nodia-gemini-microservice/agentic_service.py`, `invoice_parser.py`, `schemas.py`, `request_guard.py`, `run_tests.py`
