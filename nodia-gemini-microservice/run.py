import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "127.0.0.1")
    print(f"=======================================================")
    print(f"  Iniciando Nodia Gemini Microservice en http://{host}:{port}")
    print("  Documentación HTTP protegida por token de servicio")
    print(f"=======================================================")
    # Locks, session and admission are process-local. Override WEB_CONCURRENCY.
    uvicorn.run("main:app", host=host, port=port, workers=1, reload=False)
