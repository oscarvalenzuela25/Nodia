#!/bin/bash
echo "======================================================="
echo "   Login Interactivo de Gemini Pro con Playwright"
echo "======================================================="

cd "$(dirname "$0")"

if [ ! -f ".venv/bin/python" ]; then
    echo "Entorno virtual no encontrado. Creando .venv..."
    python3 -m venv .venv
    ./.venv/bin/pip install -r requirements.txt
    ./.venv/bin/playwright install chromium
fi

echo "Abriendo navegador para iniciar sesion..."
./.venv/bin/python auth.py
