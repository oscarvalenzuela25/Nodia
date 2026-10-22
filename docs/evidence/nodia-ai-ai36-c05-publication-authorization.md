# Autorización específica de publicación selectiva AI36-C05

Fecha de la instrucción humana:2026-10-18. Fuente: mensaje del usuario en el chat de implementación, después de C04 y de señalar que publicación selectiva y aceptación seguían pendientes.

> Me parece bien, sigamos con AI36-C05 para avanzar con la publicación selectiva y la aceptación por capacidad de NodiaAI. Usa subagentes para avanzar en paralelo donde se pueda.

Esta instrucción autoriza avanzar mediante un primer lote acotado de siete contratos y las cuatro secciones funcionales mínimas que los explican. La selección técnica conserva las67 lecturas existentes y no publica los77 candidatos restantes. Se registra siguiendo el precedente de [AI-15](nodia-ai-ai15-publication-authorization.md): revisión técnica del agente bajo una instrucción humana específica, sin afirmar revisión humana línea por línea ni aprobación general de especificaciones, ADR u otras funciones.

- `nodia_attachments_describe`
- `nodia_finance_movements_prepare_create`
- `nodia_operations_get`
- `nodia_preferences_list`
- `nodia_preferences_prepare`
- `nodia_proposals_get`
- `nodia_workflows_prepare`

Las secciones y documentos exactos, sus revisiones y hashes se fijan en el manifiesto compilado y en la [validación reproducible C05](nodia-ai-ai36-c05-publication-validation.json). Se publican únicamente las secciones nuevas AI36-C05; los apartados históricos conservan su contexto y no amplían herramientas. La identidad actual del lote no permite regenerar una aprobación silenciosamente tras cambios materiales.

Publicación, selección para el intento, despliegue e inferencia son estados independientes. El perfil de asistencia financiera y el perfil general deben caber completos en74 herramientas/131072bytes; no se autoriza truncar, elevar límites, habilitar API/Codex pendientes ni sustituir proveedores. La aceptación real se registra por capacidad/entorno y conserva intentos fallidos e inciertos sin replay.

Las preparaciones sólo crean borradores/propuestas. Confirmación exacta, ejecución, cancelación/reanudación, aceptación de preferencias y credenciales/login permanecen en el canal humano. La publicación no certifica cuenta, disponibilidad ni éxito de Gemini y no constituye aprobación de v1 completa.
