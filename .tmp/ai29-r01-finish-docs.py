from pathlib import Path
root=Path(__file__).resolve().parents[1]
for name in ['docs/mvp/README.md','docs/mvp/00-progress.md','docs/mvp/45-nodia-ai-implementation-plan.md']:
 p=root/name;s=p.read_text(encoding='utf-8')
 if name.endswith('README.md'):
  s=s.replace('Web abrió el navegador sin sesión: requiere al dueño en el visor; no se declara aceptación ni timeout por esa espera.','Web pasó11checks reales de cancelación/respuesta perdida/reinicioDocker con conciliación SQL;autenticación Web requiere al dueño en el visor. Agentic MCP real pasó10checks,2generaciones y5lecturas SQL sintéticas;limpieza completa. API/worker/Gemini/nginx activos,Client5174/túnel3100 HTTP200 y0jobs/intentos/slots retenidos.')
 elif name.endswith('00-progress.md'):
  s=s.replace('R01 permanece abierto por esa aceptación;no confundir login con inferencia/MCP.','Web verificó además11checks de cancelación/pérdida de respuesta/reinicioDocker con conciliación SQL;Agentic MCP real pasó10checks con2generaciones y5lecturas SQL sintéticas. Salud final:servicios activos,HTTP200 y0jobs/intentos/slots retenidos. R01 permanece abierto sólo por la aceptación Web;no confundir login con inferencia/MCP.')
 else:
  s=s.replace('AI-29 tiene canal local verificado y conserva R01 abierto','AI-29 tiene canal seguro/protocolo durable Linux desplegados y conserva R01 abierto por aceptación Web humana')
  s=s.replace('Web necesita acceso humano en el visor. Testigos históricos','Web pasó11checks reales de cancelación/respuesta perdida/reinicioDocker con conciliación SQL;su autenticación necesita al dueño en el visor. Agentic MCP real pasó10checks,2generaciones y5lecturas SQL sintéticas;salud final HTTP200/0pendientes. Testigos históricos')
 p.write_bytes(s.encode('utf-8'))
