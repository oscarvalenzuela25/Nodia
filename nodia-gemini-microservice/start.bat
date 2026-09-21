@echo off
title Nodia Gemini Microservice
echo =======================================================
echo    Iniciando Nodia Gemini Microservice (Gemini Pro)
echo =======================================================

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo Entorno virtual no encontrado. Creando entorno virtual .venv...
    python -m venv .venv
    echo Instalando dependencias desde requirements.txt...
    .\.venv\Scripts\pip install -r requirements.txt
)

if not exist ".env" (
    echo Archivo .env no encontrado. Creando desde .env.example...
    copy .env.example .env
    echo IMPORTANTE: Edita .env con tus cookies de Gemini antes de continuar.
)

echo Iniciando servidor FastAPI con Uvicorn...
.\.venv\Scripts\python.exe run.py

pause
