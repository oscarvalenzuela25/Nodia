# ADR-029 — ChatGPT Web descartado

> Estado: descartado por decisión explícita del usuario el 2026-10-12.

## Motivo y evidencia

Se evaluó OpenAI `token_plan_web` para OCR y un chatbot posterior. Google rechazó el login del navegador controlado por el adaptador propio. Una prueba independiente con autowebprompt permitió iniciar sesión y obtener texto y OCR locales; también funcionó un flujo HTTP híbrido con solicitudes preparadas por Chrome.

El flujo autónomo después de cerrar Chrome rechazó texto y OCR con HTTP 403 tanto en Node como en Python. Sesión, modelos y subida de imagen exitosos no acreditaron generación. No se determinó la causa precisa ni se comprobó una operación autónoma, estable o apta para VPS. El usuario canceló este canal por su comportamiento y costo operativo.

## Decisión vigente

OpenAI conserva **Codex agéntico y API key**, con configuración independiente. ChatGPT Web queda descartado: no reintroducir su adaptador, activar su catálogo ni repetir inferencias sin una nueva solicitud explícita. Gemini conserva sus canales actuales.

Por solicitud explícita del usuario se eliminaron el microservicio, las rutas y casos de uso Web, el panel y transporte del frontend, las traducciones, scripts, pruebas y variables exclusivos de ChatGPT Web. También se retiraron el perfil local y volumen/imágenes Docker exclusivos del worker. El plan y la guía extensos se habían eliminado previamente. Las pruebas independientes externas a Nodia se conservan como antecedentes.

Se conservan las columnas y contratos generales `token_plan_web` utilizados por Gemini, la integración Codex y OpenAI API key. La retirada no requiere borrar conexiones ni datos operativos de la BD: el catálogo OpenAI Web nunca se activó en la BD de uso.

Verificación: backend 871 pruebas y frontend 1161, builds/tipado/lint correctos; contratos compilados Codex/PDF/HTTP y claves cifradas en PostgreSQL desechable aprobados. API local activa, rutas Web retiradas con 404; controles API/Codex y Gemini Web comprobados con datos sintéticos en 390/1280 px. Archivos ajenos comparados por hash sin cambios. No se ejecutaron inferencias reales ni se acreditó operación Linux/VPS.

## Continuidad

- [Codex agéntico](../../features/ai-providers/openai-codex-agentic.md).
- [Contrato IA](../../mvp/ai-provider-feature-contract.md).
- [Laboratorio VM para VPS](../../mvp/vps-local-vm-lab.md).
