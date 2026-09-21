# Nodia Gemini Microservice (Gemini Pro Web API)

Microservicio en Python (FastAPI + Uvicorn) que permite interactuar con **Google Gemini Pro** utilizando las credenciales de sesión (`__Secure-1PSID` y `__Secure-1PSIDTS`) de tu cuenta de Google con plan Pro/Advanced activo, permitiendo análisis multimodal de facturas y OCR estructurado sin incurrir en costos por token de la API oficial.

---

## 📁 Estructura del Proyecto

```
nodia-gemini-microservice/
├── .venv/                   # Entorno virtual Python (ignorado por git)
├── .env                     # Variables de entorno y cookies de sesión
├── .env.example             # Plantilla de configuración
├── .gitignore               # Configuración de exclusiones git
├── requirements.txt         # Dependencias congeladas
├── main.py                  # Servidor y rutas FastAPI (CORS, upload, endpoints)
├── gemini_service.py        # Adaptador del cliente Gemini Web API con auto-refresh
├── run.py                   # Script de inicio con Uvicorn
├── start.bat                # Lanzador directo para Windows
└── README.md                # Esta documentación
```

---

## 🚀 Requisitos Previos

- **Python 3.11 o superior** (verificado con Python 3.13.1).
- Cuenta de Google con acceso a [gemini.google.com](https://gemini.google.com) (plan Pro / Gemini Advanced).

---

## ⚙️ Instalación y Configuración

### 1. Entorno Virtual y Dependencias

Si clonas el proyecto o es la primera vez que lo levantas:

```powershell
# En Windows (PowerShell):
cd nodia-gemini-microservice
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
```

### 2. Configuración de Variables de Entorno (`.env`)

Copia el archivo de ejemplo o edita `.env`:

```ini
PORT=8000
HOST=0.0.0.0

# Cookies extraídas de https://gemini.google.com/
GEMINI_SECURE_1PSID=tu_1PSID_aqui
GEMINI_SECURE_1PSIDTS=tu_1PSIDTS_aqui
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

El microservicio se iniciará en **`http://localhost:8000`**.

---

## 📖 Documentación Interactiva (Swagger / OpenAPI)

Una vez iniciado, accede a la documentación interactiva en tu navegador:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📡 Endpoints de la API

### 1. `GET /health`
Verifica el estado del servicio y si la sesión con Gemini Pro está activa.

**Respuesta:**
```json
{
  "service": "nodia-gemini-microservice",
  "status": "healthy",
  "gemini": {
    "initialized": true,
    "has_cookies": true,
    "tier": "PRO"
  }
}
```

---

### 2. `POST /analyze-invoice`
Analiza un archivo de factura o boleta (PDF, PNG, JPG, JPEG, WEBP) mediante Gemini Pro y devuelve los campos estructurados.

- **Content-Type:** `multipart/form-data`
- **Parámetros:**
  - `file`: Archivo binario (requerido).
  - `provider_fields`: JSON string opcional con mapeo o reglas del proveedor.

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
        "quantity": 24,
        "unit_price": 1200,
        "total_price": 28800
      }
    ]
  }
}
```

---

### 3. `POST /generate`
Envía un prompt de texto libre a Gemini Pro.

- **Content-Type:** `application/json`
- **Body:**
```json
{
  "prompt": "Explica la diferencia entre costo neto y costo bruto"
}
```

---

### 4. `POST /refresh-session`
Fuerza una recarga y autenticación inmediata de los cookies configurados en `.env` sin necesidad de reiniciar el proceso.

---

## 🔑 Cómo Obtener y Renovar las Cookies de Gemini

La librería `gemini-webapi` incluye **rotación automática de cookies en segundo plano** cada 10 minutos para mantener la sesión viva. Sin embargo, si cierras sesión en tu navegador o Google invalida la sesión, deberás renovarlas:

1. Inicia sesión en [gemini.google.com](https://gemini.google.com) con tu cuenta de Google Pro.
2. Abre las herramientas de desarrollador (**F12** o clic derecho $\rightarrow$ **Inspeccionar**).
3. Ve a la pestaña **Application** (o **Almacenamiento** en Firefox).
4. En el menú lateral izquierdo, despliega **Cookies** $\rightarrow$ `https://gemini.google.com`.
5. Copia los valores de:
   - `__Secure-1PSID` (o `1PSID`)
   - `__Secure-1PSIDTS` (o `1PSIDTS`)
6. Pégalos en el archivo `.env` en `nodia-gemini-microservice/.env`.
7. Ejecuta una petición `POST http://localhost:8000/refresh-session` o reinicia el microservicio.
