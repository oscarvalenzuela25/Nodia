# Agentic opt-in diagnostics

## NodiaAI AI-03: Agentic y MCP

[Investigación49](../../docs/mvp/49-nodia-ai-ai03-gemini-agentic-viability.md) y
[política48](../../docs/mvp/48-nodia-ai-mode-routing-policy.md). Harness
`probe_nodia_ai_agentic.py`, stdio `nodia_ai_mcp_fixture.py` y hook
`nodia_ai_agentic_gate.py` son opt-in y no se importan desde la aplicación.

```text
python -m experiments.probe_nodia_ai_agentic --live-agentic --connection-id ID_CONFIGURADO --model ID_CONFIGURADO --thinking-level NIVEL_CONFIGURADO
```

Sólo en el contenedor Linux desechable autorizado, con `/probe/run` privado,
scripts readonly, archivo OAuth/installation_id nativos Google montados readonly
en `/probe/auth/` y bus privado bajo el mismo usuario. No copiar/inspeccionar
sus valores, incluirlos en fixtures o montar .env/Web/BD. Si no hay intensidad
configurada, omitir el argumento, sin inferirla del nombre del modelo.
Un propietario exclusivo mientras dure el ensayo; supervisor restaura el
servicio habitual incluso ante timeout. No ejecutar desde unit tests ni
dar al agente el workspace/entorno privilegiado del backend.

Resultado actual parcial: registration/initialize/tools/list comprobados,
tools/call no completado; timeout unknown sin resend. No publicar MCP ni
activar adapter_states o el switch por este resultado. El servidor fixture
permite sólo read/prepare sintéticos y finish en el hook; ninguna escritura real.


Web diagnostics were retired under [plan90](../../docs/mvp/90-agentic-api-only-web-retirement.md). Historical evidence remains in docs; these scripts never authorize runtime capabilities. Apply [plan91](../../docs/mvp/91-ai-provider-onboarding-verification.md) for new provider validation.
