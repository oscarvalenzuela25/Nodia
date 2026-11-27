# Nodia CV — QA visual, parsers y modelos en Alto

27 de noviembre de 2026. Los perfiles y archivos de prueba son sintéticos.
Cambios de presentación del cliente y herramienta de verificación. La ficha de
conocimiento de Nodia CV conserva su estado y su contrato de publicación.

## Editorial y Contemporánea

Se preparó el mismo contenido con el renderer de Nodia en los dos diseños y
en ambos idiomas. La extracción interna devolvió los mismos campos para ambas
plantillas en cada idioma y una página por PDF. Cuatro tecnologías explícitas
en cada archivo: TypeScript, React, PostgreSQL y Docker. El empleo ficticio
en Northbridge Test Labs tiene un solo cargo y un período de abril de 2021 a
septiembre de 2024.

| Plantilla e idioma | SHA-256 del PDF sintético |
| --- | --- |
| Editorial EN | `8df868f3d10c269883a37636cde28997b262519d5972beec8f4ba60a9d36dfe4` |
| Contemporánea EN | `fa82640eb0838983bd9b797bcde86fc063312ec13e88c50df4f02c185dace6a7` |
| Editorial ES | `cebb0f2e0ad3e7784f00687b57c203596096d0609d74435af76f0783da1b81f1` |
| Contemporánea ES | `c8c0df34b8bf2f8f10d4c39d76fb6249b4b1e3f796848ced3844b21bbcea86d7` |

| Importador de prueba | Editorial | Contemporánea |
| --- | --- | --- |
| OneATS EN | Cargo, empresa, ambos meses y 4 tecnologías | Cargo, empresa, ambos meses y 4 tecnologías |
| OneATS ES | 4 tecnologías. Historial laboral vacío | 4 tecnologías. Historial laboral vacío |
| HireLayer ES | Cargo, empresa, ambos meses y 4 tecnologías | Cargo, empresa, ambos meses y 4 tecnologías |

Se usaron los parsers públicos y se inspeccionaron los campos del resultado.
La carga se limitó a esos PDFs y no creó una postulación. OneATS muestra su
parser de prueba y HireLayer ofrece su propio motor de importación para ATS.
Esta observación acredita esas muestras y esos dos lectores.
[OneATS](https://www.oneats.co/tools/resume-parser) ·
[HireLayer](https://hirelayer.co/tools/resume-parser).

## Matriz Agentic de referencia en la VM

El piloto de loopback usó Server compilado, 87 migraciones en PostgreSQL
aislado y los runtimes autenticados del laboratorio. El perfil fue sintético.
El puesto de **Senior Full-Stack Engineer (AI)** de Prect.ai se resumió para
el ensayo. Se usó la misma entrada de 1.449 bytes en las trece selecciones,
SHA-256 `0bb39db81e90ae6d5d736d07aea066a620a2bce7917bda02ec2e721e0a442b64`.
[Oferta pública](https://www.getonbrd.com/jobs/machine-learning-ai/senior-full-stack-engineer-ai-prect-ai-remote).

El catálogo aislado de Codex tenía una selección configurada. Se actualizó
con el descubrimiento nativo real de esa cuenta para poder ejercer sus diez
modelos que anuncian Alto. Gemini aportó tres variantes en Alto. El ensayo
usó la API ordinaria del módulo y una sola solicitud por selección.

| Modelo Agentic · Alto | Estado con ventana inicial | Operación hasta cierre |
| --- | --- | ---: |
| GPT-6.2 Sol | Borrador y PDF | 41 s |
| GPT-6.2 Astra | Borrador y PDF | 28 s |
| GPT-6.1 Sol | Borrador y PDF | 35 s |
| GPT-6.1 Terra | Borrador y PDF | 18 s |
| GPT-6 Astra | Borrador y PDF | 39 s |
| GPT-6 Sol | Borrador y PDF | 37 s |
| GPT-6 Luna | Borrador y PDF | 32 s |
| GPT-5.6 Sol | Borrador y PDF | 88 s |
| GPT-5.6 Terra | Borrador y PDF | 25 s |
| GPT-5.6 Luna | Respuesta completada. El verificador rechazó el contenido | 105 s |
| Gemini 4 Neon | Resultado remoto incierto. Recibo nativo `lifecycle/cli_timeout` | 120 s |
| Gemini 4 Carbon | Resultado remoto incierto. Recibo nativo `lifecycle/cli_timeout` | 121 s |
| Gemini 4 Hydrogen | Borrador y PDF | 44 s |

Los diez PDF confirmados tenían una página, experiencia y TypeScript. Los
bytes descargados coincidieron con el hash del artefacto revisado. Las trece
operaciones registraron un intercambio iniciado, cierre y ambos ACK. Los
dos recibos inciertos quedaron registrados con resultado remoto desconocido.

El primer intento de GPT-5.6 Luna conserva la huella de respuesta y el
rechazo genérico. El motivo exacto de ese rechazo no se guardaba. El
diagnóstico del worker registra la categoría acotada disponible y el UUID de
generación. Omite el texto del perfil, de la oferta y de la respuesta.
