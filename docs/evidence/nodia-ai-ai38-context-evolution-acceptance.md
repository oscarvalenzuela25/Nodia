# AI-38 — Evolución aislada del contexto entre releases

Fecha: 2026-10-20. Estado: verificado en laboratorio aislado; sin adopción o publicación operativa.

[Validación y hashes](nodia-ai-ai38-context-evolution-validation.json). El intento [R03](nodia-ai-ai38-context-evolution-r03.json) pasa 14 comprobaciones sobre el candidato Node01 congelado. Se conserva su manifest SHA-256 `0751160bb8cb146acec9dda21daa0226875a2c40f1c898a9c649e69a9583b8e3`, verificado antes y después. No se editó código productivo ni se recompilaron sus assets.

El arnés utiliza el compilador real, metadata y aprobaciones **exclusivamente sintéticas** en un directorio temporal. Release A explica un producto fixture mediante un contrato de lectura ya implementado. Release B incrementa la revisión de ese producto y añade una ficha de funcionalidad, conservando el mismo contrato ejecutable. No añade herramientas de dominio ni aprueba fichas del repositorio.

Dos procesos Node distintos cargan DI, loader, admisión y stages compilados contra una misma PostgreSQL16 desechable. A admite un turno con su release; se compila B mientras A sigue vivo. B rechaza reclamar el trabajo de catálogo A. A conserva su loader anterior y completa una sola respuesta usando A. Tras cerrar A, el siguiente turno del mismo chat se admite y completa en B: recibe el resumen revisado, el índice de la funcionalidad nueva y el historial canónico de A. La consulta de detalle utiliza el loader real; sin el módulo de destino, el contenido permanece oculto.

Los hashes anteriores y posteriores del `context_manifest`, intentos terminales y recibo nativo de reconciliación de A coinciden. El recibo es un registro real de PostgreSQL con prueba del adaptador sintético; no es una atestación Gemini. B no reejecuta el turno antiguo. Hay dos dispatches de fixture y **cero solicitudes al proveedor**.

El mecanismo verificado requiere procesos nuevos por release. No existe hot reload en esta prueba ni se modifica el contexto de un turno admitido. Una publicación que cambia el catálogo requiere conservar un consumidor compatible para terminar los trabajos anteriores o drenarlos antes de sustituirlo; la nueva release no los reclama por su cuenta.

Los intentos [R01](nodia-ai-ai38-context-evolution-r01.json) y [R02](nodia-ai-ai38-context-evolution-r02.json) se preservan: el primero detectó una inferencia ambigua de tipos SQL del fixture; el segundo rechazó correctamente un ID con underscore no admitido por el esquema documental. Se corrigieron únicamente las entradas del arnés. Ambos retiraron su contenedor y conservaron intactos los contenedores preexistentes.

El [driver](scripts/nodia-ai-ai38-context-evolution-r01.py) limita la ejecución a 300s y mantiene una salida por intento sin sobrescribir evidencia. La limpieza de emergencia sólo admite el prefijo exacto del PID propietario y ocho caracteres hexadecimales, comparándolo contra el inventario inicial. R03 no necesitó limpieza de emergencia: el fixture retiró su contenedor. No se leyó la configuración de la BD operativa, `.env`, perfiles, credenciales ni almacenamiento externo; no se reiniciaron servicios operativos. La evolución real en el entorno operativo conserva sus gates propios.
