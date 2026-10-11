# Nodia

Nodia reúne tres aplicaciones independientes en un mismo repositorio. Cada aplicación instala sus dependencias y se ejecuta desde su carpeta. La raíz conserva la documentación, las reglas del proyecto y la configuración compartida de Git y del editor.

## Estructura

```text
Nodia/
├── nodia-client/               # Frontend React + Vite + MUI
├── nodia-server/               # API NestJS + TypeORM
├── nodia-gemini-microservice/   # Adaptador privado FastAPI para Gemini
├── docs/
│   ├── mvp/                    # Producto, contratos y seguimiento
│   ├── architecture/           # Arquitectura y decisiones técnicas
│   ├── features/               # Funcionalidades y operación
│   └── evidence/               # Capturas y medidas de QA versionadas
├── AGENTS.md                   # Reglas generales del proyecto
├── .editorconfig               # Configuración compartida del editor
├── .gitattributes              # Normalización de archivos en Git
├── .gitignore                  # Exclusiones compartidas
└── README.md
```

Client y Server mantienen su propio `package.json` y `package-lock.json`; Gemini utiliza `requirements.txt` y una `.venv` local. La raíz no necesita un manifiesto npm ni una instalación adicional.

## Desarrollo local

Ejecutar cada aplicación en una terminal independiente, después de preparar su entorno.

| Aplicación | Carpeta de trabajo | Instalación | Inicio |
| --- | --- | --- | --- |
| Cliente | `nodia-client` | `npm ci` | `npm run dev` |
| API | `nodia-server` | `npm ci` | `npm run dev` |
| Gemini | `nodia-gemini-microservice` | Ver preparación Python debajo | `./.venv/Scripts/python.exe run.py` en Windows |

Requisitos: Node según el manifiesto de cada aplicación (el cliente exige `>=24.20.0`), npm y Python `>=3.11` para Gemini. La API requiere PostgreSQL y Redis configurados; el microservicio requiere el token interno compartido con la API.

Crear el `.env` de cada aplicación desde su `.env.example` únicamente cuando no exista, y completar las variables indicadas en su documentación. El cliente consume la API; Gemini es un servicio privado consumido por Nodia Server.

Preparación de Gemini en PowerShell, dentro de `nodia-gemini-microservice`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m playwright install chromium
.\.venv\Scripts\python.exe run.py
```

En Linux, el intérprete del entorno es `./.venv/bin/python`. Consultar los requisitos y límites adicionales en el README del microservicio.

## Documentación

- [Cliente: configuración y comandos](nodia-client/README.md).
- [Servidor: configuración y comandos](nodia-server/README.md).
- [Gemini: instalación, sesiones y operación](nodia-gemini-microservice/README.md).
- [MVP y contratos](docs/mvp/README.md), [progreso](docs/mvp/00-progress.md) y [decisiones técnicas](docs/architecture/decisions/).
- [Instalación de una BD vacía y bootstrap de Core](docs/mvp/database-installation.md): `npm run db:setup` desde `nodia-server`, con `BOOTSTRAP_SUPER_ADMIN_EMAIL` configurado.
- [Revisión previa al despliegue](docs/mvp/19-prelaunch-review.md) y [runbook de seguridad](docs/mvp/18-security-deployment-runbook.md).
- [Evidencia de QA conservada](docs/evidence/README.md).

## Qué pertenece a la raíz

Conservar aquí lo compartido entre aplicaciones: documentación, reglas y configuración del repositorio. El código, las migraciones, scripts, dependencias, variables de entorno y configuración de ejecución de cada aplicación pertenecen a su carpeta.

Las capturas que respaldan verificaciones documentadas se conservan en `docs/evidence/`. Los resultados temporales pueden generarse en `output/` (ignorado por Git); los logs también están ignorados. Revisar los resultados antes de trasladar evidencia a documentación, sin incluir credenciales, sesiones ni documentos reales de usuarios.
