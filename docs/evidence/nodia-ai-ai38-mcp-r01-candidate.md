# AI-38 MCP R01: candidato mínimo y QA offline

Estado a las 19:10 UTC del 2026-10-20: **candidato construido y verificado sin
activación operativa por este procedimiento**. No se generó contra el proveedor.

Imagen candidata:
`sha256:b8efad6217a4f04cb135db027fd899c1826b39c3a16154cca79f1b4f0deb977e`.
Deriva directamente de la imagen operativa preservada
`sha256:0615520cd6d6682eddc08dd886d79952c80265fcf2e7814caa940b92ee8f27aa`.

- Una capa `COPY` añade únicamente `native_mcp_sessions.py` y
  `native_mcp_stdio.py`, con hashes del freeze revisado. Las otras 45 fuentes
  públicas top-level permanecen idénticas. La configuración de imagen y todas
  las capas base son idénticas; el hash de la política MCP sigue siendo
  `7820451f2eec37bfdff82b49c9f3e170cd051f9bfdde14eb119ec2d9fc1c85fc`.
- No se copió el árbol completo, `.env`, perfiles, credenciales ni tests a la
  imagen. Los 42 archivos de pruebas/fixtures se montaron aparte, de solo
  lectura. Build y QA usaron `--network=none`; QA conservó raíz de solo lectura,
  usuario 10001, tmpfs acotado y límites de CPU, memoria y procesos.
- El runner oficial de la imagen descubrió y ejecutó **442 pruebas Linux**, todas
  correctas y sin omisiones runtime, en 7,861 s. El árbol local completo verificó
  473 pruebas, con dos omisiones Windows; el filtrado local verificó 442, con esas
  dos omisiones. Estas capas no se presentan como paridad total de fuentes.
- Se excluyeron 31 pruebas de funcionalidades no incluidas en la imagen base ni
  este candidato: 15 de C03/facturas, 11 del soporte alternativo CLI/R04 y cinco
  de la clasificación de timeout exterior R05. El manifiesto conserva sus paths,
  hashes y motivos. No se alteraron assertions para obtener el resultado.
- Cinco fuentes locales diferentes se mantuvieron deliberadamente en su versión
  base: `agentic_cli.py`, `agentic_service.py`, `main.py`, `nodia_ai_chat.py` y
  `request_guard.py`. El helper local `invoice_mcp_contract.py` no forma parte del
  candidato. El cierre de dependencias de las dos fuentes cambiadas no los exige.
- Se verificaron los hashes del freeze antes del empaquetado y después de QA.
  El contenedor operativo conservó ID, imagen y fecha de inicio. Los ocho
  contenedores offline del procedimiento fueron eliminados; cero permanecieron.

El paquete local `build01` quedó parcial: el consumidor esperaba hashes también
de módulos excluidos, mientras que el freeze ya entregaba el árbol filtrado.
Se corrigió ese consumidor, conservando el intento parcial; no se construyó una
imagen ni se ejecutó nada remoto en ese intento. `build02` es el paquete cerrado.

La activación reversible y el próximo canario real son pasos separados. Estas
pruebas no acreditan disponibilidad actual de la cuenta o `supports_mcp`.

## Artefactos

- [Reporte Linux](nodia-ai-ai38-mcp-r01-candidate-build02.json).
- [Manifiesto del paquete](nodia-ai-ai38-mcp-r01-candidate-manifest02.json).
- [Freeze de fuentes y pruebas](nodia-ai-ai38-mcp-r01-candidate-source-freeze02.json).
- [Inventario público base](nodia-ai-ai38-mcp-r01-candidate-inventory.json).
- [Preparador local](scripts/nodia-ai-ai38-mcp-r01-candidate-stage.cjs).
- [Constructor y QA Linux](scripts/nodia-ai-ai38-mcp-r01-candidate-build.py).
- [Recibo de hashes](nodia-ai-ai38-mcp-r01-candidate-receipt.json).

Los logs y el diff exacto de código público se conservaron en
`/opt/nodia/verification/ai38-mcp-r01-candidate-build02`, con sus hashes en el
reporte. El tar y manifiesto se conservan localmente en
`.tmp/ai38-mcp-r01-candidate-build02*`; no contienen datos operativos.
