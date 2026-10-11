# ADR-027 — Core reutilizable e instalación desde una base vacía

> Estado: implementado localmente; en revisión documental
> Fecha: 2026-10-10

## Contexto

La cadena histórica de 15 migraciones suponía tablas existentes y fallaba al instalar en PostgreSQL vacío. El usuario necesita replicar/vender la base Core y configurar el correo del administrador por entorno. La BD local tiene siete migraciones registradas y un esquema anterior cuyo historial está incompleto; reescribir o fusionar archivos aplicados puede reproducir DDL, perder configuración o divergir entre instalaciones.

## Opciones consideradas

### Opción A — Fusionar el historial en una migración actual

- Reduce el número visible de archivos.
- Cambia las identidades que TypeORM ya registró y requiere un procedimiento explícito de transición para cada BD existente. No resuelve por sí sola qué pasos ya ocurrieron fuera del historial.

### Opción B — Baselines separados y bootstrap privado configurable

- Conserva el historial; agrupa tablas iniciales relacionadas en dos archivos congelados.
- Permite reutilizar Core sin Negocios/IA y ejecutar una instalación nueva con un solo comando.
- Añade archivos al historial; una BD existente con huecos requiere reconciliación explícita.

### Opción C — Generar el esquema desde entidades al arrancar

- Simplifica la primera ejecución.
- El resultado cambia al modificar entidades, no conserva un contrato histórico y puede alterar datos existentes. Contradice `synchronize=false` y la política de migraciones revisables.

## Decisión

Aplicar B. `InitialCoreSchema1789257400000` crea nueve tablas Core con índices/FKs y datos estables: rol `super_admin`, grupo `general_settings`, cuatro módulos y traducciones. No crea usuarios. `InitialBusinessAiSchema1789257500000` aporta las diez tablas previas de Negocios/IA; mantiene el campo histórico `ai_providers.key` solo hasta que las migraciones existentes lo transforman/retiran. El índice de recuperación de factura queda a cargo de su migración histórica. Ambas baselines contienen SQL congelado y no consultan metadata de entidades para generar DDL en ejecución.

Las baselines crean solo conjuntos ausentes, preservan conjuntos completos existentes y rechazan conjuntos parciales. No afirman que toda BD con tablas existentes tenga un historial reconciliado. Los datos Core se insertan por claves únicas sin sobrescribir configuraciones existentes. Sus `down` rechazan eliminación automática del esquema inicial: reversión mediante respaldo verificado.

`CompleteAiProviderCatalog1791640000000` agrega Moonshot/Kimi sin habilitar canales ni modificar las 16 identidades existentes. Alinea los defaults de creación API con las entidades actuales, sin cambiar flags de conexiones/filas existentes. No contiene modelos, credenciales ni cuotas.

`BOOTSTRAP_SUPER_ADMIN_EMAIL` configura la identidad inicial por instalación; no hay fallback personal en código. `seed:core` invoca el caso de uso compilado; `db:setup` ejecuta la cadena y ese bootstrap. No se dispara al arrancar el servidor. El comando de instalación valida el correo antes de conectar y rechaza una BD existente con migraciones pendientes; no se usa para actualizar/reparar historiales parciales.

El bootstrap comparte lógica con el seed HTTP existente: transacción, advisory lock PostgreSQL común a CLI/HTTP, traducciones con el mismo manager y asociaciones activas por IDs resueltos. Repetición privada con el mismo administrador/asignaciones es inocua. Correo distinto o accesos modificados/desactivados producen conflicto; cambiar `.env` no promueve otra cuenta ni restaura permisos retirados. El seed HTTP mantiene secreto/DTO y conflicto ante administrador existente. El login continúa verificando identidad Google y vincula `google_sub`; el correo no autentica por sí solo.

## Consecuencias

- Se conservan las 15 migraciones históricas sin renombrarlas ni fusionarlas; pasan a18 archivos por tres incorporaciones necesarias.
- Core se puede reutilizar seleccionando su baseline, sus entidades/casos de uso y migraciones de autenticación; copiar el SQL no empaqueta automáticamente el frontend o todas las dependencias de Auth. Negocios/IA y Finanzas/Reservas conservan sus límites.
- `seed:core` asigna exactamente los cuatro módulos pedidos. Finanzas, Reservas, Negocios y Proveedores IA requieren su navegación/asignación por separado.
- Agrupar cambios pequeños relacionados antes de aplicar una futura entrega es admisible. Compactar un historial aplicado requiere una decisión/procedimiento de transición adicional y pruebas sobre respaldos; no se hizo aquí.
- La BD local no se modifica. El soporte de instalación vacía no certifica VPS, R2, sesiones/inferencia IA ni cierra S-05.

## Referencias

- [Inventario y operación de migraciones](../../mvp/database-installation.md).
- [Revisión de lanzamiento](../../mvp/19-prelaunch-review.md).
- [Contrato de proveedores IA](../../mvp/ai-provider-feature-contract.md).
- [ADR-004 — Sesiones de autenticación](ADR-004-auth-sessions.md).
