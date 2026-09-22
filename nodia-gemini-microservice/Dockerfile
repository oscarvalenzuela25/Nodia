FROM mcr.microsoft.com/playwright/python:v1.50.0-noble

WORKDIR /app

# Evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Instalar dependencias del proyecto
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p browser_profile temp_uploads

# Exponer puerto FastAPI
EXPOSE 8000

# Comando de inicio
CMD ["python", "run.py"]
