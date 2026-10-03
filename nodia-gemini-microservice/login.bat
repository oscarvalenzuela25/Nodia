@echo off
title Login Google Gemini Pro - Nodia
echo =======================================================
echo    Login Interactivo de Gemini Pro con Playwright
echo =======================================================

cd /d "%~dp0"
if errorlevel 1 exit /b 1

if not exist ".venv\Scripts\python.exe" (
    echo Entorno virtual no encontrado. Creando entorno virtual .venv...
    python -m venv .venv
    if errorlevel 1 exit /b 1
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 exit /b 1
)
.\.venv\Scripts\python.exe -m playwright install chromium
if errorlevel 1 exit /b 1

if not exist ".env" (
    copy .env.example .env
    if errorlevel 1 exit /b 1
)

echo Abriendo navegador para iniciar sesion...
.\.venv\Scripts\python.exe auth.py
if errorlevel 1 (
    pause
    exit /b 1
)

echo.
pause
