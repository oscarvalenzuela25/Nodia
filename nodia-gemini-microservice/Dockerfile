FROM mcr.microsoft.com/playwright/python:v1.63.0-noble@sha256:72bd171a9ffc2b4b59532aaa6210e21014d07093120dc25528870c0b840da1f0

WORKDIR /app

# Evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Instalar dependencias del proyecto
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN useradd --uid 10001 --create-home nodia && \
    mkdir -p browser_profile session_state temp_uploads && \
    chown -R nodia:nodia /app

USER nodia

# Exponer puerto FastAPI
EXPOSE 8000

# Comando de inicio
CMD ["python", "run.py"]
