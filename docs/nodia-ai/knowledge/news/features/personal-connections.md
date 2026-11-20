---
{
  "schema_version": 1,
  "document_id": "news.personal-connections",
  "product_id": "news",
  "kind": "feature",
  "revision": 5,
  "document_status": "draft",
  "implementation": {
    "status": "implemented",
    "notes": "Client requiere sesión validada para Noticias. DEV y el piloto de daily.dev conservan la propiedad de cada conexión y sus comprobaciones por alcance."
  },
  "integration_status": "unregistered",
  "maintainer": "Nodia",
  "sources": [
    {
      "path": "docs/mvp/105-on-demand-tech-news.md",
      "kind": "specification"
    },
    {
      "path": "docs/features/news/http-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/architecture/decisions/ADR-110-personal-news-connection-ownership.md",
      "kind": "specification"
    }
  ],
  "verification": {
    "checked_on": "2026-11-18",
    "evidence_paths": ["docs/mvp/105-on-demand-tech-news.md"],
    "notes": "Plan105 §§18.5 y 18.8 registran Chromium, HTTP, PostgreSQL, migraciones y recuperación aislada. El piloto local está en ledger 60. La lectura real de daily.dev y la adopción por entorno quedan pendientes."
  },
  "approval": null
}
---

# Conexiones personales de Noticias — contexto funcional para NodiaAI

## Qué resuelve y qué significa

El circuito personal permite a cada persona conectar DEV desde Noticias y
actualizar su propia selección basada en etiquetas seguidas. El usuario aprobó
implementar el piloto de [Plan105 §18](../../../../mvp/105-on-demand-tech-news.md#18-plan-de-noticias-personales).
La conexión se ofrece con Server configurado. El piloto de daily.dev añade
una lectura breve de `For You` para un único dueño autorizado en desarrollo.
El [alcance local](../../../../mvp/105-on-demand-tech-news.md#188-piloto-personal-local-de-dailydev)
separa la aprobación de implementar, la comprobación con cuenta real y la
evaluación de condiciones y OAuth para uso distribuido.

## Solicitudes en lenguaje natural

| Solicitud ilustrativa | Intención | Tratamiento esperado |
| --- | --- | --- |
| «Quiero conectar DEV» | Crear conexión personal | Explicar el formulario de Noticias para el piloto habilitado y distinguir habilitación de acceso comprobado |
| «Quiero mi For You de daily.dev» | Consultar lectura personal | Explicar el piloto local de un dueño y el acceso desde el panel de daily.dev si está habilitado |
| «¿Mis noticias vienen de mis intereses?» | Entender procedencia | Aclarar cuál fuente usa y explicar etiquetas seguidas de DEV o `For You` de daily.dev según corresponda |
| «¿Te puedo pasar mi clave aquí?» | Configurar credencial | Remitir al formulario protegido de la vista autenticada de Noticias y mantener el secreto fuera del chat |
| «¿Puedo ver Noticias sin iniciar sesión?» | Acceder a la vista | Explicar que la vista requiere una sesión de Nodia y que la fuente se conecta con la credencial propia |
| «Quiero leer las noticias de otra cuenta» | Acceso a datos personales | Explicar que cada cuenta consulta sus propias conexiones |

## Operaciones y contratos

| Operación personal de la aplicación | Efecto | Autoridad | Resultado |
| --- | --- | --- | --- |
| Consultar conexiones y artículos | Lectura local | Dueño por sesión válida | Estado, máscara y metadatos disponibles |
| Conectar, probar o reconectar | Prueba de acceso con consumo posible de cuota y guardado validado al conectar o reemplazar | Dueño, acción explícita | Estado de acceso y, si aplica, versión de conexión nueva |
| Actualizar una fuente | Consulta externa explícita con consumo posible de cuota | Dueño de la conexión | Resultado propio, último éxito y estado de cuota cuando se conoce |
| Desconectar | Retirar credencial y caché local asociada | Dueño, confirmación explícita | Conexión retirada de Nodia y acceso local invalidado |

Las rutas y las operaciones externas se especifican en el
[contrato HTTP](../../../../features/news/http-contract.md#operaciones-personales).
El acceso corresponde a la interfaz autenticada de Noticias.

## Datos mínimos y resolución de dudas

| Dato | Cuándo se utiliza | Origen |
| --- | --- | --- |
| Dueño | Todas las operaciones privadas | Sesión vigente verificada por Server |
| Proveedor | Una conexión y una acción cada vez | Selección de la persona dentro del catálogo habilitado |
| Credencial | Alta o reemplazo por PAT. Persistida cifrada en Server | Formulario seguro. El cliente sólo recibe máscara y estado |
| Título, URL, procedencia, fecha de publicación | Lectura si el proveedor aporta metadatos permitidos | Respuesta validada del proveedor. Fecha ausente representada como `null` |
| Portada opcional | Vista de un artículo con imagen válida | `cover_image` de DEV, servido como `cover_image_url` del CDN permitido. Las tarjetas sin portada usan un icono |
| Etiquetas opcionales | Filtro de tema o etiqueta sobre la lectura cargada | `tag_list` o `tags` de Forem. Las agrupaciones se basan en etiquetas comprobadas |

## Reglas, acceso y restricciones

La entrada canónica `/news` requiere sesión validada con identidad. Una
persona autenticada puede entrar con cero conexiones para dar de alta su
propia API key o PAT. [Plan105 §19](../../../../mvp/105-on-demand-tech-news.md#19-noticias-con-sesión-y-ajuste-de-inicio--2026-11-19).

La propiedad y la caché de la vista personal se comprueban por usuario y
conexión. La sesión determina identidad en Server. Sólo el dueño puede probar,
actualizar, reemplazar o desconectar su fuente. El cierre de sesión descarta
estado privado en Client. El [GET histórico](on-demand-reading.md) conserva
una lista vacía de compatibilidad. La
[decisión de almacenamiento y autoridad](../../../../architecture/decisions/ADR-110-personal-news-connection-ownership.md)
delimita el cifrado, la propiedad y la caché de la conexión. El piloto daily.dev
sólo se habilita para el dueño configurado localmente en desarrollo y conserva
su proyección privada por separado.

## Filtros e informes

La primera entrega permite filtrar la lectura local por fuente. Cada tarjeta
identifica procedencia y distingue la fecha del artículo de la última
actualización. El alcance de consulta pertenece a la cuenta autenticada.
daily.dev usa una vista por fuente con una sola página y vigencia de hasta 60
minutos. Sus artículos se leen con el filtro de su proveedor. El filtro de
tema local se ofrece si los resultados incluyen etiquetas.
Los paneles **Tus fuentes** y **Tu lectura** se pliegan de forma independiente.
El filtro aplicado se conserva al reabrirlos y el gesto no consulta al proveedor.
Cada tarjeta enlaza al artículo original desde toda su superficie. El filtro
de tema ofrece agrupaciones y etiquetas de la fuente seleccionada. La lectura
guardada de DEV sin etiquetas conserva sus artículos visibles y ofrece
**Actualizar DEV** para incorporar las etiquetas disponibles.

## Vista previa, confirmación y recuperación

El formulario valida y conserva el borrador al fallar. **Desconectar** muestra
una confirmación con la fuente y el efecto sobre sus resultados. La reserva y
la versión de credencial deben impedir que una respuesta tardía repueble la
caché retirada. Los fallos temporales conservan resultados vigentes y muestran
su última actualización. Una credencial inválida requiere reconexión.

## Integración y evidencia

- [x] Alcance de implementación, fuentes y límites documentados.
- [x] Contratos HTTP, acceso de dueño, cifrado y recuperación verificados en laboratorio. [Resultados](../../../../mvp/105-on-demand-tech-news.md#185-implementación-y-verificación-local).
- [x] Aislamiento de daily.dev, upgrade 59→60 y recuperación ante respaldo incierto verificados en laboratorio. [Resultados](../../../../mvp/105-on-demand-tech-news.md#verificación-local-del-piloto).
- [ ] Acceso y lectura real verificados por proveedor y entorno.
- [ ] CI/CD y adopción comprobados por SHA y esquema.

El alcance corresponde al producto Noticias. Ficha candidata fuera
del registro de publicación de NodiaAI.

## Evolución y compatibilidad

| Revisión | Cambio y fuente | Contexto | Compatibilidad |
| --- | --- | --- | --- |
| 1 | Propuesta de conexión personal y actualización por fuente, Plan105 §18 | Nueva ficha `planned`, con pruebas y condiciones pendientes | Operaciones privadas aditivas propuestas y contrato RSS público conservado |
| 2 | Alcance aprobado para implementación, Plan105 §18 y ADR110 propuesto | Piloto local DEV, daily.dev pendiente y validación por separado | Contrato privado por dueño y compatibilidad vacía para el GET público |
| 3 | Implementación local y evidencia, Plan105 §18.5 | Ensayos UI, HTTP, esquema y recuperación aislados. Autenticación DEV real pendiente | Migración aditiva y POST público histórico de fuente retirada |
| 4 | Piloto local limitado de daily.dev, Plan105 §18.8 | Implementado para un dueño en desarrollo, con UI y HTTP aislados comprobados. PAT real y OAuth por separado | Snapshot y lectura privada de daily.dev aislados de DEV y del catálogo público |
| 5 | Client autenticado para Noticias, Plan105 §19 | Menú y entrada canónica bajo sesión validada y configuración por dueño | Se conserva el contrato privado y el GET histórico vacío |
