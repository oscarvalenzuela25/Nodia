---
{
  "schema_version": 1,
  "document_id": "general-settings.ai-login-host-setup",
  "product_id": "general-settings",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Existing login contracts preserved; target infrastructure active, keyring/native/HTTP verified. Codex and Antigravity human logins reported successful; inference remains pending."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento de Ajustes Generales conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/ai-provider-feature-contract.md",
      "kind": "specification"
    },
    {
      "path": "docs/mvp/99-production-deployment-and-cicd-plan.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/common/ai/codex/codex-contract.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/common/ai/gemini.service.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-11-12",
    "evidence_paths": [
      "docs/evidence/production-ai-login-live-20261112-r01.json"
    ],
    "notes": "Account-free Linux/PID1/kernel and live infrastructure checks; Both logins confirmed by user; no independent account read or inference requested."
  },
  "approval": null
}
---

# Infraestructura del login IA en el VPS

El login de acceso a Nodia y el login de sus proveedores son sesiones distintas.
Para conectar Codex o Antigravity, el usuario autorizado necesita primero que el
host disponga del runtime, almacenamiento privado y contención correspondientes.
Esta preparación técnica no inicia sesión ni concede permisos de negocio.

Codex mantiene perfiles por conexión y un keyring estricto. Antigravity utiliza
el perfil compartido existente; otro ID de conexión no crea otra cuenta/cuota.
Las credenciales permanecen en el servidor bajo sus usuarios de servicio; no
se envían a esta conversación, al repositorio o al frontend como tokens.

| Solicitud | Respuesta o flujo seguro |
| --- | --- |
| «No puedo conectar Codex» | Revisar estado de runtime/keyring; informar indisponibilidad real y remitir al operador si falta infraestructura |
| «Quiero conectar Gemini Agentic» | Usar el formulario y enlace oficiales; el operador debe habilitar antes el adaptador privado |
| «¿Conectado significa que ya funcionan todos los modelos?» | No; autenticación, catálogo e inferencia se califican por separado |
| «Inicia sesión con mi contraseña aquí» | Remitir al flujo oficial; no solicitar ni guardar contraseña/código en el chat |

Sin herramientas nuevas, login autónomo desde NodiaAI ni bypass de ownership.
Infraestructura VPS activa; Codex y Antigravity conectados según pruebas humanas del usuario.
La calificación de inferencia sigue pendiente. No habilita chat, OCR, adjuntos, Teacher o MCP por una ficha.

[Contrato](../../../../mvp/ai-provider-feature-contract.md) y
[procedimiento](../../../../../ops/production/ai-runtime/README.md).
