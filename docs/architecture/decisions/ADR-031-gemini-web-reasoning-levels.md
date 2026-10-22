# ADR-031 — Niveles de razonamiento en Gemini Web

> Estado: implementación autorizada por el usuario; aceptación documental y VPS pendientes
> Fecha: 2026-10-13

## Contexto

El usuario solicita reemplazar el pensamiento extendido Web por Bajo/Medio/Alto.
El SDK2.1.1 solo publica un booleano. La captura nativa con el mismo modelo Flash
descubierto verificó tres valores distintos1/4/2 y mensajes por HTTP satisfactorios.
El ensayo de Medio tuvo un timeout inicial, sin replay automático.

## Opciones consideradas

### Opción A: modificar/copiar el SDK completo o reducir tres opciones a dos

- Ventaja: menor trabajo inicial.
- Desventajas: divergencia de auth/parsing/uploads o una preferencia ficticia.

### Opción B: adaptar solo los dos campos del protocolo comprobado

- Ventajas: preservar SDK y sesión; acotar dependencia privada con validación.
- Desventajas: mantener evidencia/configuración por modelo y revisar cada actualización.

## Decisión

Implementar B en `web_reasoning_adapter.py`. Un registro externo de observaciones
sanitizadas, versionado y montado de solo lectura, habilita niveles únicamente para
IDs/números de modelo comprobados. El catálogo sigue descubierto dinámicamente;
no hay modelos por defecto ni una lista cerrada en código. Un ID no observado
continúa visible/configurable, pero un nivel explícito produce422 sin inferencia.
Ausencia/archivo inválido/SDK incompatible no fabrican soporte ni cambian motor.

Persistir `thinking_levels[id]` y `thinking_level` en el modo Web. Prioridad de
análisis: override explícito → entrada del modelo (incluido null que limpia) →
preferencia del modo → ausencia. El booleano histórico solo se ejecuta si no existe
preferencia de nivel; no se migra automáticamente. Un nivel y un booleano explícitos
juntos se rechazan. UI reemplaza switch/checkbox Web por tres opciones traducidas,
sin elegir Medio por defecto y sin heredar preferencias API/Agentic.

## Consecuencias

- El SDK conserva auth, descubrimiento, uploads, parsing y cierre; no se modifica
  site-packages ni se expone el token interno o una ruta adicional.
- Contexto por generación/cliente, admisión única, limpieza ante cancelación y
  generación sin replay. Persistencia histórica y errores explícitos conservados.
- La sustitución del transporte se activa dentro de `_generate`, después de
  cargar archivos. Uploads y autenticación conservan el `AsyncSession` real del
  SDK; el iterador se cierra al cancelar o finalizar. Regresión con el uploader
  real cubre la validación Pydantic y la conservación del archivo en tres niveles.
- Analizar un archivo en memoria para obtener un borrador no requiere R2.
  Se retira ese requisito de `canUseGemini`; URL y token privado siguen siendo
  obligatorios. Guardar adjuntos/facturas conserva sus requisitos de almacenamiento.
  Esta separación evita acoplar la disponibilidad del motor a otro servicio.
- El perfil describe el transporte observado, no cuota, disponibilidad de una cuenta
  o profundidad interna de razonamiento. Otra cuenta puede rechazar la opción.
- Revisar/versionar protocolo al actualizar SDK o agregar modelos comprobados;
  conservar OCR real, configuración inválida, caída y compatibilidad en regresiones.

## Referencias

- [Contrato IA](../../mvp/ai-provider-feature-contract.md)
- [Evidencia y operación](../../features/ai-providers/gemini-web-login-viewer.md)
- [ADR-005](ADR-005-gemini-web-session.md), [ADR-008](ADR-008-internal-microservices-only.md),
  [ADR-030](ADR-030-gemini-web-login-viewer.md).
