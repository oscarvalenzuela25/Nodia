@echo off
title Login Google Gemini Pro - Nodia
echo =======================================================
echo    Login Interactivo de Gemini Pro con Playwright
echo =======================================================

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Entorno virtual no encontrado. Creando entorno virtual .venv...
    python -m venv .venv
    .\.venv\Scripts\pip install -r requirements.txt
    .\.venv\Scripts\playwright install chromium
)

echo Abriendo navegador para iniciar sesion...
.\.venv\Scripts\python.exe auth.py

echo.
pause
