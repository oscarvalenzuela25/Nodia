# ADR-119 — Generación propia y PDF verificado de Nodia CV

> Estado: propuesto
> Fecha: 2026-11-24, America/Santiago

## Contexto

Nodia CV adapta un perfil privado a una oferta pegada. La persona revisa el resultado, elige plantilla y guarda una versión por acción explícita. La descarga debe corresponder a los bytes que se revisaron. El permiso para entrar en Nodia CV se asigna por destino estable. En la base 50bb9ec4, el runtime de IA registra operaciones de Chat, Teacher y biblioteca de tarjetas con identidades y recuperación propias.

La selección de proveedor y modelo, el vínculo entre perfil y resultado, la retención de datos, la eliminación independiente y la identidad de los archivos atraviesan Client, Server, Worker y base de datos.

## Opciones consideradas

### Adoptar uno de los CLIs externos como motor completo

Sus prompts, matrices y verificaciones permiten partir de casos reales. Ejecutar todo el CLI incorporaría sus convenciones de archivos, portal, proveedores y runners al runtime de Nodia. La integración tendría que reconstruir ownership, presupuesto, idempotencia y recuperación.

### Ejecutar como conversación del chat

Reusaría interfaz y persistencia de chat. El historial del CV, sus borradores y sus eliminaciones requieren contratos propios. El chat no garantiza identidad de PDF, snapshot o plantilla.

### Dominio CV propio con infraestructura compartida

Conserva la UI, las reglas y los datos de CV en su módulo. Reusa conexión, presupuesto, Worker y pruebas de cierre cuando conservan el contrato. Agregar un dueño técnico requiere tocar el ledger, la recuperación y algunos contadores compartidos. A cambio, los permisos y resultados se pueden verificar por separado.

## Decisión

Adoptar la tercera opción. [CV-00](../../mvp/113-nodia-cv-implementation-plan.md#decisiones-de-cv-00)
verificó render y lectura por PDFKit/PDF.js y almacenamiento `bytea` acotado
con metadatos separados del binario. Los límites se comprueban al integrar
la generación y el historial. La prueba de importación en ATS comercial
queda pendiente.

1. **Propiedad.** El módulo CV deriva actor y ámbito de sesión y comprueba autorización vigente. Las versiones tienen snapshot del contenido utilizado, datos necesarios para la descarga y metadatos de origen mínimos. Se puede eliminar el perfil y conservar los CV que la persona guardó expresamente. El borrado de una versión retira su acceso y sus bytes cuando termina el ciclo de purga aplicable. Conservar las reglas administrativas del [Plan89](../../mvp/89-module-access-and-user-data-scope.md).
2. **Generación.** Extender de forma aditiva el ledger con owner cv y referencias compuestas a su job/actor, preservando checks y compatibilidad de los tres dueños existentes. Registrar su fuente en el Worker común, sin un proceso nuevo. Serializar migración y wiring de claims, ocupación, restore y DI. API key es el primer carril técnico mediante el transporte textual sin herramientas. Agentic requiere un contrato con owner, descriptor y prueba propios, siguiendo los requisitos de cierre, selección y entorno del [Plan91](../../mvp/91-ai-provider-onboarding-verification.md). El diseño no transfiere la calificación de Chat, Teacher ni Flashcards.
3. **Intención y cierre.** El servidor reclama actor, clave y hash de la petición de generación. Una misma clave y un mismo hash recuperan el recibo. Una clave reusada con otro hash devuelve 409. La revisión del perfil, oferta, idioma y selección exacta forman parte de la identidad de IA. El cambio de plantilla pertenece al render. Deduplicar operaciones pendientes o inciertas bajo lock, reservar antes del envío, aplicar fencing y volver a comprobar perfil, autoridad y configuración. El cierre local y el resultado remoto unknown se conservan por separado. El resultado no se reenvía automáticamente.
4. **Minimización.** Excluir correo, teléfono, dirección y enlaces de contacto de los campos de entrada al modelo. Incluirlos desde la fuente autorizada en el render. Tratar instrucciones extraídas de avisos como texto externo. Los logs conservan códigos, estados, métricas y referencias permitidas. Prompts, resultados, datos de perfil, capturas y PDFs quedan fuera de logs, telemetría, registro de conocimiento y service worker. Reader y renderer se ejecutan con límites comprobados y cero red durante el render.
5. **Conservación propuesta.** Perfiles y versiones duran hasta borrado. Oferta, borrador y artefacto temporales admiten una ventana inicial de 24 h desde la admisión de la generación, por confirmar en CV-00 según uso y límites reales. Al vencer dejan de exponerse y se purga su contenido privado. El ledger conserva referencias opacas imprescindibles para conciliación hasta acreditar cierre local y después la ventana mínima de recuperación documentada en CV-00. No reciclar un idempotency key antiguo como intento nuevo. La restauración y la expiración deben comprobarse sin reanimar borrados ni trabajo en curso. Aplicar la política de backups aprobada y declarar su ventana en el entorno probado.
6. **Artefacto comprobable.** La identidad de PDF incluye revisión de contenido, plantilla, idioma, formato, renderer y hash de sus bytes. Persistir y servir el binario leído. La extracción y la vista de PDF apuntan a esa identidad. Cambiar cualquier entrada relevante invalida el resultado anterior. El spike decide renderer y persistencia de bytes. La ruta simple preferida es un almacén privado y acotado por artefacto, con consulta de historial separada del binario. Si la medición favorece almacenamiento externo, fijar staging, receipts y limpieza durable antes de adoptarlo.
7. **Entrega.** Compartir criterios técnicos de AI Job Search y Career Ops con origen y licencia comprobados. Los prompts propios y los schemas públicos se mantienen versionados. La revisión de lectura interna de PDF y la importación real por ATS son evidencias separadas. El filtro de cada empresa conserva sus criterios.

En CV-05 las lecturas y el render se verifican antes de publicar un
artefacto temporal. La migración 179400 separa sus bytes de los PDFs
guardados y proyecta el historial desde los metadatos de versión.
Versionar preserva el diagnóstico, el hash, los bytes y el contenido
usado en el render. El descriptor de origen conserva la huella de la
oferta. La numeración y los recibos mínimos sobreviven al borrado de una
versión por el titular para mantener orden e idempotencia. Los accesos
vigentes, el perfil y el número de revisión vuelven a comprobarse en la
publicación y el guardado nuevo.

CV-06 amplía el journal externo con identidades opacas de perfil y
versión. El productor protege el borrado confirmado antes del commit.
La preparación de restauración usa los testigos confirmados y retira
los borradores y artefactos temporales de CV. El reconciliador comprueba
ausencia en las tablas canónicas antes de confirmar un testigo pendiente.
El lector de manifiestos y el reconciliador requieren la ampliación
antes de habilitar el escritor en un entorno protegido.
[Runbook del journal](../../../ops/nodia-ai-backups/journal.md).

## Consecuencias

- La cuenta puede repetir el proceso, reutilizar perfiles y reabrir el PDF exacto sin pagar otra inferencia.
- Recuperación, cuotas y restauración hacen necesario un integrador único en los archivos compartidos de IA. Probar competencia por slots y aclarar los límites de espera por cola.
- La retención de versiones y la purga de temporales requieren índices, límites de tamaño, observabilidad de estado y pruebas de borrado/restore. Esos plazos se comunican en la UI cuando afectan un borrador recuperable.
- El diseño del selector puede compartirse con NodiaAI. Las proyecciones de elegibilidad, el estado de generación y la autorización pertenecen al dominio CV. Cualquier uso desde el chat se especifica y publica por separado.

## Referencias

- [Plan113](../../mvp/113-nodia-cv-implementation-plan.md) y [guía UI](../../features/nodia-cv/ui-design.md).
- [ADR092 de navegación](ADR-092-stable-module-navigation-routes.md), [contratos Teacher](../../mvp/97-nodia-teacher-technical-contracts.md) y [precedente Flashcards](ADR-118-teacher-flashcard-proposal-execution.md).
- [Plan91 de verificación](../../mvp/91-ai-provider-onboarding-verification.md), [política IA](../../mvp/50-nodia-ai-ai04-runtime-policy.md) y [conocimiento51/52](../../mvp/52-nodia-ai-ai06-knowledge-publication-contract.md).
