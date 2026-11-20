# Métricas del VPS con Grafana Alloy

Esta es la primera configuración de Alloy para el [Plan104](../../../docs/mvp/104-logs-and-monitoring-grafana-cloud.md). Recoge CPU, memoria, espacio de `/` y estado de `nodia-api.service`, `nodia-ai-worker.service` y `nginx.service` cada minuto. `node_scrape_collector_success` permite detectar si falla un recolector aunque el scrape responda. El estado de las unidades es una señal de systemd. Los checks HTTP externos se configuran aparte en Grafana Cloud.

## Preparar la instalación

1. Confirmar en el portal la región, los límites Free y el endpoint HTTPS de Prometheus Remote Write del stack. Usar el identificador de usuario de métricas y una credencial de ese stack con alcance `metrics:write`.
2. En un host sin Alloy, enmascarar `alloy.service` antes de instalar el paquete para evitar que arranque con la configuración de fábrica. Usar el [paquete oficial Linux amd64 de Alloy v1.22.0](https://github.com/grafana/alloy/releases/tag/v1.22.0). Verificar el SHA-256 del archivo `alloy-1.22.0-1.amd64.deb` (`29ca37327c02e30ff7cc3a1e0ff3779217f26092a1adc29ff4738f6a9e4370e3`) antes de instalarlo. Si ya hay un Alloy en el host, inventariar primero su versión, configuración y fuentes activas para preservar las integraciones existentes.
3. Instalar `metrics.alloy` como `/etc/nodia-alloy/conf.d/metrics.alloy` y `alloy.service.conf` como `/etc/systemd/system/alloy.service.d/nodia-metrics.conf`, ambos `root:root` con modo `0644`. Guardar el token mediante el canal de custodia del operador en `/etc/nodia-alloy/grafana-metrics-token`, `root:root` con modo `0600`. Systemd entrega una copia de lectura al servicio vía `LoadCredential`. El token queda fuera del entorno y del repositorio.
4. Crear `/etc/nodia-alloy/metrics.env`, `root:root` con modo `0600`, con los cuatro valores siguientes. Sustituir el endpoint y el usuario de ejemplo por los confirmados en el portal. Usar un alias estable por host.

   ```dotenv
   NODIA_GRAFANA_METRICS_URL=https://metrics.invalid/api/prom/push
   NODIA_GRAFANA_METRICS_USER=REEMPLAZAR_IDENTIFICADOR
   NODIA_MONITOR_INSTANCE=nodia-vps
   NODIA_MONITOR_ENVIRONMENT=production
   ```

5. Crear el usuario y grupo de sistema exclusivos `nodia-alloy` con `useradd --system --user-group --no-create-home --home-dir /var/lib/nodia-alloy --shell /usr/sbin/nologin nodia-alloy`. El drop-in usa esta cuenta sin grupos suplementarios y systemd crea su directorio de estado. En una primera instalación dedicada, quitar al usuario de fábrica `alloy` de `adm` y `systemd-journal` si el instalador lo agregó. Revisar esas membresías al actualizar el paquete. Comprobar los cuatro recolectores después de arrancar, incluido el acceso de `nodia-alloy` al estado de systemd por D-Bus.

## Activar y verificar

1. Cargar el archivo de valores y apuntar `CREDENTIALS_DIRECTORY` a `/etc/nodia-alloy` en una sesión root aislada para ejecutar `/usr/bin/alloy validate /etc/nodia-alloy/conf.d`. Ejecutar `systemctl daemon-reload` y `systemctl unmask alloy.service` después de validar. Arrancar con `systemctl start alloy.service`.
2. Comprobar el estado del servicio y que el listener está limitado a loopback. Consultar `/metrics` localmente para revisar los errores de envío. En Grafana Explore comprobar `up{job="nodia-host",environment="production"}`, las cuatro señales `node_scrape_collector_success` y `node_systemd_unit_state` para las tres unidades. Comprobar `node_filesystem_size_bytes` para `mountpoint="/"`. Ausencia de métricas o un recolector con valor `0` requiere diagnóstico aunque Alloy esté activo.
3. Medir series y consumo real en el portal con los límites permanentes de Free. Habilitar el arranque con `systemctl enable alloy.service` una vez comprobada la recepción. Registrar versión, resultado y uso medido en el Plan104.

En la primera comprobación el reloj del navegador estaba atrasado respecto al VPS y a Grafana. Si el servicio confirma envíos y Explore aparece vacío, comparar la hora de las muestras con el intervalo de la consulta. Seleccionar un intervalo absoluto que las incluya.

## Logs HTTP saneados en Loki

La fuente es una salida de Nginx dedicada al sitio HTTPS de Nodia y su API pública. El evento contiene `event`, método permitido, familia de ruta fija, estado HTTP y duración total en segundos. Loki asigna el timestamp de lectura. Los campos de los eventos no se convierten en etiquetas. Alloy sólo lee `/var/log/nodia-observability/http.log` y descarta líneas que no cumplen el formato completo. El journal y los logs crudos de Nginx y aplicaciones se consultan localmente mediante sus accesos operativos existentes.

1. Crear `/var/log/nodia-observability` con `root:root` y `0755`. Crear `http.log` con `www-data:nodia-alloy` y `0640`. Verificar lectura de este archivo como `nodia-alloy` y acceso denegado a los dos logs crudos de Nginx. La cuenta no necesita `adm` ni `systemd-journal`.
2. Instalar `nodia-http-logs.nginx.conf` como `/etc/nginx/conf.d/nodia-http-logs.conf` y `nodia-http-logs.logrotate` como `/etc/logrotate.d/nodia-observability-http`. Ejecutar `nginx -t`, validar la receta con `logrotate -d` y recargar Nginx. El sitio de la API hereda los logs a nivel HTTP. Su archivo y su hash son parte del contrato de despliegue. Validar en origen con peticiones de diagnóstico de solo lectura y valores sintéticos en las partes de la petición que se excluyen.
3. Confirmar el endpoint HTTPS de Loki y su identificador en el portal. Crear `/etc/nodia-alloy/logs.env` con `NODIA_GRAFANA_LOGS_URL` y `NODIA_GRAFANA_LOGS_USER`. Cargar una credencial del mismo stack con alcance exclusivo `logs:write` en `/etc/nodia-alloy/grafana-logs-token`. Proteger ambos archivos con `root:root` y `0600`.
4. Instalar `logs.alloy` en `/etc/nodia-alloy/conf.d/` y `alloy-logs.service.conf` en `/etc/systemd/system/alloy.service.d/nodia-telemetry-logs.conf`. El nombre hace que systemd lo lea después de `nodia-metrics.conf`, que reinicia la lista de archivos de entorno. Cargar los dos archivos de entorno para validar el directorio de configuración. Recargar systemd y reiniciar sólo Alloy para que lea la credencial nueva. El lector inicia al final del archivo si falta la posición y toma el final si detecta una posición inválida.
5. Generar nuevas peticiones de lectura y verificar en Loki `{job="nodia-http",instance="nodia-vps",environment="production"}`. Confirmar recepción de los campos permitidos y ausencia de canarios en ese flujo. Verificar también el envío de métricas después del reinicio de Alloy.

El [retiro reversible](#detener-o-revertir) permite pausar sólo Loki y conservar las métricas.

## Rotar una credencial de escritura

Crear una credencial de reemplazo en la política correspondiente. Sustituir `grafana-metrics-token` o `grafana-logs-token` de forma atómica, conservando `root:root` y `0600`. Reiniciar `alloy.service` para que systemd entregue la credencial nueva. Verificar el flujo correspondiente en Explore antes de revocar el token anterior.

## Tablero y avisos de Grafana

Importar [nodia-dashboard.json](nodia-dashboard.json) en la carpeta `Nodia Operaciones` del stack. Las reglas y el contacto por correo están registrados en el [Plan104 §14](../../../docs/mvp/104-logs-and-monitoring-grafana-cloud.md#14-g5-paneles-y-correo-comprobados--2026-11-19). Para verificar una modificación del correo, acotar una regla de prueba a una ventana temporal y comprobar en el buzón tanto `FIRING` como `RESOLVED` antes de pausar la regla de prueba.

Para un mantenimiento planificado, acotar cualquier silencio de Grafana a las alertas y el período de intervención. Mantener visible la serie en el tablero y comprobar recuperación al terminar la ventana.

## Eventos de entrega en GitHub Actions

Al finalizar el trabajo de producción, `cd.yml` de `master` activa
`Report Nodia delivery to Grafana` en `development` con el ID del CD. El
reportero verifica el origen y la conclusión del primer intento, descarta
solicitudes posteriores para el mismo ID y usa exclusivamente el artefacto
del recibo de esa ejecución.

1. En GitHub, crear el entorno `cd-observability` y limitarlo a `development`. Configurar `NODIA_CD_LOKI_URL` con la URL HTTPS de push del stack, incluido `/loki/api/v1/push`, y `NODIA_CD_LOKI_USER` con su ID de Loki.
2. Guardar como secreto del entorno `NODIA_CD_LOKI_TOKEN` una credencial dedicada a CI/CD, restringida al stack con `logs:write`. Rotar ese secreto de forma independiente al del VPS.
3. En el CD normal, revisar `Delivery reporting dispatch acknowledged` y buscar el run `Report delivery <id>`. En ese run, comprobar `Nodia CD telemetry: sent` y verificar `delivery_run_id` en Explore. El [CD 44673206896](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44673206896) y su [reportero 44673802429](https://github.com/oscarvalenzuela25/Nodia/actions/runs/44673802429) son evidencia de ese recorrido.
4. Si falta el informe, comprobar el artefacto `delivery-receipt-<id>-1` y el historial del reportero. Si el recibo está disponible y todavía no existe una solicitud de informe para el ID, se puede iniciar sólo el reportero en `development` con `cd_run_id` para recuperar el evento. `receipt_unavailable` o un artefacto ausente se investigan en GitHub Actions. `rejected` y `unavailable` registran el fallo de ingesta, sin reenvío automático.

Consulta de incidentes en Loki:

```logql
{job="nodia-cd", environment="production"}
  | json
  | event="cd_delivery"
  | outcome=~"failed|partial"
  | __error__=""
```

Usar `environment="test"` al consultar el ensayo sintético. El enlace del
evento lleva al intento de CD y `receipt_artifact` identifica el recibo. Para
retirar el flujo, quitar su secreto o deshabilitar su workflow en Actions. El
recibo de despliegue sigue disponible por su canal actual.

## Detener o revertir

**Retiro reversible de Loki.** Conservar `logs.alloy` y `nodia-telemetry-logs.conf` en un directorio de respaldo con acceso de root, fuera de `conf.d` y de los drop-ins activos. Validar las métricas, ejecutar `systemctl daemon-reload` y reiniciar sólo Alloy. Verificar un envío nuevo de métricas y que el servicio activo cargue únicamente `metrics.env`.

**Detención completa.** Ejecutar `systemctl disable --now alloy.service`. Verificar estado `inactive` y `disabled` y el cierre del listener local. Conservar `/var/lib/nodia-alloy` y las credenciales durante un retiro temporal. Para volver al diseño previo de sólo métricas, restaurar su drop-in y su archivo de configuración como par y probar un envío nuevo antes de habilitarlo al arranque.

**Restauración.** Devolver los archivos respaldados a sus ubicaciones originales, validar la configuración, recargar systemd y arrancar Alloy. Habilitar el arranque tras confirmar la recepción de los flujos restaurados. Si Loki retoma una posición conservada, puede enviar registros generados durante la pausa a partir de ese punto.

Para un retiro permanente, revocar sólo las credenciales de los flujos retirados y conservar el estado hasta decidir su retención. Si se retira también el archivo dedicado de Nginx, validar la configuración y recargar Nginx como operación aparte.
