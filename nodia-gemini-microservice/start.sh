#!/bin/bash
echo "======================================================="
echo "   Iniciando Nodia Gemini Microservice (Gemini Pro)   "
echo "======================================================="

cd "$(dirname "$0")"

# Determinar comando de python3
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    PYTHON_CMD="python"
fi

if [ ! -f ".venv/bin/python" ]; then
    echo "Entorno virtual no encontrado. Creando entorno virtual .venv..."
    $PYTHON_CMD -m venv .venv
    echo "Instalando dependencias desde requirements.txt..."
    ./.venv/bin/pip install --upgrade pip
    ./.venv/bin/pip install -r requirements.txt
fi

if [ ! -f ".env" ]; then
    echo "Archivo .env no encontrado. Creando desde .env.example..."
    cp .env.example .env
    echo "IMPORTANTE: Edita .env con tus cookies de Gemini antes de continuar."
fi

echo "Iniciando servidor FastAPI con Uvicorn..."
./.venv/bin/python run.py
