# ADR-086 — Dictado del navegador y reproducción de audio autorizado

> Estado: propuesto. El usuario eligió explícitamente el dictado del navegador, incluido su posible servicio remoto; esto autoriza la implementación y no aprueba este ADR ni publica fichas de conocimiento.
> Fecha: 2026-10-29

## Contexto

El micrófono principal del chat guardaba una grabación como adjunto. El usuario solicita obtener texto editable y actividad visual de voz. El cambio distingue entrada de texto, tratamiento del audio por el navegador y ejecución posterior de NodiaAI; también debe conservar el acceso a archivos de audio manuales e históricos sin reinterpretarlos.

## Opciones consideradas

### A: grabación como adjunto y reconocimiento mediante un proveedor Nodia

Reutiliza los contratos de archivos y podría centralizar la extracción, pero añade upload, persistencia, credenciales, calificación por selección y presupuesto antes de obtener texto. Mantiene el micrófono como productor de archivos y requiere otro flujo de inferencia. No es la opción elegida por el usuario.

### B: reconocimiento disponible en el navegador

Entrega hipótesis interinas/finales como borrador editable mediante `SpeechRecognition` o su alias disponible. No necesita una clave de Nodia ni crea un adjunto. Tiene compatibilidad y servicio dependientes del navegador; el motor puede ser remoto y fallar por red, permisos, idioma o falta de voz. Es la opción elegida expresamente, sin prometer reconocimiento local/offline.

## Decisión

Implementar B para el micrófono principal conforme [plan93 R07](../../mvp/93-nodia-ai-chat-composer-redesign.md). Mantener Agentic/API key como los modos de ejecución de NodiaAI; el dictado es una preparación de texto y no introduce otro proveedor, fallback o transporte de inferencia Nodia.

Invocar `start()` por intención del usuario, con idioma real de UI, `continuous` e `interimResults`. Reconstruir cada actualización desde el texto base y el snapshot completo de resultados; no concatenar de nuevo finales repetidos. Validar los bytes UTF-8 del candidato completo contra el presupuesto restante del mensaje. Rechazar un resultado excedido, conservar el anterior e informar, sin truncado silencioso.

Usar un stream explícito de `getUserMedia({audio:true})` para `VoiceActivity` y Web Audio. La forma de onda representa muestras del stream y no progreso, confianza ni precisión del reconocedor. No se conecta a la salida de sonido. No se usa `MediaRecorder`, `File`, upload o un SDK de inferencia en el hook de dictado.

Al detener, cerrar los tracks propios y solicitar `stop()`, permitiendo el final de la misma sesión hasta `onend` o un timeout local de 5 segundos. Cancelación, deshabilitación, cambio de conversación y desmontaje abortan localmente y descartan resultados/permisos tardíos. No se reinicia el motor automáticamente ni se afirma cancelar procesamiento remoto. Tras cerrar la sesión el usuario edita/revisa el texto y sólo su intención de Enviar inicia la admisión normal.

Los audios manuales e históricos mantienen sus contratos de adjuntos. `AudioPreview` reproduce localmente un `Blob` obtenido por el flujo autorizado; no busca originales, crea adjuntos ni interpreta voz. Pausa y revoca su fuente al cambiar/desmontar; reintenta sólo la reproducción local bajo intención. No amplía capacidades de audio de una selección Nodia.

## Consecuencias

- Entrada de voz y archivos de audio tienen responsabilidades y límites distinguibles; las claves Nodia no intervienen en el dictado y los efectos comerciales conservan sus gates humanos.
- El navegador puede transmitir audio a su servicio remoto. Su cuenta, conectividad, idioma, disponibilidad y política no se deducen de la configuración Nodia ni se califican con un flag de API presente.
- Se deben conservar estados solicitando/escuchando/deteniendo, liberar recursos propios y comunicar errores, ausencia de soporte y timeout sin destruir el texto aceptado.
- Código, pruebas con dobles de APIs y forma de onda visual no prueban transcripción de habla real. En el ensayo aislado con WAV/dispositivo sintético, Edge156 terminó en `network` y Chrome156 en `no-speech`, sin texto en ambos. No se atribuye una causa interna ni se acepta micrófono físico/ASR por ese ensayo.
- Client estático R07 adoptado en VM con HTTP/hashes y respaldo/fallback comprobados; no se alteraron Server/KB/Native. UI autenticada, dispositivos/navegadores reales y transcripción con habla del usuario siguen pendientes. El ADR permanece propuesto y la ficha candidata sin aprobación/publicación.

## Referencias

- [Plan93 R07](../../mvp/93-nodia-ai-chat-composer-redesign.md), [ficha candidata](../../nodia-ai/knowledge/nodia-ai/features/chat-composer-selection.md) y [evidencia por alcance](../../evidence/nodia-ai-voice-dictation-20261029-r01.json).
- [Hook de dictado](../../../nodia-client/src/modules/nodiaAi/components/ChatComposer/hooks/useVoiceDictation.ts), [actividad de voz](../../../nodia-client/src/modules/nodiaAi/components/VoiceActivity/VoiceActivity.tsx), [reproductor local](../../../nodia-client/src/modules/nodiaAi/components/AudioPreview/AudioPreview.tsx).
- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [snapshot de resultados](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionEvent/results), [errores](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error).
