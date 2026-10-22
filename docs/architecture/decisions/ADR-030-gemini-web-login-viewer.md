# ADR-030: Visor de login Gemini Web en Nodia

Fecha: 2026-10-13. Estado: implementación autorizada por el usuario; aceptación operativa pendiente.

## Contexto

El navegador de autenticación se ejecuta en el microservicio. En una VM o VPS su ventana no aparece en el equipo del usuario. Se solicita completar el login desde el frontend, sin comandos manuales.

## Decisión

Usar el contexto Playwright existente para un visor de imágenes JPEG y comandos limitados de entrada, a través de Nodia Server. Las rutas públicas requieren autenticación y `ai:manage`; el actor procede del JWT y se transmite mediante la credencial privada del servicio. Cada intento pertenece exclusivamente a ese actor, dura como máximo 300 segundos y admite un navegador por proceso. El visor desaparece al terminar/cancelar; no publica cookies, DOM, URLs de autorización ni un escritorio remoto.

Permite clic, texto, teclas de formulario y scroll exclusivamente sobre HTTPS de Google/Gemini. Cada comando consume un identificador de pantalla; una navegación invalida el anterior. Sin reintentos automáticos de entrada. Cuerpos limitados a 8 KiB, texto a 2048 caracteres, pantalla a 1280×850/768 KiB JPEG, respuesta privada a 1 MiB más metadatos y operación a 3 segundos. Respuestas `no-store`; nada de texto, imágenes o credenciales se registra en logs o cachés duraderas.

Linux Docker arranca su propio Xvfb sin puerto TCP. Solo se expone la API de Nodia; el microservicio continúa privado (ADR-008). Frontend disponible en desarrollo y producción; VPS requiere HTTPS y los orígenes autorizados del sistema de autenticación. No se habilita un proxy VNC ni se exportan contraseñas del visor anterior.

## Alternativas y consecuencias

Ampliación solicitada el2026-10-13: cambio explícito de cuenta Web con confirmación del ámbito compartido. La desconexión limpia perfil/caché después de cerrar el SDK y persiste una marca atómica que prevalece sobre la semilla `.env` de solo lectura. Solo un nuevo login explícito reemplaza esa marca; una limpieza fallida bloquea ese login hasta completar un reintento. Conservar API/Agentic/Codex y los roots de volumen, rechazar rutas externas y no seguir enlaces del perfil. Borrar únicamente cookies permitía restaurar la cuenta antigua desde Google o `.env`; seleccionar una cuenta sin limpiar el perfil no ofrece la garantía de identidad requerida. Un cambio cancela la continuidad Web para todas las conexiones; no borra conversaciones Google ni revoca sus otros accesos.

Un iframe de Google no controla el navegador del servidor y puede estar bloqueado. VNC compartiría un escritorio y requeriría otro canal de autenticación/transporte. HTTP reutiliza la API, pero consume imágenes periódicas y no equivale a accesibilidad DOM de Google: ofrece Tab/Enter y controles de texto como alternativa. La aprobación de Google depende de su servicio y del navegador; mostrarlo no garantiza un login aceptado.

Una sola réplica Python y API en este flujo. Antes de escalar, implementar afinidad/ownership compartido y probar el ciclo completo. Sesión Web global existente conservada, independiente de Gemini Agentic/API y Codex.

## Verificación

Pruebas de ownership, límites, sitio permitido, invalidación, cancelación, transporte validado y UI con preservación de texto ante errores. Comprobar despliegue/pantalla real en VM; login con cuenta real y VPS se registran separadamente y no se acreditan mediante mocks.
