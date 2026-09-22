import json
import os
import shutil
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from pydantic import BaseModel

# Load environment variables from .env
load_dotenv()

from gemini_service import GeminiWebService

gemini_service = GeminiWebService()
TEMP_DIR = Path("temp_uploads")
TEMP_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Nodia Gemini Microservice...")
    try:
        await gemini_service.init_client()
    except Exception as e:
        logger.warning(f"Initial Gemini connection failed (check cookies in .env): {e}")
    yield
    logger.info("Shutting down Nodia Gemini Microservice...")
    await gemini_service.close()
    if TEMP_DIR.exists():
        try:
            shutil.rmtree(TEMP_DIR)
        except Exception:
            pass


app = FastAPI(
    title="Nodia Gemini Microservice",
    description="Microservicio FastAPI para procesamiento multimodal de facturas con Gemini Web API (Gemini Pro)",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for Nodia backend (NestJS: 3000) and frontend (Vite: 5174)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GeneratePromptRequest(BaseModel):
    prompt: str


@app.get("/", tags=["Health"])
@app.get("/health", tags=["Health"])
async def health_check():
    """Verifica el estado del microservicio y la conexión con Gemini Pro."""
    status_info = await gemini_service.get_status()
    return {
        "service": "nodia-gemini-microservice",
        "status": "healthy" if status_info["initialized"] else "pending_auth",
        "gemini": status_info,
    }


@app.get("/auth/status", tags=["Authentication"])
async def auth_status():
    """Retorna el estado de autenticación de Gemini y el perfil del navegador."""
    status_info = await gemini_service.get_status()
    return {
        "authenticated": status_info["initialized"],
        "has_cookies": status_info["has_cookies"],
        "has_browser_profile": status_info["has_browser_profile"],
        "last_refresh_time": status_info["last_refresh_time"],
        "tier": status_info["tier"],
        "model": status_info.get("model", "gemini-flash"),
        "model_display": status_info.get("model_display", "3.8 Flash"),
    }


@app.post("/auth/login", tags=["Authentication"])
async def interactive_login():
    """
    Abre una ventana visible de Google Chrome para que el usuario inicie sesión
    en su cuenta de Google. Extrae automáticamente las cookies y las guarda.
    """
    logger.info("Triggered interactive browser login from API...")
    result = await gemini_service.browser_manager.login_interactive(timeout_seconds=300)
    if result["success"]:
        cookies = result.get("cookies", {})
        if cookies.get("secure_1psid") and cookies.get("secure_1psidts"):
            await gemini_service.reload_cookies(cookies["secure_1psid"], cookies["secure_1psidts"])
        return {
            "status": "success",
            "message": "Autenticación completada exitosamente.",
            "initialized": gemini_service.is_initialized,
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "No se completó la autenticación."),
        )


@app.post("/auth/refresh", tags=["Authentication"])
async def refresh_auth():
    """
    Ejecuta una renovación silenciosa (headless) de cookies usando el perfil guardado.
    """
    if not gemini_service.browser_manager.has_profile():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No existe un perfil de navegador guardado. Realice primero un login interactivo en /auth/login.",
        )

    refreshed = await gemini_service.browser_manager.refresh_cookies_headless()
    if refreshed:
        await gemini_service.reload_cookies(refreshed["secure_1psid"], refreshed["secure_1psidts"])
        return {
            "status": "success",
            "message": "Cookies renovadas exitosamente en segundo plano.",
            "initialized": gemini_service.is_initialized,
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudieron renovar las cookies automáticamente. La sesión puede haber expirado en Google.",
        )


@app.post("/analyze-invoice", tags=["Invoice OCR"])
async def analyze_invoice(
    file: UploadFile = File(..., description="Documento o imagen de la factura (PDF, JPG, PNG, WEBP)"),
    provider_fields: Optional[str] = Form(
        None,
        description="JSON opcional con campos o reglas del proveedor",
    ),
    provider_tax: Optional[int] = Form(
        None,
        description="Porcentaje de impuesto (tax) del proveedor (default 19)",
    ),
):
    """
    Analiza un archivo de factura comercial utilizando Gemini Pro y extrae
    código de comprobante, monto total, fecha de emisión y listado de ítems.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionó un nombre de archivo válido.",
        )

    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    allowed_extensions = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de archivo no soportado ({ext}). Formatos permitidos: {', '.join(allowed_extensions)}",
        )

    temp_path = TEMP_DIR / f"{os.getpid()}_{file.filename}"

    try:
        # Save uploaded file temporarily
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Parse provider_fields if sent as JSON string
        parsed_fields = None
        if provider_fields:
            try:
                parsed_fields = json.loads(provider_fields)
            except Exception:
                parsed_fields = {"raw": provider_fields}

        result = await gemini_service.analyze_invoice(
            file_path=temp_path,
            provider_fields=parsed_fields,
            provider_tax=provider_tax,
        )

        return JSONResponse(content=result)

    except Exception as e:
        logger.error(f"Error analizando factura con Gemini: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analizando factura: {str(e)}",
        )

    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass


@app.post("/generate", tags=["General"])
async def generate_text(request: GeneratePromptRequest):
    """Genera texto o responde una consulta libre utilizando Gemini Pro."""
    try:
        response_text = await gemini_service.generate_text(prompt=request.prompt)
        return {"response": response_text}
    except Exception as e:
        logger.error(f"Error generando texto con Gemini: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@app.post("/refresh-session", tags=["Auth"])
async def refresh_session():
    """Fuerza la reconexión de sesión con Gemini utilizando los cookies actuales del archivo .env."""
    try:
        await gemini_service.init_client(force_refresh=True)
        status_info = await gemini_service.get_status()
        return {
            "message": "Sesión de Gemini Pro reconectada exitosamente.",
            "status": status_info,
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"No se pudo autenticar con las cookies proporcionadas: {str(e)}",
        )
