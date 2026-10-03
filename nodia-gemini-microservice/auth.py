import argparse
import asyncio
import sys
from loguru import logger
from browser_manager import BrowserCookieManager
from gemini_webapi import GeminiClient
from dotenv import load_dotenv
import os


async def main():
    load_dotenv()
    parser = argparse.ArgumentParser(
        description="Utilidad de autenticación de Gemini Pro con Playwright para Nodia."
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Ejecuta la renovación de cookies en segundo plano (sin abrir ventana de navegador).",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Verifica el estado actual de las credenciales y la conexión con Gemini.",
    )
    args = parser.parse_args()

    manager = BrowserCookieManager()

    if args.status:
        psid = os.getenv("GEMINI_SECURE_1PSID", "").strip()
        psidts = os.getenv("GEMINI_SECURE_1PSIDTS", "").strip()
        has_profile = manager.has_profile()

        model_env = os.getenv("GEMINI_MODEL", "").strip()
        model_display = model_env or "Sin modelo asignado"
        logger.info("--- Estado de Autenticación Gemini ---")
        logger.info(f"¿Tiene cookies en .env?: {'Sí' if psid and psidts else 'No'}")
        logger.info(f"¿Existe perfil de navegador guardado?: {'Sí' if has_profile else 'No'}")
        logger.info(f"Modelo configurado: {model_env} ({model_display})")

        if psid and psidts:
            logger.info("Probando conexión con Google Gemini...")
            client = None
            try:
                client = GeminiClient(psid, psidts)
                await client.init(timeout=30)
                logger.success("¡Autenticación VÁLIDA y operativa con Gemini Pro!")
            except Exception as e:
                logger.error("La sesión no pudo verificarse: {}", type(e).__name__)
                if has_profile:
                    logger.info("Puedes ejecutar: python auth.py --headless para intentar renovarlas automáticamente.")
                else:
                    logger.info("Ejecuta: python auth.py para iniciar sesión nuevamente.")
            finally:
                if client is not None:
                    await client.close()
        return

    if args.headless:
        if not manager.has_profile():
            logger.error("No existe un perfil de navegador guardado en 'browser_profile/'.")
            logger.info("Ejecuta primero 'python auth.py' (sin --headless) para iniciar sesión.")
            sys.exit(1)

        logger.info("Iniciando renovación silenciosa de cookies (modo Headless)...")
        cookies = await manager.refresh_cookies_headless()
        if cookies:
            logger.success("¡Cookies renovadas con éxito y guardadas en .env!")
        else:
            logger.error("No se pudieron renovar las cookies en modo headless. Inicia sesión interactivamente con 'python auth.py'.")
            sys.exit(1)
        return

    # Modo Interactivo (por defecto)
    logger.info("==========================================================")
    logger.info("   INICIO DE SESIÓN EN GOOGLE GEMINI PRO (PLAYWRIGHT)     ")
    logger.info("==========================================================")
    logger.info("Se abrirá una ventana de Chrome.")
    logger.info("Inicia sesión en tu cuenta de Google en https://gemini.google.com.")
    logger.info("Una vez logueado, las cookies se extraerán y guardarán automáticamente.")
    logger.info("----------------------------------------------------------")

    result = await manager.login_interactive(timeout_seconds=300)
    if result["success"]:
        logger.success("==========================================================")
        logger.success(" ¡LOGIN COMPLETADO EXITOSAMENTE! ")
        logger.success(" Las credenciales fueron guardadas en .env y tu sesión quedó")
        logger.success(" guardada en 'browser_profile/' para renovaciones automáticas.")
        logger.success("==========================================================")
    else:
        logger.error(f"Error: {result.get('message')}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
