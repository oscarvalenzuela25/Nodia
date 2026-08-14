# AGENTS - Auth Module

Contexto operativo para agentes IA que trabajen dentro de `src/modules/auth`.

## Objetivo del modulo

Este modulo contiene la capa de autenticacion visible para usuario final:

- Pagina de login
- Pagina de registro
- Flujos de entrada hacia rutas protegidas

## Archivos clave

- `src/modules/auth/pages/Login/Login.tsx`
- `src/modules/auth/pages/Register/Register.tsx`
- `src/hooks/useAuth.tsx`
- `src/store/authStore.tsx`
- `src/routes/Guard.tsx`
- `src/routes/NoGuard.tsx`

## Reglas del modulo

1. La fuente de verdad de auth es `authStore` + `useAuth`.
2. No usar `localStorage` directo desde este modulo.
3. Todo texto visible debe usar `t("auth:key")`.
4. Si se agregan nuevas claves de auth, mapear en:
   - `src/translate/es/auth.json`
   - `src/translate/en/auth.json`
5. Login/Register deben mantener redireccion controlada (actualmente a `/`).
6. Si agregas llamadas HTTP de auth, usar `mainInstance` o `createApiInstance`.

## Skill obligatoria para componentes

- Skill: `create-component`
- Ruta: `skills/create-component/SKILL.md` (relativa a la base del proyecto)

Si se crea o modifica un componente en este modulo, se deben seguir los lineamientos de esa skill.
