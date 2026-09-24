import os
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"=======================================================")
    print(f"  Iniciando Nodia Gemini Microservice en http://{host}:{port}")
    print(f"  Documentación Swagger en http://localhost:{port}/docs")
    print(f"=======================================================")
    uvicorn.run("main:app", host=host, port=port)
