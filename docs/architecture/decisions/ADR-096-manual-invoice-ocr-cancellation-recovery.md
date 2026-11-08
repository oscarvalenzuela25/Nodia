# ADR-096 — Recuperación identificada del OCR manual al cancelar

> Estado: propuesto
> Fecha: 2026-11-06

## Contexto

El QA de Gemini en la VM confirmó que cancelar el OCR manual termina la espera HTTP y el proceso local, conserva el archivo, pero deja una cuarentena sin identidad. El siguiente análisis explícito falla `runtime_busy`; Server lo convertía en extracción inválida y la consulta de disponibilidad lo presentaba como sesión inactiva. El cierre de la conexión no prueba cierre nativo ni parada del proveedor remoto.

Chat, Teacher y login tienen protocolos de identidad y recuperación propios. Sus recibos no prueban el cierre del OCR manual. La regla actual de Native prohíbe liberar marcadores históricos sin identidad; esta decisión no les atribuye retrospectivamente una identidad perdida.

## Opciones consideradas

### Liberar al abortar HTTP o al terminar el líder del CLI

Simple, pero no demuestra cierre de descendientes, IO o recursos propios. Podría liberar el perfil antes de tiempo o afectar otra operación. Se descarta.

### Conservar toda cuarentena hasta una recuperación manual

Mantiene el cierre conservador, pero inutiliza el perfil tras una cancelación ordinaria incluso cuando puede comprobarse el cierre de la invocación propia. Se conserva como comportamiento cuando falta prueba positiva.

### Identidad OCR y prueba de cierre por invocación

Asignar una identidad interna antes del envío, ligarla al recurso físico y registrar sólo la evidencia mínima de cierre local. Conciliar capacidad únicamente tras comprobar el cierre de esa invocación y la coincidencia del marcador y del dueño. Resultado remoto incierto permanece explícito; no se reenvía la solicitud cancelada.

## Decisión

Implementar la tercera opción para las nuevas ejecuciones OCR. La prueba debe contener la ejecución propia y sus descendientes, además de recoger el proceso y drenar/cerrar IO. Si la plataforma no permite demostrarlo o el cierre falla, el perfil permanece bloqueado. No hay fallback de proveedor, modo o modelo.

Native comunica por cabecera sólo los códigos públicos permitidos con su estado HTTP compatible. Server conserva los conflictos de admisión y esos códigos, sin reenviar cuerpos del proveedor. La consulta de disponibilidad conserva el motivo seguro; no convierte `runtime_busy` en un diagnóstico de autenticación. Client conserva la selección y el archivo; comprobar disponibilidad es una lectura separada de iniciar un nuevo análisis explícito.

Los marcadores históricos sin identidad permanecen bloqueados por defecto. Cualquier recuperación administrativa excepcional requiere una decisión humana explícita sobre una acción concreta, evidencia preservada y comprobaciones de exclusión; no es un recibo de cierre nativo ni una aprobación general de esta ADR. No añadir una excepción automática para marcadores históricos.

## Consecuencias

- Cancelar conserva el archivo y no aplica respuestas tardías. Una nueva intención puede analizar ese archivo después de demostrar el cierre local anterior.
- Un error de cierre, crash o prueba incompatible conserva cuarentena. Disponibilidad configurada o autenticada no acredita inferencia.
- Los recibos mínimos no conservan documento, prompt, cuenta, tokens o respuesta del proveedor; su retiro sigue el protocolo de cierre propio del OCR.
- Probar cancelación antes y después del envío, descendientes, IO pendiente, dueño ajeno, marcador incompatible, reinicio y nueva intención sin replay. La prueba real de la VM se documenta por separado.

## Protocolo de cierre del OCR manual

El ledger dedicado `manual_invoice_proofs` registra el intento y el recurso antes de generar. La contención real se prepara antes de armar el despacho; el lanzador espera su incorporación al cgroup antes de ejecutar el CLI. Un terminal `completed` o `abandoned_unknown` requiere cgroup propio vacío y retirado con ausencia comprobada, líder recogido e IO cerrado. Un fallo de retirada conserva la prueba sin cierre y el bloqueo. Después de la coincidencia exacta del marcador se concilia capacidad y se acusa ese recibo. Este ACK local sigue la transición de admisión; el OCR manual no tiene un commit comercial SQL en ese punto.

Un crash antes del terminal conserva cuarentena. Un terminal durable anterior a la conciliación permite recuperar exclusivamente esa operación. Si la capacidad ya se concilió pero faltó ACK, la limpieza acotada retira sólo el recibo cerrado; no libera otro dueño. Un recibo armado sin marcador sigue bloqueando. Contención no disponible rechaza antes de armar/enviar; no se afirma soporte equivalente en Windows.

## Excepción administrativa autorizada para el bloqueo anterior

El usuario respondió explícitamente «Sí, autorizar esa recuperación única» a la propuesta de retirar sólo el marcador legado de la prueba sintética anterior, preservando copia y resultado remoto desconocido. La autorización vincula el plan SHA256 `f49b8e5f52d469cedf12f806a15aa28b12d9fb204db538b78604fb7479ac4bf0`, helper `334a6dab8818bcbedc21282191954bb18fc4504f8e4aed35861ea3e9c795cbdc` y marcador `7f51b4fb44dbc72708fac0a474600c2e9d8af4ce3a8b8f1680330454f6a8d68f` del recurso físico `433e10d914ee92a1484882d4a4860fcde80cd41f4abc6fb53ce17f97f0904e7d`.

La excepción se ejecutó una sola vez durante la adopción de NativeR13/ServerR12, con servicios detenidos, quietud fresca, exclusión de otros dueños, copia privada y CAS del archivo exacto. El recibo específico SHA256 `4bf0c4b198bff6144de74b719ecd2fd89d981b8565b94334e064265942092bd9` y el recibo conjunto `7f64edc05cf2b8bd55705c606dba579a92dc318a2039a486f14b20f49bedf159` distinguen ejecución de autorización. El resultado remoto anterior sigue desconocido. No autoriza otros marcadores, replay, reconfiguración de credenciales, eliminación de evidencia, una excepción automática o la aprobación general de esta ADR. Las adopciones posteriores no reutilizan esta excepción.

## Referencias

- [Plan94 §36](../../mvp/94-business-point-of-sale-and-product-refactor.md#36-bloqueo-y-cancelación-del-análisis-manual-de-facturas--2026-11-06).
- [Contrato de proveedores](../../mvp/ai-provider-feature-contract.md).
- [Verificación91, P13](../../mvp/91-ai-provider-onboarding-verification.md).
- [QA anterior](../../evidence/invoice-gemini-cancellation-qa-20261106-r01.json).
