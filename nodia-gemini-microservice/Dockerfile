FROM mcr.microsoft.com/playwright/python:v1.63.0-noble@sha256:72bd171a9ffc2b4b59532aaa6210e21014d07093120dc25528870c0b840da1f0

WORKDIR /app

# Evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Instalar dependencias del proyecto
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Reviewed official x86-64 CLI. Installation does not activate or authenticate it.
COPY antigravity-cli.lock.json .
COPY scripts/install_agentic_cli.py scripts/install_agentic_cli.py
RUN python scripts/install_agentic_cli.py --platform linux_amd64 --destination /opt/nodia/antigravity-cli/1.3.1

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN useradd --uid 10001 --create-home nodia && \
    mkdir -p browser_profile session_state temp_uploads /home/nodia/agentic_profile && \
    chown nodia:nodia /home/nodia/agentic_profile && \
    chown -R nodia:nodia /app

USER nodia

# Exponer puerto FastAPI
EXPOSE 8000

# Comando de inicio
CMD ["python", "run.py"]
