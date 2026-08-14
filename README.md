# Nodia

Nodia es una aplicacion organizada en varios proyectos independientes dentro de un mismo repositorio. La raiz centraliza los comandos de desarrollo para que no sea necesario entrar manualmente en cada carpeta.

Actualmente el repositorio contiene solo el cliente web. En el futuro se incorporara un servidor siguiendo la misma estructura.

## Proyectos

```text
Nodia/
├── nodia-client/   # Cliente web
├── package.json    # Comandos centralizados
└── README.md
```

### Cliente

Aplicacion web construida con:

- React
- TypeScript
- Vite
- Material UI
- React Router
- TanStack Query
- Zustand
- i18next

La documentacion tecnica y las decisiones de arquitectura del cliente se encuentran en [`nodia-client/README.md`](./nodia-client/README.md).

## Requisitos

- Node.js 24.11.0 o superior
- npm

Puedes comprobar las versiones instaladas con:

```bash
node --version
npm --version
```

## Instalacion

Clona el repositorio, entra en su carpeta e instala las dependencias de todos los proyectos registrados:

```bash
npm run setup
```

Por ahora este comando instala unicamente las dependencias de `nodia-client`. Cuando se agreguen nuevos proyectos, sus instalaciones se incorporaran al script `setup`.

## Comandos desde la raiz

Todos los comandos siguientes se ejecutan desde la carpeta raiz del repositorio.

| Comando | Descripcion |
| --- | --- |
| `npm run setup` | Instala las dependencias de los proyectos internos. |
| `npm run dev` | Inicia el cliente en modo desarrollo. |
| `npm run build` | Comprueba los tipos y genera el build de produccion del cliente. |
| `npm run typecheck` | Comprueba los tipos de TypeScript. |
| `npm run lint` | Ejecuta ESLint en el cliente. |
| `npm run preview` | Sirve localmente el build de produccion. |

Tambien existen comandos explicitos por proyecto:

```bash
npm run install:client
npm run dev:client
npm run build:client
npm run typecheck:client
npm run lint:client
npm run preview:client
```

## Inicio rapido

```bash
npm run setup
npm run dev
```

Vite mostrara en la terminal la URL local en la que se encuentra disponible el cliente.

## Variables de entorno

Crea `nodia-client/.env` a partir del archivo de ejemplo:

```bash
cp nodia-client/.env.example nodia-client/.env
```

En PowerShell puedes usar:

```powershell
Copy-Item nodia-client/.env.example nodia-client/.env
```

Variable disponible actualmente:

| Variable | Descripcion |
| --- | --- |
| `VITE_API_URL` | URL base de la API que consumira el cliente. |

## Incorporar el servidor en el futuro

La organizacion no depende de herramientas de monorepo. Cada proyecto conserva su propio `package.json` y la raiz delega los comandos mediante `npm --prefix`.

Al crear, por ejemplo, una carpeta `nodia-server`, se pueden agregar scripts equivalentes en el `package.json` raiz:

```json
{
  "scripts": {
    "install:server": "npm install --prefix nodia-server",
    "dev:server": "npm run dev --prefix nodia-server",
    "build:server": "npm run build --prefix nodia-server"
  }
}
```

Despues se deben actualizar los comandos generales (`setup`, `dev` y `build`) para incluir ambos proyectos.
