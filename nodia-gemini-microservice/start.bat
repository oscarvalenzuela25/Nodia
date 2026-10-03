@echo off
title Nodia Gemini Microservice
echo =======================================================
echo    Iniciando Nodia Gemini Microservice (Gemini Pro)
echo =======================================================

cd /d "%~dp0"
if errorlevel 1 exit /b 1

if not exist ".venv\Scripts\python.exe" (
    echo Entorno virtual no encontrado. Creando entorno virtual .venv...
    python -m venv .venv
    if errorlevel 1 exit /b 1
    echo Instalando dependencias desde requirements.txt...
    .\.venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 exit /b 1
    .\.venv\Scripts\python.exe -m playwright install chromium
    if errorlevel 1 exit /b 1
)

if not exist ".env" (
    echo Archivo .env no encontrado. Creando desde .env.example...
    copy .env.example .env
    if errorlevel 1 exit /b 1
    echo Configura GEMINI_SERVICE_TOKEN en .env antes de iniciar el servicio.
    pause
    exit /b 1
)

echo Iniciando servidor FastAPI con Uvicorn...
.\.venv\Scripts\python.exe run.py
if errorlevel 1 (
    echo El microservicio no pudo iniciarse. Revisa el error anterior.
    pause
    exit /b 1
)

pause
