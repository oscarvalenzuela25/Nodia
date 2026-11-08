FROM python:3.12-slim-bookworm@sha256:6dd8b6dab6b3adc7812bab69eca5dbdc1a5cc690ad28306d234ffb4ef8ac9753

WORKDIR /app

# Evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Native CLI runtime and the isolated attachment decoder. No browser/display.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libstdc++6 libseccomp2 && \
    rm -rf /var/lib/apt/lists/*

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
    mkdir -p session_state temp_uploads /home/nodia/agentic_profile /run/nodia-login-cgroups && \
    chown nodia:nodia /run/nodia-login-cgroups && \
    chown nodia:nodia /home/nodia/agentic_profile && \
    chown -R nodia:nodia /app

USER nodia

# Exponer puerto FastAPI
EXPOSE 8000

# Comando de inicio
CMD ["python", "run.py"]
