# AI-40: entrega y operación en la VM Linux local

Estado: entrega parcial de laboratorio, sin aprobación documental automática. El detalle por gate y los cortes históricos están en [86](../mvp/86-nodia-ai-ai40-codex-acceptance.md).

## Versión activa

API y worker utilizan `/opt/nodia/releases/nodia-server-ai40-r03`. El [manifiesto](nodia-ai-ai40-server-package-r03.json) contiene 4.060 archivos/2.887 outputs; SHA256 `0e769ded9a0a36e6d62a17415ea15d1843ce48735ff746ce5e238c5c3b2ea341`. La [adopción completada](nodia-ai-ai40-availability-adopt-r01.json) conserva esquema, configuración, sesiones, journal y época Gemini. R02 se adoptó después de dos intentos detenidos antes de admisión; sus recibos originales se conservan. R03 incorpora la normalización precisa de perfil ocupado. La ventana de recuperación del Client se verifica por separado.

El Client compilado y el Client usado en navegador se identifican por separado. La UI autenticada de esta entrega usa Vite en `localhost:5174`; no acredita adopción de esos assets en nginx. La sustitución local por preview fue rechazada por revisión automática antes de ejecutarse; no se conoce una razón más específica. Se conservó el servidor existente.

## Selección y aceptación

Elegir OpenAI → Agentic explícitamente en el drawer. Modelo e intensidad proceden de catálogo/configuración reales; no hay fallback ni delegación Gemini→Codex. El acceso a la cuenta continúa en Ajustes IA, fuera del chat. No copiar perfiles, códigos o tokens. API/OpenAI Web y los originales sin prueba propia siguen sin habilitarse.

La disponibilidad MCP requiere aceptación exacta de conexión, configuración/sesión, modelo/esfuerzo, binario y código. Una actualización del canal invalida el recibo anterior. El [canario R06](nodia-ai-ai40-real-canary-r06.json) ejecutó una generación y un callback con gateway/SQL desechable, terminal y ACK. El [turno desde UI](nodia-ai-ai40-ui-availability-sql-r01.json) verifica adicionalmente el worker normal y respuesta semántica; el canario aislado no sustituye esta prueba.

El operador en el host usa el transporte público del servicio de keyring. Los servicios usan su alias de socket dentro del namespace de montajes de systemd. Inspeccionar ese alias desde el host no permite concluir que esté mal configurado. No cambiar el entorno ni las restricciones de systemd para hacer coincidir ambos paths.

## Reversión preparada

La reversión necesita cerrar admisión, drenar jobs/slots y verificar terminal/ACK nativos antes de cambiar archivos. No libera incertidumbres por antigüedad, no reenvía generaciones, no restaura SQL ni revierte efectos comerciales. El driver fija fuente/destino, manifiestos, binario, política y descriptores protegidos; no es un desplegador genérico.

Driver remoto: `/opt/nodia/verification/ai40-availability-operator-r01/nodia-ai-ai40-availability-adopt-r01.py`, SHA256 `d34a2d92fdadca4901282a4cc3ccf75d5948901e4a5c8a14e1915df1cf1f9b87`. Base congelada: `/opt/nodia/verification/ai40-operator-r05/nodia-ai-ai40-adopt-r01.py`, SHA256 `c952cf7136c61ddb531789e52e47972e16f4bc1d9c481a9d519ff43b66f7a000`. Plan remoto de ese directorio: `nodia-ai-ai40-adopt-plan-r03.json`, SHA256 `1edc3fa69a83d79be98d31831b1fcafd3da99b68b324b0cab1a79eeac52793b5`.

Con las comprobaciones vigentes, `rollback --execute` usa ese plan y esos argumentos `--base-driver`, `--plan`, `--plan-sha256`. Conserva instantáneas privadas de los tres descriptores y exige backup cifrado fresco. No ejecutar de nuevo `adopt` sobre el WORK ya consumido. Una salida incierta requiere observar y conciliar, no un retry automático. El directorio XDG privado puede recrearse al reiniciar: se preservan tipo, propietario, permisos, dispositivo y entorno; el socket conserva además su identidad.

Esta entrega adopta R03; no acredita haber ensayado su reversión posterior a los turnos actuales. No reutilizar drivers históricos AI-38 suprimiendo validaciones.

## Conservación y pendientes

Los PostgreSQL desechables de los canarios completos fueron retirados. El chat de aceptación y sus recibos permanecen para revisión; la retención habitual sigue vigente. Conservar las evidencias negativas, paquetes anteriores y backups cifrados administrados por su catálogo. No eliminar journals, locks o perfiles para simular limpieza.

El cierre completo de AI-40 requiere aún los gates que 86 mantenga pendientes: lecturas por familias restantes, recuperación real propia, formatos y entrega compilada. El [efecto financiero confirmado por el usuario](nodia-ai-ai40-ui-effect-sql-reloaded-r01.json) cuenta con una ejecución, un recibo y un único movimiento 2. El éxito del índice técnico no acredita todas las capacidades publicadas, Windows o producción.
