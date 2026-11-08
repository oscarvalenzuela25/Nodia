# ADR-075 — Imágenes privadas por intento y aceptación por MIME de Codex

> Estado: propuesto
> Fecha: 2026-10-23

## Contexto

C40-10 no tiene transporte de originales en el adaptador Codex. El contrato del chat ya permite imágenes, PDF y notas de voz cuando una selección haya acreditado ese formato. El protocolo observado de Codex0.161.0 admite `localImage`; el catálogo, OCR y Gemini no prueban la aceptación de imágenes en el nuevo chat.

## Opciones consideradas

### Incluir base64 en el prompt o aumentar sus techos

Una imagen de hasta20MiB supera el presupuesto actual de contexto y el frame JSONL. Inflar esos límites para incorporar binarios alteraría las garantías verificadas de memoria y transporte. Se descarta.

### URL remota o path proporcionados por el cliente/modelo

Ampliaría los destinos de lectura y podría exponer referencias de almacenamiento, contenido remoto o archivos del host. Se descarta.

### Archivo privado derivable por identidad de intento

El worker aporta bytes ya autorizados y verificados. El supervisor los materializa bajo el perfil privado con ruta generada por Server y transmite únicamente una referencia `localImage`. Se mantiene el ownership necesario para conciliar una caída.

## Decisión

Implementar inicialmente PNG, JPEG y WebP como candidatos independientes. Validar MIME/firma, SHA256, base64 canónico, dimensiones y los límites propios de Nodia antes de enviarlos. No heredar límites del OCR: el chat conserva20MiB por archivo,40MiB por mensaje, hasta cuatro adjuntos y12MP por imagen.

Derivar el staging exclusivamente del perfil y UUID del intento, con directorios0700, archivos0600 y creación exclusiva. Rechazar enlaces, propietarios/permisos incompatibles y rutas que excedan la cota medida. El hash del payload debe fijar orden, formato, tamaño y contenido. El contexto mide una cota de las referencias; no inventa tokens de visión ni incluye los binarios en el prompt textual.

El staging se retira sólo después de probar el cierre del proceso/grupo nativo propio y antes de certificar el terminal. Un resultado incierto conserva su identidad para conciliación; no libera la reserva ni reenvía la generación. La recuperación puede derivar el staging del intento sin guardar rutas arbitrarias. La limpieza nunca debe retirar archivos de otro intento.

La aceptación de cada MIME requiere una prueba explícita del operador: un nonce conocido sólo a través de la imagen, respuesta semántica exacta, terminal completado, cierre y ACK propios. Se conserva un registro técnico acotado por conexión/MIME, con el mismo scope exacto de sesión/configuración/modelo/esfuerzo/runtime que MCP. No almacena imagen, prompt, nonce en claro ni credenciales. Health, catálogo y pruebas sintéticas no generan una aceptación operativa. La nueva frontera entra en el fingerprint.

Mantener deshabilitados shell, lectura arbitraria, herramientas nativas, red y MCP externos. Conservar los techos existentes de contexto y frames; un eco nativo sobredimensionado es un fallo que debe conciliarse, no una razón para elevarlos silenciosamente. PDF y audio siguen bloqueados, sin convertir OCR ni una transcripción en prueba nativa.

## Consecuencias

- No se agregan tablas, credenciales, permisos ni herramientas de negocio.
- Una selección puede conversar y usar MCP sin tener ningún MIME aceptado; acreditar PNG no habilita JPEG, WebP, PDF o audio.
- El transporte implementado y sus pruebas aisladas no acreditan una cuenta real. C40-10 conserva aceptación pendiente hasta el ensayo correspondiente.
- Cambiar la frontera invalida los proofs ligados a su fingerprint; un build nuevo no hereda la aceptación del paquete histórico R03.

## Referencias

- [AI-40](../../mvp/86-nodia-ai-ai40-codex-acceptance.md), C40-10.
- [Política50](../../mvp/50-nodia-ai-ai04-runtime-policy.md), límites y originales verificados.
- [Aceptación MCP](ADR-073-codex-mcp-acceptance-scope.md).
- [Protocolo observado sin inferencia](../../evidence/nodia-ai-ai39-experimental-protocol-r02.json).
- [OpenAI Docs: App Server](https://learn.chatgpt.com/docs/app-server), tipos de entrada de turnos. El binario instalado y la cuenta se verifican por separado.
