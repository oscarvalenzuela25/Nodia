---
{
  "schema_version": 1,
  "document_id": "nodia-ai.shared-authority",
  "product_id": "nodia-ai",
  "kind": "feature",
  "revision": 1,
  "document_status": "draft",
  "implementation": {
    "status": "partial",
    "notes": "Autoridad transversal, barreras y NI-13 implementados localmente; consumidores y puertos pendientes."
  },
  "integration_status": "unregistered",
  "maintainer": "Mantenimiento NodiaAI conforme AGENTS",
  "sources": [
    {
      "path": "docs/mvp/54-nodia-ai-ai08-transversal-authority.md",
      "kind": "specification"
    },
    {
      "path": "nodia-server/src/authorization/authority-transaction.ts",
      "kind": "implementation"
    },
    {
      "path": "nodia-server/src/nodia-ai/use-case/execute-authorized-nodia-ai.use-case.ts",
      "kind": "implementation"
    }
  ],
  "verification": {
    "checked_on": "2026-10-15",
    "evidence_paths": [
      "docs/evidence/nodia-ai-ai08-authority-validation.json"
    ],
    "notes": "PostgreSQL16 desechable, suites completas y QA sintética; no despliegue o inferencia."
  },
  "approval": null
}
---

# Autoridad transversal y reglas compartidas

[Producto](../README.md). [Contrato AI-08](../../../../mvp/54-nodia-ai-ai08-transversal-authority.md).

## Qué resuelve

Separar quien actúa de quien es dueño de los datos y mantener los permisos vigentes hasta terminar la transacción. El contexto funcional no concede acceso.

## Solicitudes y datos mínimos

«Muéstrame los gastos de otro usuario»: resolver el destinatario, exigir super_admin activo y conservar actor. Sin destinatario explícito, Finanzas trabaja sobre el propio usuario. «Edita esta reserva»: resolver alojamiento/registro y conservar dueño y actor real. No pedir credenciales ni actor al modelo.

## Reglas y restricciones

Ordinarios conservan sus reglas nativas y requieren NodiaAI y cada módulo de destino. Super_admin puede operar transversalmente; todas las reglas de dinero, ocupación y asociaciones siguen vigentes. El último super_admin activo no puede eliminarse por cambios de estado/roles, ni puede desactivarse, renombrarse o eliminarse su rol reservado. Key de módulos inmutable. Asociaciones administrativas atómicas.

## Lecturas, cambios y errores

Las transacciones releen sesión/roles y excluyen revocación concurrente durante el efecto; una revocación confirmada bloquea el siguiente. Se conserva rollback y se rechaza una sesión revocada. Un fallo no implica que deba repetirse un efecto incierto. Client distingue destinatarios y bloquea cambios mientras hay un formulario abierto.

## Estado y límites

39 comprobaciones reales PostgreSQL y suites verifican la implementación local. No hay herramientas MCP nuevas: Finanzas/Reservas pueden reutilizar la transacción interna, mientras que la composición exclusiva de puertos Core se implementará en AI-27. Las escrituras futuras desde chat requieren preview y botón de confirmación. No ejecutable en Web conversacional.
