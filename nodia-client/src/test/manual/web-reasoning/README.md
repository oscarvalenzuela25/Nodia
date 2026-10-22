# QA sintético de niveles Web

Abrir `src/test/manual/web-reasoning/index.html` en un origen QA separado del
frontend operativo. El adaptador Axios es completamente offline y rechaza rutas
no previstas; no modifica authStore, cuentas, modelos ni configuración reales.

Parámetros: `lang=es|en`, `theme=dark|light`, `fail=1` para error de guardado.
Comprobar320/390/1280px, tres niveles sin selección automática, conservación del
booleano histórico y guardado por modelo (output «Escritura simulada»). El fallo
mantiene la configuración previa. Esta prueba no acredita inferencia ni OCR.
