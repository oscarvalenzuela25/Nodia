# Capturas de validación fuera del árbol versionado — 2026-11-16

Por solicitud del usuario se retiran del índice Git247capturas PNG/JPG de
`docs/evidence/`,16486902bytes (16.49MB decimales). Las capturas locales conservan
sus bytes y ubicación original, pero quedan ignoradas y no se incluyen en nuevas
versiones. Los assets funcionales de Client y las imágenes de producto no se
retiran.

El [catálogo JSON](validation-images-archive-20261116.json) registra cada path
original, tamaño, SHA256, blob Git y enlace permanente al commit
`8886e42f43c1dc93e4a67cfb643b9aac7d9c9f17`, anterior a la retirada. Los bytes
locales se compararon con sus blobs originales antes de retirar el índice y sus
SHA256 se comprobaron después. Los enlaces Markdown ahora apuntan a esos
originales históricos, sin incrustar imágenes en los documentos.

Los JSON históricos, firmas, hashes registrados y resultados de QA se conservan
íntegros. El catálogo identifica también los originales de documentos cuyos
enlaces se actualizaron. Cuatro fichas candidatas cambian sólo referencias y
revisión; permanecen draft/unregistered/approval:null. Ninguna ficha aprobada,
capacidad publicada, contrato, compilador o pin se modifica para omitir checks.

La compilación cambia su release de procedencia de `a4a9bb20…` a `167d6f75…`:
cuatro documentos publicados referencian fuentes MVP cuyos enlaces de capturas
se actualizaron. Sus contenidos/revisiones,44documentos,46fragmentos y153capacidades
permanecen iguales. El [delta comprobable](validation-images-knowledge-delta-20261116.json)
registra los hashes; los pins derivados se regeneran por el build soportado,
sin editar aprobaciones o fijarlos manualmente al release anterior.

Verificación local:247SHA256 de imágenes conservados; compilación de conocimiento
y pins de src/dist regenerados con `context:prepare`/`context:build`, checker
actual correcto (96fuentes/52excluidas y2108enlaces). Antes de regenerar, el checker
detectó correctamente `knowledge_runtime_pin_mismatch` por los derivados antiguos;
no se debilitó esa comprobación.

Un archivo Git del índice se extrajo en un checkout limpio sin capturas. Su
compilación en memoria conserva contenidos publicados y el nuevo release;
2956enlaces revisados sin referencias nuevas rotas. Se distinguen46referencias
locales antiguas que ya apuntaban a paquetes ignorados de `ops/lab/artifacts/`,
fuera de Git antes de esta limpieza; no se incorporan esos paquetes privados
ni se altera la evidencia histórica para aparentar que estaban versionados.

En un checkout nuevo no estarán las PNG/JPG. Para consultar una captura, abrir
su `original_url` del catálogo; si se recuperan bytes para trabajo local,
guardarlos en `output/` y verificar tamaño/SHA256. No reconstruir evidencia
antigua desde capturas nuevas ni alterar hashes para simular coincidencia.

Esta operación aligera el árbol actual y sus futuros artefactos. **No reduce el
historial Git existente ni garantiza un clon completo más pequeño**: los blobs
históricos siguen disponibles. No se usa filter-repo, force-push o reescritura
de ramas compartidas.

Las capturas nuevas de QA pertenecen a `output/` o `.tmp/`, ignorados. En
`docs/evidence/` conservar sólo resultados textuales útiles y catálogos sin
secretos; una imagen local o su archivo no amplía aceptación funcional,
disponibilidad, QA humano o despliegue.
