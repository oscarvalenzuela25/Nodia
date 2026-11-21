# ADR-114 — Copias de estudio de Teacher sin conexión

> Estado: propuesto
> Fecha: 2026-11-21

## Contexto

Teacher genera material privado y versionado para el titular de un plan.
PWA-005 requiere abrir una copia de lectura aunque el navegador se cierre y
vuelva a abrir sin red. El service worker ya gestiona versiones, navegación
y Web Push. La autenticación online distingue un JWT persistido de una
sesión comprobada por el servidor.

## Opciones consideradas

- Exportar un archivo de libre acceso al sistema. Facilita leer sin navegador,
  pero el archivo persiste fuera de la cuenta y del cierre de sesión.
- Cachear la respuesta del API. Su cuerpo incluye operaciones e interacciones
  y la caché común no ofrece una frontera de cuenta para ese material.
- Guardar una copia cifrada y acotada dentro de una biblioteca local de Teacher.

## Decisión

Usar la lectura autorizada del material vigente de una unidad al pulsar
**Descargar para leer sin conexión**. Comparar la identidad de la unidad,
revisión y versión que la persona está leyendo. Guardar sólo el título y los
bloques de explicación, ejemplos y resumen. Admitir bloques de lectura
históricos sin tipo. Las evaluaciones, interacciones, archivos originales y
acciones de Teacher siguen en sus flujos online.

Cada copia vence a las 24 horas. Se admiten hasta diez copias de 256 KiB por
cuenta y sesión en el navegador. Una descarga posterior reemplaza la copia
de la misma unidad. IndexedDB confirma la escritura atómica y conserva los
datos cifrados con AES-GCM y una clave no exportable. Una referencia local
opaca identifica la concesión de lectura. El titular y el identificador de
sesión del JWT existente deben coincidir con la concesión previa. Esa
comparación permite leer la copia dentro de su plazo con el mismo `sid`
tras la rotación del JWT. El JWT se valida con el servidor para acceso online.

El cierre de sesión, el cambio de cuenta o sesión y la revocación conocida
invalidan la concesión. Las pestañas abiertas retiran el contenido al recibir
el cambio. Un rechazo definitivo al revalidar un recurso retira su copia o
la concesión del módulo según el alcance. En línea, el lector confirma la
autoridad de Teacher antes de mostrar una lista o copia.

`/nodia-teacher/downloads` usa un lector estático sin datos de la cuenta.
El service worker prepara bajo demanda sólo el HTML y los recursos públicos
verificados de ese lector. La biblioteca muestra la caducidad y permite
eliminar la copia. El lector construye elementos de texto y estructura a partir
del Markdown. Conserva los rótulos de enlaces e imágenes como texto. El HTML
de la lección queda excluido del renderizado y la lectura no solicita recursos
externos.

## Consecuencias

- La copia corresponde a una versión y una sesión locales. Una revocación
  remota puede conocerse al restablecer comunicación con el servidor.
- El cifrado y la separación de identidad protegen el manejo normal de
  cuentas dentro de la app. Un perfil del navegador comprometido o con
  ejecución de código del mismo origen queda fuera de esa frontera.
- El navegador puede retirar los datos locales según sus políticas de
  almacenamiento. La biblioteca ofrece volver a descargar desde Teacher.

## Referencias

- [PWA-005](../../mvp/103-pwa-progressive-implementation-plan.md#7-pwa-005--lectura-offline-por-módulo)
- [Material versionado de Teacher](ADR-089-versioned-study-plans-and-content.md)
- [Recuperación de conexión](ADR-113-pwa-connection-recovery.md)
