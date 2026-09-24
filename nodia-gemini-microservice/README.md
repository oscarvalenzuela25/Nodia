# Nodia Gemini Microservice (Gemini Pro Web API)

Microservicio en Python (FastAPI + Uvicorn) que permite interactuar con **Google Gemini Pro** utilizando las credenciales de sesión (`__Secure-1PSID` y `__Secure-1PSIDTS`) de tu cuenta de Google con plan Pro/Advanced activo, permitiendo análisis multimodal de facturas y OCR estructurado sin incurrir en costos por token de la API oficial.

Cuenta con **automatización integral de sesión mediante Playwright**:
- Perfil de navegador persistente (`browser_profile/`).
- Inicio de sesión interactivo de 1 clic (`auth.py` / `login.bat` / `POST /auth/login`).
- Rotación automática de cookies por `gemini-webapi`, con persistencia en `session_state/` para reinicios.
- Recuperación mediante el perfil de Playwright ante `AuthError` y ante rechazos de adjuntos. Si el perfil expiró, se requiere un nuevo login interactivo.
- NestJS utiliza exclusivamente este microservicio para Gemini; no se requiere `GEMINI_API_KEY`.

---

## 📁 Estructura del Proyecto

```text
nodia-gemini-microservice/
├── .venv/                   # Entorno virtual Python (ignorado por git)
├── .env                     # Variables de entorno y cookies de sesión
├── .env.example             # Plantilla de configuración
├── browser_profile/         # Perfil persistente de Chrome para Playwright (ignorado por git)
├── session_state/           # Cookies rotadas y caché de sesión (ignorado por git)
├── requirements.txt         # Dependencias congeladas (incluye Playwright)
├── browser_manager.py       # Gestor de Playwright (login interactivo y refresh headless)
├── auth.py                  # Script CLI para autenticación y verificación de cookies
├── login.bat                # Lanzador de 1 clic para login interactivo en Windows
├── login.sh                 # Lanzador de 1 clic para login interactivo en macOS/Linux
├── gemini_service.py        # Adaptador del cliente Gemini Web API con auto-recovery
├── main.py                  # Servidor y rutas FastAPI (CORS, upload, auth, endpoints)
├── run.py                   # Script de inicio con Uvicorn
├── start.bat                # Lanzador directo del servidor para Windows
└── README.md                # Esta documentación
```

---

## 🚀 Requisitos Previos

- **Python 3.11 o superior** (verificado con Python 3.13.1).
- Cuenta de Google con acceso a [gemini.google.com](https://gemini.google.com) (plan Pro / Gemini Advanced).
- Navegador Google Chrome instalado en tu sistema (o Chromium descargado automáticamente por Playwright).

---

## ⚙️ Instalación y Configuración

### 1. Entorno Virtual y Dependencias

Si es la primera vez que levantas el proyecto:

```powershell
# En Windows (PowerShell):
cd nodia-gemini-microservice
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\playwright install chromium
```

### 2. Autenticación de 1 Clic (Playwright)

**¡Ya no necesitas copiar y pegar cookies manualmente desde DevTools (F12)!**

Ejecuta el script de autenticación interactiva:

- **En Windows:** Haz doble clic en `login.bat` o ejecuta:
  ```powershell
  .\.venv\Scripts\python.exe auth.py
  ```
- **En macOS / Linux:**
  ```bash
  chmod +x login.sh
  ./login.sh
  ```

Se abrirá una ventana de Chrome navegando a `https://gemini.google.com`. Inicia sesión con tu cuenta de Google. Playwright guardará las cookies iniciales en `.env` y el perfil en `browser_profile/`. El servicio guardará las cookies renovadas en `session_state/`. Conserva este directorio entre reinicios y no lo subas a Git.

### 3. Selección de Modelo Web (`GEMINI_MODEL`)

En tu archivo `.env` puedes especificar el modelo de Gemini Web a utilizar:
- `gemini-flash` (*Por defecto*): **Gemini 3.8 Flash** (~48.300 créditos/día, ultra rápido y preciso para facturas).
- `gemini-pro`: **Gemini 3.1 Pro** (~2.400 créditos/día, razonamiento avanzado para facturas complejas).
- `gemini-flash-lite`: **Gemini 3.5 Flash-Lite** (respuestas ultralivianas).

```env
GEMINI_MODEL=gemini-flash
```

---

## ▶️ Cómo Ejecutar el Microservicio

### Opción 1: Mediante el script directo para Windows
Haz doble clic en `start.bat` o ejecútalo desde el terminal:
```cmd
start.bat
```

### Opción 2: Mediante Python en el entorno virtual
```powershell
.\.venv\Scripts\python.exe run.py
```

El microservicio se iniciará en **`http://localhost:8000`**. `run.py` usa un solo proceso sin recarga automática para mantener la sesión en memoria. Después de cambiar código, reinicia el servicio; un nuevo login en `.env` se detecta en la siguiente solicitud.

---

## 📖 Documentación Interactiva (Swagger / OpenAPI)

Una vez iniciado, accede a la documentación interactiva en tu navegador:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 Endpoints de la API

### 1. `GET /health` y `GET /auth/status`
Verifica el estado del servicio, si las cookies están cargadas, el modelo configurado y si existe un perfil de navegador para renovaciones.

**Respuesta de `/auth/status`:**
```json
{
  "authenticated": true,
  "has_cookies": true,
  "has_browser_profile": true,
  "last_refresh_time": 1740000000.0,
  "tier": "PRO",
  "model": "gemini-flash",
  "model_display": "3.8 Flash"
}
```

---

### 2. `POST /auth/login`
Abre la ventana interactiva de Chrome para iniciar sesión si no se desea usar la consola.

---

### 3. `POST /auth/refresh`
Ejecuta una renovación silenciosa (**Headless**) de cookies en segundo plano utilizando el perfil guardado.

---

### 4. `POST /analyze-invoice`
Analiza un archivo de factura o boleta (PDF, PNG, JPG, JPEG, WEBP) mediante Gemini Pro y devuelve los campos estructurados.
Si durante la llamada las cookies vencen, el microservicio ejecuta automáticamente una renovación headless y reintenta la extracción de inmediato.

- **Content-Type:** `multipart/form-data`
- **Parámetros:**
  - `file`: Archivo binario (requerido).
  - `provider_fields`: JSON string opcional con mapeo e instrucciones del proveedor.
  - `provider_tax`: Entero opcional con porcentaje de impuesto (default 19).

**Ejemplo de Respuesta:**
```json
{
  "code": "097514959",
  "total_amount": 294467,
  "data": {
    "issue_date": "2026-09-15",
    "items": [
      {
        "code": "CC-1.5L",
        "name": "Coca Cola 1.5L Retornable",
        "packages": 2,
        "units_per_package": 12,
        "quantity": 24,
        "cost_price": 1008,
        "cost_price_tax": 1200,
        "unit_price": 1200,
        "total_price": 28800
      }
    ]
  }
}
```

---

## 🛡️ Mecanismo de Auto-Recuperación y Auto-Refresh

1. **Rotación:** `gemini-webapi` intenta renovar la sesión aproximadamente cada 3 minutos. El microservicio guarda las cookies vigentes cada 15 segundos, al terminar una petición y al cerrar.
2. **Recuperación:** ante un `AuthError`, el servicio intenta actualizar las cookies desde el perfil de Playwright y reintenta una vez. Si no puede hacerlo, `/analyze-invoice` responde `503` para indicar que hace falta iniciar sesión de nuevo.
3. **Límite:** la sesión web puede ser revocada por Google; este mecanismo mejora la continuidad, pero no garantiza una sesión permanente.
