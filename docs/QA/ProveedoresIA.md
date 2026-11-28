# QA de Proveedores de IA

[Volver al índice de QA](README.md) · [Matriz de IA](README.md#matriz-de-ia)

## Preparación

- Abre Proveedores de IA en `/ai-providers` con la cuenta `super_admin`. Registra entorno, versiones e inventario de conexiones visible al comenzar. Comprueba qué operaciones ofrece realmente cada conexión en el producto que la consume.
- En producción, observa las conexiones configuradas y usa sólo las selecciones y el presupuesto autorizados para la corrida. Altas, rotaciones, cierres de sesión, cambios de catálogo y fallos inducidos requieren conexiones de prueba en un entorno aislado.
- En laboratorio, prepara dos conexiones de prueba para distinguir catálogos, credenciales y observaciones por instancia con la misma cuenta. Cuando el contrato lo permita, prepara una conexión con Agentic y API key habilitados para verificar que se administran de forma independiente.
- Para calibrar errores, usa señales conocidas del transporte de prueba. Registra por separado configuración guardada, autenticación, descubrimiento, capacidad anunciada e inferencia válida. Identifica si el transporte de la observación fue real o simulado y recoge estados y correlaciones sanitizadas.

## Casos

| Caso | Ejecución | Preparación y pasos | Resultado y evidencia |
| --- | --- | --- | --- |
| **PROV-01 · Inventario de conexiones y modos** | Manual | Abre cada conexión configurada. Anota proveedor, ID público de instancia, estado, modos habilitados y acceso efectivo por producto. Reabre una conexión histórica con modo retirado si el entorno aislado la tiene. | El inventario coincide con las conexiones y sus modos publicados. Agentic y API key se muestran según la instancia. Web se lee como histórico cuando corresponda y permanece retirado de los selectores ejecutables. |
| **PROV-02 · Catálogo y Medio** | Manual | En cada instancia y modo de PROV-01, usa su lista de modelos y la acción de sincronización cuando esté autorizada. Revisa el selector de cada propósito aplicable, incluido un modelo compatible que se use por primera vez. Registra ID exacto, opciones efectivas y equivalencia declarada para Medio. | El selector conserva modelo y nivel de la misma instancia. Identifica opciones sin Medio, sin metadata verificable o sin soporte del propósito, con su fuente. Si el proveedor declara una variante como representación de Medio, registra su ID exacto y el nivel aplicado. La observación del catálogo se clasifica aparte de la inferencia. |
| **PROV-03 · Gestión de API key** | Manual | En la conexión API aislada, guarda una credencial de prueba por el flujo seguro. Reabre el detalle, revisa la máscara, selecciona la credencial y revócala al terminar. Revisa la otra conexión durante el recorrido. | La UI y las respuestas administrativas muestran sólo etiqueta, máscara y estados permitidos. El secreto permanece en el canal previsto. La selección y revocación se aplican a su instancia y la otra conserva su estado. |
| **PROV-04 · Sesión Agentic** | Manual | En laboratorio, inicia el login oficial del proveedor cuando corresponda. Observa el estado sin sesión, login completado, cancelación del flujo cuando proceda y desconexión. Abre otra conexión con la misma cuenta. | Cada observación pertenece al perfil correcto. Cancelar o desconectar deja la instancia en su estado declarado y preserva las observaciones de las demás. El estado de sesión se registra aparte de MCP e inferencia. |
| **PROV-05 · Estado e indicadores** | Manual | Abre Ajustes y el indicador superior. Refresca por el control visible. En laboratorio, verifica una instancia sin credencial, un dato de cuota desconocido, un cero comprobable y una observación caída. | API key informa configuración guardada y Agentic informa el estado observado de sesión. Desconocido y cero se distinguen. La recarga conserva las identidades de modos y conexiones. El contador de inferencias queda intacto por las lecturas de estado. |
| **PROV-06 · Inferencia real por selección** | IA | Para cada fila compatible de la matriz, abre un chat nuevo en NodiaAI con conexión, modo, modelo y Medio explícitos. Envía «Escribe únicamente NODIA-QA-731» y reabre el turno al finalizar. Si NodiaAI carece de ese propósito para la selección, usa el punto de entrada compatible indicado por el catastro y conserva su comprobación propia. | Se acredita una salida válida, persistida y asociada al intento exacto. En chat se comprueba el marcador. En otro propósito se aplica el criterio de su suite. Registra estado terminal, cierre y evidencia permitida. La reapertura conserva el recibo y el contador. |
| **PROV-07 · Canal de herramientas y modalidades** | IA | En la misma selección, prueba la lectura autorizada de NodiaAI con AI-02 o AI-05. Para propósitos adicionales y MIME compatibles, ejecuta sus casos de producto según la matriz. Reutiliza un recibo sólo si acredita el mismo caso, propósito, selección, entorno y versión. | Agentic acredita MCP cuando el contrato lo requiere. API key acredita function calling y conserva `supports_mcp:false`. Cada capacidad anunciada que se ejerce tiene evidencia de ejecución propia. Un resultado de texto acredita el recorrido de texto. |
| **PROV-08 · Credencial, modelo o razonamiento no disponible** | Manual | En laboratorio, deshabilita la conexión aislada, retira un modelo de su catálogo de prueba y simula sesión expirada o clave revocada en casos separados. Para un modelo sin Medio, revisa sus opciones en el selector. Observa admisión y contador de despachos con el mismo contexto. | El producto ofrece diagnóstico o reconfiguración para el motivo observado. Una selección rechazada antes de inferir conserva cero envíos y conserva el borrador cuando corresponda. Una configuración ajena permanece intacta. |
| **PROV-09 · Fallos después del despacho** | IA | En laboratorio, usa la selección exacta y un transporte instrumentado. Simula rate limit y respuesta perdida en corridas separadas. Observa el estado, recarga y comprueba los contadores de la conexión original y otra disponible. | El rechazo conocido y el resultado remoto incierto quedan diferenciados. El cierre local y ACK siguen el contrato de Agentic o API. Se respeta el presupuesto, con cero sustituciones de destino y cero reenvíos de un intento incierto. |

## Cobertura por proveedor

El inventario observado del entorno determina las filas de esta suite.
Una propuesta, una entrada de catálogo y una integración adoptada tienen
evidencias distintas. Consulta OpenCode y FreeLLMAPI en sus planes y usa
la [matriz de IA](README.md#matriz-de-ia) para declarar lo soportado o
bloqueado. Al incorporar o cambiar un adaptador, ejecuta también P01–P16
y, para chat API, A01–A08 según corresponda. Los casos funcionales de este
archivo se complementan con esa aceptación técnica por transporte.

## Fuentes

- [Contrato de Proveedores de IA](../mvp/ai-provider-feature-contract.md) · [Modos operativos](../architecture/decisions/ADR-083-agentic-and-api-only-ai-modes.md) · [Indicadores de estado](../features/ai-providers/topbar-mode-health.md).
- [Verificación obligatoria](../mvp/91-ai-provider-onboarding-verification.md) · [Runtime común de API key](../mvp/92-nodia-ai-api-chat-parity.md) · [Catastro de usos de IA](../mvp/114-ai-model-usage-inventory.md).
- [Plan OpenCode](../mvp/115-opencode-provider-implementation-plan.md) · [Plan FreeLLMAPI](../mvp/116-freellmapi-integration-plan.md) · [Suite de NodiaAI](nodiaAI.md#casos).
