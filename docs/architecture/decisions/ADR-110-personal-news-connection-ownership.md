# ADR-110 — Propiedad y almacenamiento de conexiones personales de Noticias

> Estado: propuesto
> Fecha: 2026-11-18

## Contexto

La entrega inicial de Noticias sirve caché RSS pública con una actualización
administrativa por fuente. El usuario aprobó implementar la vista personal del
[Plan105 §18](../../mvp/105-on-demand-tech-news.md#18-plan-de-noticias-personales).
Cada persona puede aportar su propia credencial de DEV, consultar una selección
basada en sus etiquetas seguidas y retirarla cuando quiera. Las fuentes RSS se
retiran del catálogo activo. El endpoint de lectura pública conserva la forma de
respuesta para instalaciones o pestañas con un Client anterior.

La credencial y las etiquetas devueltas por el proveedor pertenecen al usuario.
El control de acceso, el almacenamiento, el transporte y los resultados se deben
mantener dentro de esa frontera aunque otra sesión consulte el mismo proveedor
o la misma URL. daily.dev conserva su evaluación por separado.

## Opciones consideradas

### Opción A — Un catálogo y un almacén compartidos para toda Noticias

- Ventaja. Extiende las consultas y la retención del snapshot de RSS existente.
- Costos. Requiere filtrar cada acceso por propietario y por tipo de fuente. Un
  error de clasificación puede publicar resultados privados. Una credencial
  compartida tampoco puede representar las etiquetas seguidas por cada persona.

### Opción B — Token en Client y llamadas directas al proveedor

- Ventaja. Evita almacenar el token en Server para el consumo desde una pestaña.
- Costos. Aumenta la exposición de la credencial al navegador y a extensiones.
  La continuidad entre sesiones y la coordinación de cuota dependen del Client
  y de las políticas de origen del proveedor.

### Opción C — Contratos y almacenamiento por dueño en Server

- Ventaja. Aplica una frontera común de identidad, credenciales, consumo y caché
  en las operaciones privadas. Los clientes anteriores conservan su lectura.
- Costos. Requiere custodiar una llave de cifrado, migrar el almacenamiento y
  verificar concurrencia y compatibilidad entre versiones.

## Decisión

Adoptar C para el circuito personal. Los handlers autenticados derivan al dueño
de una sesión vigente y aplican la autoridad a las rutas exactas. La tabla
dedicada a Noticias vincula conexiones al dueño y al proveedor con unicidad.
Server recibe la llave `NEWS_PERSONAL_ENCRYPTION_KEY` de 32 bytes en 64
caracteres hexadecimales. Configurar la llave habilita el piloto DEV. Con la
llave ausente, el circuito de credenciales queda inhabilitado. AES-256-GCM usa
derivación específica de Noticias y vincula dueño, proveedor y versión como
datos autenticados. La API entrega estado, metadatos autorizados y máscara fija.
La llave y las credenciales se excluyen de trazas, respuestas y artefactos.

Los adaptadores tienen destinos y operaciones de lectura definidos. La carga de
la vista, las lecturas y sus filtros consultan el estado local. Probar acceso,
conectar, reconectar y actualizar requieren una acción explícita. Las reservas
en SQL coordinan el presupuesto de red sin sostener una transacción durante una
consulta remota. Al finalizar, comprobar que la sesión/autoridad de la operación
y su reserva siguen vigentes y que corresponden a la misma conexión. Reemplazar o
eliminar la conexión invalida las respuestas en vuelo. Retener sólo metadatos
autorizados y vigentes del dueño. Excluir las respuestas privadas de cachés
compartidas y de la persistencia del navegador.

El primer adaptador es DEV Community. Verifica la identidad con un PAT
personal y consulta artículos a partir de las etiquetas seguidas. El único
alcance aprobado para daily.dev es un piloto local de un dueño, con
`NODE_ENV=development`, `NEWS_DAILY_DEV_LOCAL_OWNER_ID` igual al actor y la
llave de cifrado válida. Una acción explícita lee una página de `For You` en
una vista privada dedicada a esa fuente. Se retienen metadatos mínimos durante
un máximo lógico de 60 minutos. La propuesta para distribución y múltiples cuentas requiere
resolver condiciones y validar OAuth por separado. [Forem v1](https://developers.forem.com/api/v1),
[Plan105 §18.8](../../mvp/105-on-demand-tech-news.md#188-piloto-personal-local-de-dailydev),
[sección 18](https://daily.dev/tos/#public-api), [OAuth](https://docs.daily.dev/oauth-apps/).

En la ruta pública se conserva una respuesta vacía válida y la capa histórica
queda fuera del catálogo activo. Mantener el ledger histórico inmutable y
entregar el esquema aditivo antes de publicar el Client que usa el nuevo
contrato. El despliegue sigue las garantías de recuperación por fase de CD.

## Consecuencias

- La navegación pública conserva su destino canónico y el contrato privado
  aplica propiedad por usuario incluso si ambas capas usan el mismo editor.
- Un fallo de transporte, cuota o verificación requiere un estado explícito.
  Un error temporal puede conservar resultados vigentes de la misma conexión.
  Desconectar elimina la credencial y la caché activa de Nodia. Revocar el token
  en el proveedor es una operación de la cuenta del proveedor.
- La migración añade obligaciones de validación limpia y poblada, replay del
  actualizador aislado, recuperación antes de migrar y comprobación después de
  publicar. La lectura autenticada con una cuenta real de DEV requiere su propia
  evidencia. Este ADR conserva su estado propuesto hasta revisión documental.

## Referencias

- [Plan105 §18](../../mvp/105-on-demand-tech-news.md#18-plan-de-noticias-personales),
  [catálogo](../../features/news/source-catalog.md) y [contrato HTTP](../../features/news/http-contract.md).
- [ADR105](ADR-105-public-news-and-source-access-tiers.md) conserva la decisión de
  la capa RSS inicial. [ADR092](ADR-092-stable-module-navigation-routes.md) y
  [autoridad89](../../mvp/89-module-access-and-user-data-scope.md) definen el
  destino canónico y la separación de autoridad.
- [ADR109](ADR-109-phase-aware-production-deploy-recovery.md) y
  [guía de entrega](../../features/news/deployment-readiness.md).
