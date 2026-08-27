# ADR-001 — Adopción de React Hook Form y Zod para Formularios y Validación

> Estado: aprobado
> Fecha: 2026-08-26

## Contexto

El cliente (`nodia-client`) requiere gestionar formularios interactivos (creación, edición y filtros de datos) integrados con la librería de componentes Material UI (MUI v9) y soporte para tipado estricto e internacionalización (i18n). Se necesita una solución estándar para la gestión del estado de formularios y la validación de esquemas que minimice re-renders y garantice seguridad de tipos en tiempo de compilación y ejecución.

## Opciones consideradas

### Opción A: React Hook Form + Zod (`@hookform/resolvers`)

- Ventajas:
  - Manejo no controlado/controlado eficiente que minimiza re-renderizados innecesarios.
  - Validación declarativa y segura de tipos con Zod (`z.infer`).
  - Excelente integración con Material UI mediante `Controller`.
  - Fácil integración con i18next para mensajes de validación.
  - Ecosistema maduro y ligero en bundle size.
- Desventajas:
  - Requiere el uso de `Controller` para inputs controlados de MUI.

### Opción B: Formik + Yup

- Ventajas:
  - Ecosistema ampliamente conocido.
- Desventajas:
  - Mayor costo de renderizado por cambios de estado globales.
  - Menor integración nativa de tipos comparado con TypeScript + Zod.
  - Menor actividad y adopción en proyectos modernos React 19.

### Opción C: Estado local manual (`useState`) por componente

- Ventajas:
  - Sin dependencias externas adicionales.
- Desventajas:
  - Código repetitivo y propenso a errores en validación, manejo de `touched`, `errors` y submit.
  - Difícil de estandarizar y mantener entre múltiples módulos (Users, Roles, Modules, etc.).

## Decisión

Se adopta **React Hook Form (v7)** junto a **Zod (v4)** y **`@hookform/resolvers`** como el estándar oficial de formularios y validación de esquemas en `nodia-client`.

## Consecuencias

- Consecuencias positivas:
  - Estandarización consistente de todos los formularios en modales y páginas.
  - Tipos estricto e inferencia automática desde los esquemas de Zod.
  - Integración nativa con `t(...)` de i18next para mensajes de error traducibles.
  - Alto rendimiento sin re-renderizar todo el formulario en cada tecla pulsada.
- Costos o riesgos aceptados:
  - Requiere envolver componentes de MUI en `Controller` de React Hook Form.
- Trabajo posterior:
  - Implementar los esquemas y formularios en los modales de creación/edición de Usuarios, Roles y Módulos.

## Referencias

- `docs/mvp/08-stack-frontend.md`
- `nodia-client/skills/create-component/SKILL.md`
