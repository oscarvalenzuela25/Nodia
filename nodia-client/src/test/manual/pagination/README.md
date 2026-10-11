# QA de paginado compartido

Con Vite abrir /src/test/manual/pagination/index.html. Componentes de paginado y theme de producción; estado local sintético, sin HTTP ni cuentas. Parámetros theme=dark|light, lang=es|en.

Verificar320/390/599px: primera fila label/selector, segunda rango/flechas44px;600/1280px: fila única. Nueve variantes, incluidas claves IA con tamaño fijo (sin selector). Cambiar página/tamaño y redimensionar conserva el estado. La captura de un viewport no implica aceptación física.
