# ADR-015 — Recuperación de proveedores de IA por API

> Estado: propuesto; decisión funcional confirmada por el usuario el 2026-10-06, documento no aprobado automáticamente
> Fecha: 2026-10-06

## Contexto

El usuario confirmó que la prohibición general de API keys era excesiva: quedan excluidas las gratuitas de Gemini, pero se permiten OpenAI y Gemini API de pago. Solicitó recuperar los modos configurables, el catálogo y la administración de claves. La retirada del frontend está identificada en `623a72c`; revertirlo completo perdería mejoras posteriores. La migración antigua de flags no debe repetirse para recuperar configuración.

## Opciones consideradas

### Opción A: revertir la implementación completa de septiembre

- Ventaja: recupera rápidamente los controles antiguos.
- Desventajas: restaura contratos obsoletos, pierde correcciones posteriores y no aporta una ejecución OpenAI real.

### Opción B: recuperación selectiva y adaptadores API explícitos

- Ventajas: conserva sesiones, contratos actuales y configuraciones existentes; permite agregar claves por instancia y descubrir modelos de la cuenta.
- Desventajas: requiere validar transporte, parsing, selección concurrente y migración incremental.

## Decisión

Se implementa B. `ai_provider_catalog` expresa permisos de configuración: Gemini tiene `can_use_api_key`, `can_use_token_plan_web` y `can_use_token_plan_agentic` verdaderos; OpenAI solo el primero. Los registros históricos se conservan. El selector devuelve catálogos activos que tienen una integración registrada; insertar un catálogo arbitrario no implementa su adaptador.

Cada instancia conserva flags `use_*`, `default_mode`, modelos dentro de `fields[modo]` y claves propias en `ai_api_keys`. No se permite cambiar su catálogo al editarla. El frontend no apaga API ni rotación al modificar otras propiedades. OpenAI ofrece API; Gemini permite los tres modos. Esto no certifica disponibilidad de Antigravity.

Los adaptadores oficiales usan Gemini `models`/`generateContent` y OpenAI `models`/`responses`, con URLs fijas, credenciales en cabeceras, redirecciones rechazadas, plazo HTTP y tamaño de respuesta acotados. Se utiliza el ID de modelo configurado o elegido explícitamente del catálogo sincronizado. No hay lista fija de modelos ni capacidades/cuotas deducidas por nombre. El catálogo remoto autoriza intentar ese modelo; no prueba una inferencia exitosa ni compatibilidad con cada tipo de documento.

Las facturas admiten PDF/imágenes validadas y salida JSON validada en servidor, conservando cero y valores ausentes. OpenAI solicita `store:false`. No se reintenta una inferencia con resultado incierto. La rotación opcional solo recorre claves de esa instancia ante rechazo HTTP 401/403/429, como máximo veinte claves y con plazo compartido de 90 segundos. No cambia de modo/proveedor ni modifica automáticamente la clave principal. No se fabrica un cooldown ni un estado persistente de incidente a partir del catálogo.

Las claves se cifran con el mecanismo existente AES-256-GCM y no se devuelven completas. Crear/seleccionar/eliminar serializa cambios mediante bloqueo transaccional de la instancia; un duplicado revierte sin perder la selección anterior. La consulta operativa exige clave activa, seleccionada y fuera de cooldown, salvo rotación habilitada para la ejecución.

La migración `1791320000000` agrega columnas ausentes y hace upsert de Gemini/OpenAI sin eliminar instancias, claves ni catálogos históricos. El script objetivo respalda solo datos públicos del catálogo y ejecuta únicamente esta migración. `down` conserva filas/columnas para evitar cascadas y pérdida de configuraciones; revertir su registro de migración no restaura la configuración previa. La reversión operativa exige revisar el respaldo y las referencias creadas posteriormente.

## Consecuencias

- API keys nuevamente administrables en Ajustes > IA: agregar, seleccionar y eliminar con confirmación, feedback ES/EN y modal preservado ante error.
- Modelos descubiertos y guardados por modo; no se hereda una selección raíz histórica cuando existen configuraciones separadas.
- La suscripción ChatGPT y el acceso API son credenciales/productos separados; Nodia necesita una clave con acceso al modelo elegido. No se asume saldo o cuota por tener una suscripción.
- No se ha realizado inferencia de pago con cuentas reales. La compatibilidad del modelo elegido, acceso de la cuenta y límites reales se comprueban al usarlo.
- Auditoría visual retirada, alertas persistentes de credenciales, login remoto VPS y adaptador real de Antigravity continúan fuera de esta recuperación. No se declara aprobado el lanzamiento ni S-07/S-08 completos.

## Referencias

- [Entrevista actualizada](../../mvp/15-ai-providers-interview.md), [entrega](../../mvp/16-ai-provider-management-handoff.md), [seguimiento](../../mvp/19-prelaunch-review.md).
- [ADR-006](ADR-006-ai-provider-configuration.md), [ADR-009](ADR-009-truthful-gemini-engines.md).
- [OpenAI: modelos](https://developers.openai.com/api/reference/resources/models/methods/list), [PDF como entrada](https://developers.openai.com/api/docs/guides/pdf-files), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs).
- [Gemini: modelos](https://ai.google.dev/api/models), [salidas estructuradas](https://ai.google.dev/gemini-api/docs/structured-output).

## Controles recuperados — 2026-10-06

El contrato de [funcionalidades IA](../../mvp/ai-provider-feature-contract.md) fija el esquema sin columnas legacy, predeterminado al crear, orden de paneles, tabla de claves con iconos/switches, selección única activa y etiquetas de cuota. La selección por switch es directa; solo eliminar exige confirmación. La migración 1791330000000 repara una única clave activa histórica; crear/editar/eliminar mantienen la regla con el mismo lock de instancia. Thinking Web se observa como opción del SDK; Low/Medium/High agéntico es una preferencia persistida, sin declarar ejecución disponible. No se marca aprobado este ADR.
