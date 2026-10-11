# Stack DevOps — Nodia Parte 1

> Estado: en revisión — ampliación IA y cambio de despliegue 2026-09-25; aprobación histórica del MVP conservada
> Última actualización: 2026-10-10
> Dependencias: 08-stack-frontend.md y 09-stack-backend.md aprobados

## Objetivo

Definir la estructura del repositorio, la infraestructura de despliegue, y las herramientas de integración y entrega continua (CI/CD) para el MVP de Nodia.

## 1. Estructura del Repositorio

- **Estrategia:** Monorepo (repositorio único).
- **Justificación:** Mantiene todo el código relacionado de la Parte 1 centralizado.
- **Estructura base:**
  ```text
  Nodia/
  ├── nodia-client/   # Frontend (React + Vite)
  ├── nodia-server/   # Backend (NestJS)
  ├── nodia-gemini-microservice/ # Adaptador privado Gemini Web/Agentic
  ├── docs/          # Producto, arquitectura y evidencia de QA
  ├── AGENTS.md      # Reglas generales
  ├── .editorconfig  # Configuración compartida del editor
  ├── .gitattributes # Normalización Git
  ├── .gitignore     # Exclusiones compartidas
  └── README.md      # Entrada al repositorio
  ```
- **Ejecución independiente (2026-10-10):** el usuario inicia cada aplicación desde su carpeta. Los manifiestos y lockfiles Node pertenecen a Client/Server; Gemini mantiene `requirements.txt` y `.venv`. Retirado el `package.json` raíz, que solo delegaba comandos del cliente y no tenía dependencias, workspaces ni hooks. Comandos vigentes en el [README raíz](../../README.md).
- **Archivos compartidos:** documentación y reglas permanecen fuera de las aplicaciones. Evidencia versionada en `docs/evidence/`, con referencias actualizadas; `output/` queda reservado para resultados temporales ignorados. Logs de QA antiguos de la raíz archivados en almacenamiento local fuera del repositorio.
- **Despliegues aislados:** Aunque comparten repositorio, el frontend y el backend se desplegarán de forma independiente basados en los cambios de sus respectivas carpetas.

## 2. Infraestructura y Hosting

### Frontend
- **Proveedor:** **Cloudflare Pages**.
- **Justificación:** Excelente capa gratuita para MVPs, distribución global (CDN rápida), integraciones nativas con repositorios y tiempos de compilación muy rápidos para proyectos Vite/React.

### Backend y Base de Datos
- **API NestJS y microservicio Gemini:** VPS gestionado por el proyecto. La elección del VPS responde también al objetivo de aprender su operación.
- **Proveedor elegido (2026-10-10):** Truobox, por confirmación explícita del usuario. Plan, región, arquitectura efectiva y contratación siguen sin comprobarse. Las comparaciones anteriores se conservan como historial.
- **PostgreSQL:** servicio gestionado externo, pendiente de escoger entre Neon y Northflank.
- **Redis:** servicio gestionado externo; proveedor y parámetros operativos pendientes.
- **Archivos de facturas:** Cloudflare R2, sin cambio.
- **Diseño operativo detallado:** proxy/TLS, red privada entre NestJS y microservicio, backups, despliegue y recuperación pendientes en [la especificación IA](16-ai-provider-management-handoff.md).
- **Límite de acceso Gemini:** [ADR-007](../architecture/decisions/ADR-007-gemini-internal-access.md) fija que solo NestJS consume directamente FastAPI. El navegador y Postman usan Nodia Server. La topología concreta depende de si NestJS corre en el host o en Docker.
- **Microservicios futuros:** [ADR-008](../architecture/decisions/ADR-008-internal-microservices-only.md) extiende la misma frontera de acceso a cada servicio nuevo. Seguir la [guía de incorporación y seguridad](../architecture/internal-microservice-security.md), con token distinto por servicio y entorno, pruebas negativas y verificación externa del despliegue.

## 3. Contenedores (Docker)

- **Decisión actual:** el microservicio Gemini se ejecutará en Docker en el VPS con volumen persistente para perfil de navegador y sesión. La forma de ejecutar NestJS en el VPS se definirá en el plan operativo.
- **Decisión histórica:** Docker se había excluido en la Parte 1, antes de incorporar el microservicio con sesión web.
- **Configuración local actual:** Compose publica FastAPI solo en `127.0.0.1:8000` y exige un token de servicio compartido. Si NestJS pasa a Docker, se debe retirar `ports` y conectar ambos servicios a una red dedicada. La verificación de firewall y puertos desde Internet sigue pendiente.

## 4. Integración y Entrega Continua (CI/CD)

### GitHub Actions (Automatización de Despliegues)
- Cloudflare Pages mantiene el despliegue del frontend. La entrega de NestJS y microservicio al VPS queda pendiente de diseñar (pipeline, despliegue seguro y rollback).

### Pre-commit Hooks (Calidad Local)
- **Herramienta:** `Husky` + `lint-staged`.
- **Estado comprobado 2026-10-10:** son herramientas previstas; los manifiestos y archivos versionados actuales no incluyen su instalación/configuración. El manifiesto raíz retirado tampoco las configuraba. Implementación de hooks pendiente.
- **Estrategia:** El linting, formateo de código (Prettier/ESLint) y la ejecución de tests unitarios básicos se forzarán en local antes de permitir un commit. Así se asegura que el código que sube al repositorio ya cumple los estándares, evitando gastar minutos de CI en GitHub Actions por errores de sintaxis.

## Hechos confirmados

- Monorepo con carpetas separadas para frontend, backend y microservicio Gemini.
- Frontend alojado en Cloudflare Pages.
- NestJS y microservicio Gemini en VPS.
- PostgreSQL gestionado externamente (Neon o Northflank por decidir); Redis gestionado externamente.
- Despliegue automático del frontend; pipeline hacia VPS pendiente de especificar.
- Control de calidad local (lint/test) mediante pre-commit hooks (Husky).
- Docker para microservicio y volumen de sesión; ejecución de NestJS por definir.

## Preguntas abiertas

### Sistema operativo para Truobox — 2026-10-10

- **Confirmado:** el usuario elige Truobox y solicita comparar las imágenes de sistema operativo y apps preinstaladas. Esto no confirma una compra ni aprueba una nueva topología.
- **Recomendación pendiente de elección:** Sistema Operativo → Ubuntu-24, comprobando que corresponda a **Ubuntu Server 24.04 LTS amd64/x86-64**, sin escritorio ni panel preinstalado. Coincide con la base propuesta de la guía de ensayo; el CLI del Dockerfile actual se instala para `linux_amd64`. Compatibilidad documental no equivale a ejecución verificada en el VPS.
- **Soporte comprobado:** [Canonical](https://ubuntu.com/about/release-cycle) publica mantenimiento estándar de 24.04 LTS hasta mayo de 2029 y de 26.04 LTS hasta mayo de 2031. [Docker Engine](https://docs.docker.com/engine/install/ubuntu/) admite ambas. Ubuntu 26.04 LTS es una alternativa válida, que requiere revisar y verificar la guía en ese host; no se descarta por ser inestable. No elegir solo por una etiqueta anual: Ubuntu 25.10 terminó su soporte el [9 de julio de 2026](https://lists.ubuntu.com/archives/ubuntu-announce/2026-July/000325.html); las versiones intermedias no son la recomendación para este ensayo.
- **Apps preinstaladas:** Coolify sería la alternativa si se elige administrar despliegues desde un panel, con adaptación explícita de API/systemd, proxy/TLS, redes privadas y persistencia. [Coolify](https://coolify.io/docs/start-with-self-hosted) requiere sus propios recursos y mantenimiento; su mínimo de 2 GB no estima el consumo adicional real ni dimensiona Nodia. Easypanel y Portainer también añaden una capa de administración. CyberPanel y las imágenes de aplicaciones especializadas no aportan una necesidad identificada del despliegue actual; Supabase completo añadiría servicios a PostgreSQL y a los contratos de autenticación/archivos ya existentes.
- **Pendiente:** confirmar imagen exacta 24.04 LTS y x86-64 en el configurador; si se elige otra base/panel, reconciliar la guía antes de desplegar. No se instalaron servicios, adquirió un VPS ni se aprobaron documentos automáticamente.

### Ensayo de despliegue con BD local al VPS — 2026-10-10

- Usuario elige PostgreSQL y Redis en el mismo VPS **para esta prueba**. Se propone Ubuntu 24.04 x86-64, API en host con systemd, infraestructura/Gemini Docker con puertos loopback, Nginx HTTPS y frontend Pages. [Guía de primera instalación](vps-first-test-deployment.md). No se ha contratado/inspeccionado un VPS ni probado esta operación; la decisión productiva de datos gestionados permanece pendiente de revisión explícita si se desea cambiar.
- API DNS-only propuesto para el ensayo de análisis largos: el timeout CDN publicado puede ser menor al plazo de inferencia. Validar IP efectiva, proxy, firewall, cuotas y autenticación en el destino. Dependencias de runtime y otros controles de lanzamiento de19 siguen pendientes; el bootstrap de BD vacía ya está verificado localmente.

### Evaluación de VPS inicial — 2026-10-10

- **Confirmado por el usuario:** presupuesto aproximado de hasta US$12 mensuales para el VPS de Nodia Server y Gemini; frontend en Cloudflare y archivos en R2. No se ha elegido ni contratado proveedor.
- **Hechos del repositorio:** el Dockerfile de Gemini incluye Playwright y un instalador del CLI para `linux_amd64`; Compose limita ese contenedor a 2 GB de RAM y dos CPU. Estos límites no son mediciones de consumo ni prueban capacidad de producción. `ANALYSIS_SLOTS=2` es la configuración de ejemplo actual.
- **Recomendación técnica provisional:** VPS Linux x86-64, preferentemente 8 GB de RAM y cuatro vCPU compartidas; 4 GB y dos vCPU como alternativa ajustada para carga baja, pendiente de medir memoria, CPU y concurrencia. Empezar con un análisis simultáneo y calibrar mediante pruebas; construir imágenes fuera del VPS.
- **Oferta publicada consultada:** [OVHcloud VPS-2, gama comercial 2027](https://www.ovhcloud.com/en/vps/) anuncia cuatro vCores, 8 GB RAM, 75 GB NVMe, IPv4 y respaldo diario incluidos, desde US$8,50/mes. VPS-1 anuncia dos vCores, 4 GB y 40 GB desde US$4,54/mes. Son precios de entrada publicados, no una cotización final: confirmar país de contratación, disponibilidad del datacenter, plazo/pago anticipado, renovación e impuestos en el configurador antes de comprar.
- **Alternativas consultadas:** [Netcup](https://www.netcup.com/en/server/vps) publica VPS 500 G12.5 con dos vCore, 4 GB y 64 GB SSD desde €8,26/mes para contrato de doce meses; [Hetzner](https://www.hetzner.com/cloud/) muestra la categoría económica como no disponible en la página consultada, por lo que no se asume que sus tarifas históricas permitan contratar una instancia ahora.
- **Topología propuesta, sin sustituir decisiones vigentes:** PostgreSQL y Redis siguen gestionados externamente. Priorizar cercanía entre VPS y esos servicios, y comprobar latencia desde Chile. NestJS y Gemini pueden compartir VPS mediante Docker Compose y proxy HTTPS; Gemini permanece en red privada, sin puerto público, con token exclusivo y volúmenes persistentes de sesión.
- **Pendiente operativo:** verificar Linux/VPS con login e inferencia reales, respuestas inválidas/servicio caído, consumo bajo concurrencia y restauración de respaldos cifrados de sesión. No se ejecutaron benchmarks, despliegues ni compras durante esta evaluación. La recomendación no constituye aprobación documental ni disponibilidad comprobada del adaptador IA.

### Alternativa con datos en el VPS y ubicación LATAM — 2026-10-10

- **Solicitud del usuario:** ampliar opciones a Latinoamérica y evaluar un presupuesto conjunto aproximado de $15.000 CLP para backend y base de datos. Preguntar por esta alternativa no aprueba reemplazar PostgreSQL/Redis gestionados.
- **Viabilidad técnica e inferencia:** PostgreSQL y Redis pueden ejecutarse en el mismo VPS que NestJS y Gemini, sin contratar motores externos. Para este conjunto se recomiendan al menos 8 GB de RAM; 4 GB queda como alternativa ajustada, sin capacidad demostrada. Concurrencia IA inicial de una operación, límites de memoria por servicio, volúmenes persistentes, conexiones PostgreSQL acotadas y red privada sin publicar 5432/6379/8000. El Compose local actual no es una configuración de producción.
- **Costo y responsabilidad:** el ahorro de servicios gestionados transfiere al proyecto parches, monitoreo, backups, restauración y recuperación del host. Un fallo del VPS afecta API y datos simultáneamente. Copias cifradas externas de PostgreSQL y sesiones, con restauración probada; para menor pérdida de datos, evaluar WAL/PITR. Un respaldo diario por sí solo permite perder hasta el intervalo entre copias.
- **Conversión referencial consultada:** [Banco Central](https://www.bcentral.cl/inicio), dólar observado $981,61 CLP al consultar el 2026-10-10; no equivale al tipo de cambio final de la tarjeta. Los cálculos internacionales siguientes excluyen impuestos y comisiones; añadir un margen ilustrativo del 19% no determina la obligación tributaria del comprador.
- **Brasil, [Hostinger](https://www.hostinger.com/vps/servers/brazil):** KVM 2, dos vCPU/8 GB/100 GB NVMe, US$8,99/mes equivalentes ($8.825 CLP); renovación US$14,99 ($14.714 antes de impuestos). KVM 4, cuatro vCPU/16 GB/200 GB NVMe, US$12,99 ($12.751); renovación US$28,99. La página indica pago anticipado, no cobro mensual a esas tarifas; verificar plazo, disponibilidad de Brasil, total inicial e impuestos en checkout.
- **Chile, [OpenCloud](https://www.opencloud.cl/vps/precios/):** plan estándar dos vCPU/4 GB/80 GB SSD a $12.000 + IVA ($14.280 con 19%); cuatro vCPU/8 GB/160 GB a $25.000 + IVA ($29.750). La oferta de 4 GB cabe nominalmente, pero deja escaso margen para Gemini/BD y respaldos. El proveedor indica datacenters en Chile.
- **Chile, [RDSNode](https://rdsnode.com/):** la portada publica Performance VPS con dos vCores/8 GB/80 GB NVMe desde $22.253/mes; impuestos/condiciones y disponibilidad requieren confirmar. Supera el presupuesto anunciado.
- **Alternativas fuera de LATAM:** OVHcloud VPS-2 ya registrado arriba, desde US$8,50 (aprox. $8.344 antes de impuestos). [Truobox](https://www.truobox.com/chile/vps-barato/) publica Pro M cuatro vCPU/8 GB/120 GB desde $6.394 equivalentes para tres años; informa explícitamente VPS en Virginia/Montreal, no en Chile. No asumir pago mensual ni ubicación chilena por el nombre de la página.
- **Presupuesto propuesto, condicionado a promoción/checkout:** Hostinger KVM 2 Brasil + los cuatro servicios en el mismo VPS: $8.825 equivalentes, $1.677 de margen ilustrativo de 19%, hasta $1.000 de reserva para R2 y $2.000 de contingencia = aprox. $13.500 mensuales equivalentes. La reserva de R2 no es una tarifa fija: [R2 Standard](https://developers.cloudflare.com/r2/pricing/) ofrece 10 GB-mes, un millón de operaciones A y diez millones B gratis; excedentes de almacenamiento a US$0,015/GB-mes. Archivos y backups comparten consumo. La renovación de KVM 2 supera $15.000 al aplicar ese margen y reservas. Se excluyen dominio y consumo/suscripciones IA.
- **Pendientes:** proveedor, región física, facturación mensual frente a anticipo, aceptación de riesgo de un solo host y política de recuperación. Si se elige alojar datos en VPS, crear ADR y reconciliar 10/11/15/16/18 y rate limiting antes de desplegar; las decisiones actuales de datos gestionados se conservan. No hubo compras, cambios de runtime/BD ni pruebas de rendimiento.

### Comparación de tarifas de 8 GB — 2026-10-10

- **Requisito geográfico confirmado por el usuario:** el servidor debe estar físicamente en América; una empresa europea sirve si ofrece servidores en Estados Unidos. La sede del proveedor no determina la ubicación de la instancia. Excluir de la selección actual Netcup Lite con asignación europea. Mantener USA como ubicación aceptada explícitamente y Brasil como alternativa previamente solicitada.
- **Aclaración de Contabo:** [regiones oficiales USA](https://contabo.com/en-us/locations/united-states/) incluyen US East (Carlstadt, New Jersey), Central (St. Louis) y West (área de Seattle). [Documentación de ubicación/recargos](https://contabo.com/blog/contabo-eu-data-centers-latency-gdpr/) indica cargo mensual adicional para esas regiones, sin cuantía comprobada en esta evaluación. Las tarifas base de US$6,60/US$9 no demuestran el total en USA; comparar precio final de un mes, alta, impuestos y región contra OVH. No se certifica latencia desde Chile ni disponibilidad actual de una combinación concreta.
- **Dato comunicado por el usuario:** OVHcloud muestra US$10/mes para la contratación que está evaluando; usar ese importe como referencia para su comparación, sin confundirlo con el precio promocional publicado desde US$8,50. No se verificó su checkout ni se contrató.
- [Contabo](https://contabo.com/en-us/upsell-vps-4-6/) publica Cloud VPS 4 con cuatro vCPU/8 GB/100 GB SSD, tarifa base US$6,60 y promoción US$5,28 para los primeros 24 meses. Cloud VPS 6 publica seis vCPU/12 GB/200 GB SSD, base US$9 y promoción US$7,20 bajo ese plazo. El contenido indexado oficial permite comparar anuncios; checkout de un mes, alta, región, impuestos, disco alternativo y total final siguen pendientes. La apertura directa fue bloqueada por 403; no se certifica disponibilidad de contratación.
- [Netcup VPS Lite 2 G12.5s](https://www.netcup.com/en/server/vps/vps-lite-2-g12.5s-iv-3m): cuatro vCore/8 GB/160 GB SSD, €9,50 publicados con IVA alemán, período mínimo y facturación de tres meses; ubicación automática en Europa. No usar la tarifa indexada de la generación G12s (€7,92/mes) como cotización de G12.5s. Impuestos por país y checkout pendientes.
- [RackNerd Specials](https://www.racknerd.com/specials/): siete vCPU/8 GB/150 GB SSD, US$119,99 por año (equivalente a US$10/mes), con selección entre varias ubicaciones. Es prepago anual y no supone ahorro frente a US$10 mensuales de OVH. CPU compartida y rendimiento real pendientes de probar; no inferir superioridad por número de vCPU.
- Hostinger KVM 2 y Truobox Pro M conservan los precios/condiciones registrados arriba: anticipo/promoción y renovación en Hostinger; equivalente trienal y ubicación Virginia/Montreal en Truobox. No se obtuvo precio mensual verificable del carrito de Truobox.
- [IONOS VPS L+](https://www.ionos.com/servers/vps) publica cuatro vCore/8 GB/240 GB NVMe a US$8 durante tres meses con contrato anual, y US$25 como precio normal. No se recomienda ese descuento como solución sostenida al presupuesto.
- Recomendación provisional: Contabo como candidato para reducir gasto, condicionado al total de un mes y prueba de Nodia; OVH a US$10 sigue como referencia comparativa. No hay benchmarks comparativos, SLA operativo demostrado ni elección aprobada. Sin compras/cambios de infraestructura.

### Finalistas: OVHcloud, Contabo y Truobox — 2026-10-10

- **Selección para comparar, no contratación:** el usuario restringe los candidatos a OVHcloud, Contabo y Truobox, con instancia en América/USA. Informa precio de Truobox de $7.700 CLP por mes; se conserva como dato comunicado, sin verificar su checkout ni impuestos/complementos. OVH mantiene la referencia comunicada de US$10 por mes; el total mensual de Contabo USA sigue pendiente.
- **Recursos publicados de planes equivalentes de 8 GB:** [OVH VPS-2](https://www.ovhcloud.com/en/vps/) tiene cuatro vCores, 75 GB NVMe, red pública de 1 Gbps, tráfico ilimitado y respaldo diario de las últimas 24 horas. [Contabo Core Cloud VPS 4](https://docs.contabo.com/docs/servers-hosting/vps/) tiene cuatro vCPU compartidas, 100 GB SSD, puerto de 200 Mbps, tráfico sujeto a uso justo, un snapshot y backup automático como complemento. [Truobox Pro M](https://www.truobox.com/chile/vps-barato/) tiene cuatro vCPU compartidas, 120 GB NVMe, red anunciada de hasta 10 Gbps de entrada/500 Mbps de salida, tráfico ilimitado y respaldo diario opcional desde US$2,95/mes. Son especificaciones anunciadas, no rendimiento garantizado ni probado por el proyecto.
- **Diferencias relevantes:** RAM y número nominal de CPU empatan; no se ha verificado el modelo efectivo de CPU ni rendimiento por núcleo. Truobox ofrece 60% más capacidad de disco que OVH, pero NVMe/capacidad no acreditan IOPS sostenidos ni latencia de PostgreSQL. OVH tiene mayor ancho de banda anunciado de salida y respaldo diario incluido; el snapshot manual de Contabo no equivale a backup automático externo.
- **Benchmark del proveedor, con límites:** el [artículo de Truobox](https://www.truobox.com/blog/vps-truobox-vs-ovh-contabo-benchmark/) publica la mejor de dos corridas YABS, compara con mediciones externas en otros hosts/momentos y usa Contabo Cloud VPS 10, distinto del Cloud VPS 4 evaluado. Declara caché de lectura y posible reducción de red por saturación sostenida. No usar sus cifras como comparación controlada de estos tres planes ni como garantía de operación de Nodia; CPU, escrituras durables, CPU steal, red Chile y estabilidad requieren prueba real.
- **Recomendación provisional:** Truobox Pro M es candidato preferido por capacidad NVMe/precio frente a OVH si los $7.700 corresponden a cobro mensual final y se puede seleccionar Virginia. OVH queda como alternativa con respaldo automático incluido y mayor ancho de banda de salida publicado. Contabo Core 4 debe compararse con precio final USA; Core 6 ofrece seis vCPU/12 GB/200 GB SSD/300 Mbps, y ganaría capacidad nominal de CPU/RAM si cabe en el presupuesto, sin acreditar mayor rendimiento. No se declara ganador de estabilidad ni de CPU sin pruebas.
- **Aplicación a Nodia:** los tres planes de 8 GB son candidatos iniciales para Server/Gemini y la alternativa aún no aprobada de PostgreSQL/Redis en el mismo host. Empezar con una operación IA concurrente, imágenes construidas fuera del VPS, límites por contenedor y backups externos restaurables. El Compose de Gemini fija 2 GB/dos CPU; es un límite, no una medición de consumo. No hubo compras, despliegues, benchmarks, cambios de BD ni aprobación automática de topología.

### Seguridad del despliegue Gemini — 2026-09-28

Seguir el [runbook de despliegue seguro](18-security-deployment-runbook.md) antes de usar credenciales reales en el VPS. Incluye la migración de API keys, prueba negativa de acceso directo y reversión. El cliente ya no llama `localhost:8000` para iniciar sesión. En desarrollo local, Settings inicia el trabajo a través de NestJS y Chrome aparece en el host Python; en el VPS queda pendiente un visor remoto privado y su prueba con la cuenta real.

### Requisitos de despliegue del rate limit — 2026-09-12

La implementación de [ADR-003](../architecture/decisions/ADR-003-api-rate-limiting.md) usa Redis compartido en entornos desplegados. Sigue pendiente confirmar/provisionar un servicio gestionado externo, sus permisos de scripts y su política de memoria/evicción. No se ha desplegado ni contratado infraestructura como parte de esta entrega.

Configurar conexión Redis, prefijo por entorno y `TRUST_PROXY` con los IPs/CIDRs reales del ingreso. Su valor vacío confía solo en la conexión directa. Verificar identificación del cliente a través de la ruta pública y calibrar cuotas en staging. Una caída de Redis produce `503` en endpoints protegidos; memoria se admite exclusivamente en desarrollo/test.

Tras integrar auth, configurar también `RATE_LIMIT_LOGIN_*`, `RATE_LIMIT_USER_*` y `RATE_LIMIT_USER_WRITES_*` de forma uniforme entre réplicas. Defaults: login 10 intentos/minuto por IP; usuario verificado 300 solicitudes/minuto y 30 escrituras/minuto, adicionales a los límites por IP existentes. TTL y bloqueo se expresan en milisegundos. No requiere migración de base de datos ni nuevas dependencias; las claves de estas políticas son independientes de las cuotas por IP.

### Decisiones originales del MVP

- Ninguna. Documento listo para revisión.

## Operación auth — 2026-09-12

Se requieren `GOOGLE_CLIENT_ID`, `AUTH_JWT_SECRET`, `AUTH_ALLOWED_ORIGINS` y configuración SameSite/Secure. CORS usa orígenes concretos con credenciales. Producción requiere HTTPS y migración de auth sobre el esquema existente; `synchronize` se desactiva en producción. Preferir frontend/API bajo el mismo sitio para evitar cookies de terceros. Ver [14-authentication.md](14-authentication.md).
