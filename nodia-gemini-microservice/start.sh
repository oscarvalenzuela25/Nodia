#!/bin/bash
set -Eeuo pipefail
echo "======================================================="
echo "   Iniciando Nodia Gemini Microservice (Gemini Pro)   "
echo "======================================================="

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Determinar comando de python3
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    printf 'Error: Python no está instalado.\n' >&2
    exit 1
fi

if [ ! -f ".venv/bin/python" ]; then
    echo "Entorno virtual no encontrado. Creando entorno virtual .venv..."
    "$PYTHON_CMD" -m venv .venv
    echo "Instalando dependencias desde requirements.txt..."
    ./.venv/bin/python -m pip install -r requirements.txt
    ./.venv/bin/python -m playwright install chromium
fi

if [ ! -f ".env" ]; then
    echo "Archivo .env no encontrado. Creando desde .env.example..."
    cp .env.example .env
    chmod 600 .env
    printf 'Configura GEMINI_SERVICE_TOKEN en .env antes de iniciar el servicio.\n' >&2
    exit 1
fi

echo "Iniciando servidor FastAPI con Uvicorn..."
exec ./.venv/bin/python run.py
