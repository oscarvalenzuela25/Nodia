# ADR-073 — Aceptación MCP de Codex ligada a la ejecución exacta

> Estado: propuesto
> Fecha: 2026-10-22

## Contexto

AI-39 integra el transporte Codex con el gateway, pero sesión y catálogo no demuestran una llamada de herramientas. AI-40 necesita compartir esa evidencia entre API y worker sin inferencias de salud ni importar la sesión de la app Codex. Los originales de archivos conservan sus gates independientes.

## Opciones consideradas

### Flag en configuración o recepción del catálogo

No permite distinguir configuración de disponibilidad real. Se descarta.

### Prueba sólo en memoria o reutilizar el journal de ejecución

La memoria desaparece entre procesos; el journal puede purgarse tras su ACK y deadline original. Retener esos recibos indefinidamente sólo para mostrar disponibilidad introduce conservación innecesaria.

### Registro técnico acotado junto al perfil privado

Permite compartir una aceptación de transporte exacta sin otra tabla, listener o credencial. Requiere invalidación y escritura durable.

## Decisión

Mantener como máximo un registro privado `nodia-chat-mcp` por conexión. Sólo un diagnóstico explícito del operador puede escribirlo después de una llamada real al gateway publicado, respuesta con nonce desconocido para el prompt, terminal completado, cierre propio y ACK comprobado en el journal. No existe un endpoint generativo de salud ni un botón que convierta configuración en disponibilidad.

La evidencia vincula conexión, recurso, generación lógica de sesión, generación de configuración, modelo y esfuerzo exactos. Su huella incluye el ejecutable nativo real, las fronteras JS ejecutadas, Node/V8/plataforma y política de runtime. Login, despliegue, cambio de modelo/configuración o resultado incierto impiden reutilizar la aceptación correspondiente. La lectura revalida la generación actual del perfil; nunca importa credenciales globales.

El archivo tiene esquema cerrado y tamaño acotado, propiedad del UID operativo, permisos privados y acceso sin seguir symlinks. Escritura temporal exclusiva, fsync y renombrado atómico. Sólo conserva referencias técnicas y hash del nonce: no mensajes, argumentos, resultados, claves o identidad de la cuenta. No añade una TTL arbitraria ni altera los 90 días de los chats. La evidencia no concede permisos; cada callback sigue reautorizándose en SQL.

## Consecuencias

Una sesión auténtica puede mostrar chat disponible y MCP aún sin acreditar. Las herramientas se habilitan al coincidir la evidencia exacta, sin cambiar proveedor, modo o modelo por un error. La aceptación del transporte no sustituye las pruebas de cada familia funcional, la confirmación humana ni la verificación por formato. Un resultado incierto invalida la aceptación sin liberar recursos o borrar el journal.

## Referencias

- [Separación de adaptadores](ADR-072-nodia-ai-provider-runtime-adapters.md).
- [AI-40 y matriz de aceptación](../../mvp/86-nodia-ai-ai40-codex-acceptance.md).
- [Codex App Server oficial](https://learn.chatgpt.com/docs/app-server): herramientas dinámicas experimentales; el binario instalado y la cuenta se verifican por separado.
