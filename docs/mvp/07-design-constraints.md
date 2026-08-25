# Restricciones de Diseño — Nodia Parte 1

> Estado: aprobado
> Última actualización: 2026-08-22
> Dependencias: 05-sitemap.md y 06-route-specs.md aprobados

## Objetivo

Definir sistema visual, accesibilidad y restricciones de interacción aplicables para el frontend del MVP, asegurando coherencia visual y técnica antes de definir la arquitectura y stacks definitivos.

## 1. Librería de Componentes y Sistema Visual

- **Framework de UI:** Se utilizará la estructura existente en `nodia-client`, la cual se basa en **Material UI (MUI)**.
- **Componentes base:** Se utilizarán los componentes nativos de MUI para la interfaz del backoffice (Tablas, Modales, Botones, Inputs, etc.).

## 2. Tematización (Theming)

- **Modos soportados:** El sistema soportará explícitamente tanto **Modo Claro (Light Theme)** como **Modo Oscuro (Dark Theme)**.
- **Design Tokens:** Los colores exactos para MUI se extraerán y generarán a partir de un tema proporcionado posteriormente.

## 3. Tipografía

- **Requisitos:** Elegante, agradable a la vista, y sin problemas con los pesos *normal* y *bold*.
- **Opciones recomendadas:** Dado que MUI trae *Roboto* por defecto, podríamos cambiar a **Inter** (súper limpia, excelente para interfaces y backoffices), **Poppins** (un poco más geométrica y amigable), o **Nunito Sans**. Dejaremos pendiente la elección exacta para el momento de inyectar el tema.

## 4. Responsividad (Layout)

- **Enfoque:** Full Responsive.
- **Justificación:** Aunque la Parte 1 es de carácter administrativo, los usuarios accederán desde celulares. Las vistas, especialmente las tablas de listados y modales de Ajustes Generales, deben adaptarse correctamente a dispositivos móviles.

## 5. Accesibilidad (a11y)

- **Nivel de exigencia:** No es prioridad para el MVP.
- **Enfoque práctico:** Se aprovechará únicamente la accesibilidad gratuita que ya traen los componentes de MUI out-of-the-box, sin realizar pruebas o ajustes específicos de contraste, screen readers o navegación estricta.

## Hechos confirmados
- Se reutiliza la base tecnológica de UI de `nodia-client` (MUI).
- Soporte para Light y Dark theme.
- Diseño totalmente responsivo.
- Accesibilidad no es prioridad de desarrollo para el MVP.

## Preguntas abiertas
- Recepción del Theme para generar los tokens de MUI.
