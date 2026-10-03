#!/bin/bash
set -Eeuo pipefail
echo "======================================================="
echo "   Login Interactivo de Gemini Pro con Playwright"
echo "======================================================="

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if ! command -v python3 >/dev/null 2>&1; then
    printf 'Error: python3 no está instalado.\n' >&2
    exit 1
fi

if [ ! -f ".venv/bin/python" ]; then
    echo "Entorno virtual no encontrado. Creando .venv..."
    python3 -m venv .venv
    ./.venv/bin/python -m pip install -r requirements.txt
fi
./.venv/bin/python -m playwright install chromium

if [ ! -f ".env" ]; then
    cp .env.example .env
    chmod 600 .env
fi

echo "Abriendo navegador para iniciar sesion..."
exec ./.venv/bin/python auth.py
