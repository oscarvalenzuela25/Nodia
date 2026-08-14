# AGENTS - Home Module

Contexto operativo para agentes IA que trabajen dentro de `src/modules/home`.

## Objetivo del modulo

Este modulo contiene la experiencia principal de inicio (`/`) para usuarios autenticados.

## Archivos clave

- `src/modules/home/pages/Home/Home.tsx`
- `src/modules/home/pages/Home/home.css`
- `src/routes/index.tsx`

## Reglas del modulo

1. Esta pantalla se consume dentro de una ruta protegida (`Guard`).
2. Todo texto visible debe usar `t("home:key")` o `t("translate:key")`.
3. Si agregas nuevas claves, mapear en:
   - `src/translate/es/home.json`
   - `src/translate/en/home.json`
   - `src/translate/es/translate.json`
   - `src/translate/en/translate.json`
4. El selector de idioma debe seguir usando `i18n.changeLanguage(...)`.
5. Si incorporas datos remotos, preferir React Query + `mainInstance`.
6. Mantener accesibilidad minima en elementos interactivos (labels, alt, contraste, focus).

## Skill obligatoria para componentes

- Skill: `create-component`
- Ruta: `skills/create-component/SKILL.md` (relativa a la base del proyecto)

Si se crea o modifica un componente en este modulo, se deben seguir los lineamientos de esa skill.
