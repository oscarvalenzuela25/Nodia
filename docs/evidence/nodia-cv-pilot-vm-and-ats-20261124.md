# Nodia CV — piloto CV-06 en VM y lectura externa

Fecha 2026-11-24, America/Santiago. Rama de trabajo `codex/nodia-cv`, base
`50bb9ec4db2aece882f5818838eee5260f73539b`.
[Plan113 §CV-06](../mvp/113-nodia-cv-implementation-plan.md#cv-06--integración-qa-visual-y-piloto).
Todas las ofertas, personas, contactos, empleadores y archivos de prueba son sintéticos.

## Lectura externa y ajuste de las plantillas

OneATS enlaza su prueba pública desde la documentación del producto. La prueba
recibe un PDF para mostrar los campos y, según el proveedor, elimina el archivo
después de leerlo y carece de escrituras en su base de candidatos. Se usó la
página de prueba, sin una cuenta de reclutamiento ni una vacante publicada.
[Producto OneATS](https://www.oneats.co/features/resume-parsing) ·
[Prueba pública de OneATS](https://www.oneats.co/tools/resume-parser).

Una primera muestra de Clásica CV-05 conservó el texto, el correo y C++/C#
en la respuesta, con errores de mapeo. El extractor intercambió el
empleador y el cargo, omitió los meses del período y clasificó «Finished»
como habilidad. Leyó el nombre acentuado «Inés Ñúñez» en el fragmento de
texto y escogió el título profesional en el campo de nombre. La muestra
tenía fechas en renglones separados. El SHA-256 de Clásica EN larga
coincide con el recibo de CV-05,
`304f9154e8fa716f28e47c4935a8d74517227b6c646fe8b69f827dea5eea36e3`.
[Evidencia CV-05](nodia-cv-pdf-versions-20261124.md).

El renderer `nodia-cv/pdfkit-0.21.0/pdfjs-6.4.299/2` y la vista HTML
muestran empresa, cargo y período juntos. Los meses conocidos usan
`MM/YYYY - MM/YYYY`. El comienzo y el término se etiquetan cuando está
disponible sólo uno, y el final «Actualidad» o «Present» exige estado
actual explícito. Ambas plantillas conservan los campos y los meses
originales. Las versiones que ya estaban guardadas conservan sus bytes.

En la comprobación local del renderer /2 con Clásica, la prueba pública
retornó HTTP 200 con nombre, correo, teléfono nacional, empresa, cargo,
fechas por mes, formación y las habilidades seleccionadas. Devolvió
el país sin ciudad ni estado para la ubicación de prueba. El PDF local
de control tiene SHA-256
`82877930aef28bc87d2b56ebfc732d7e72404291cfa04d10228bacc366c78cca`.

Windows Node 24.20 y Linux WSL Node 24.22.2 comprobaron cada uno ocho
PDF de la matriz Clásica/Compacta y ES/EN, cortos y largos, y cuatro
casos de fechas parciales. Linux ejecutó la matriz en un espacio de red
aislado. PDF.js verificó contenido, orden, identidad y el bloque de
empleo dentro de una página. En HTTP con PostgreSQL 16 se probaron las
cuatro variantes, 77 migraciones y cero llamadas de IA. Poppler permitió
revisar el resultado visible.

## Entorno de la VM

Se usó el host `nodia-vps-lab` por SSH estricto. Server Nest compilado
y Client Vite se ejecutaron en un servicio de ensayo por loopback,
con PostgreSQL 16.15 separado y 77 migraciones. La identidad de las
cuentas se inicializó en el laboratorio. La aplicación usó los guardas,
casos de uso y controladores compilados. Redis se representó con un
caché en memoria para este proceso. El alcance operacional fue la
instancia de prueba, con las unidades del entorno activo en servicio.

| Artefacto de la prueba sustantiva | SHA-256 |
| --- | --- |
| Server compilado `server-r2.tgz` | `0d0bc374bf1e5cba2ea694e6eac21a86ccd4a7f618d4e6a8952238055c21a4b3` |
| Client compilado `client-r2.tgz` | `e805c80fae11fd166cd8aa3cb420e44c8cc8b3eb256f39f8d95943b47495063b` |
| Dependencias PDF fijadas `deps.tgz` | `a464e5abc3b5b899e2658c1e8d0d3efd9a7e24193fae7b7797bb4ce127311923` |

Se creó el módulo desde el mantenedor visual, seleccionando `/nodia-cv`,
y se asignó a dos cuentas de prueba desde su administración en Core.
Cada cuenta recibió una asignación independiente a ese destino.

La persona titular creó y duplicó el perfil desde la UI. OpenAI
conexión `1`, API key, `gpt-6.1-terra`, esfuerzo `medium`, generó el
borrador de la operación `71c29da5-d051-4df5-9b6f-c732b16d084a`. El
POST devolvió 202 y la vista llegó a `ready` en 7.570 ms de interacción
y consulta. El candidato de laboratorio usó la calificación sintética
previa de esa selección. Se contó un intercambio de inferencia real.
El resultado incluyó cinco requisitos y mantuvo Kubernetes como
brecha. La empresa, el cargo, los meses, la formación y las habilidades
seleccionadas procedieron del perfil sintético.

La revisión confirmada quedó en `2`. Desde la vista de esa misma
revisión se prepararon, leyeron, descargaron y guardaron ambas
plantillas. PDF.js y la rasterización de Poppler confirmaron A4 de una
página, una columna, ausencia de recortes y los mismos campos en ambas.
Se eligió el mismo contenido en las dos variantes. La lectura SQL
independiente confirmó un intercambio reservado e iniciado, resultado
`completed`, fase `closed`, ACK y cero intercambios abiertos. La huella
de la respuesta fue
`f07deb7d1ece3fb25787e05edeebc71a9459ad1fb52117433629a6ffc5924d16`.
El recibo SQL tiene SHA-256
`5ea1e02605a1d6129615473e347c3823270e87c6c915757c2c8dded593d8da7e`.

Se volvió a abrir el historial con el Server final que incluye
protección de bajas. Su paquete tiene SHA-256
`09dd5f687b6fa07d07d97128a3cef4cb4c21d5ad6a467c5b4753c80faa494213`.
Al abrir, comprobar y descargar ambas versiones guardadas, los archivos
coincidieron byte por byte con los PDF revisados. En ES, tema oscuro y
320 px, la segunda cuenta creó un perfil propio, vio su historial
vacío y obtuvo seis respuestas 404 privadas al consultar recursos de la
primera. La primera persona abrió y eliminó la versión 2 por el
diálogo de confirmación. La descarga eliminada devolvió 404 y la versión
1 conservó su PDF. El administrador retiró la asignación del titular
desde Core. Con la sesión anterior, tres lecturas privadas devolvieron
403 y la UI dejó fuera el contenido. Se probó en Edge a 320 y 1.440 px,
en ambos temas y con interfaz ES/EN. El renderer y el historial
mantuvieron el total de inferencia real en uno.
La lectura SQL posterior tuvo SHA-256
`089c324ad6ac3218c9d3ec67d5fd081eb1ef5cb733a457d7c070230f67913419`.
Se cerraron únicamente el proceso, base PostgreSQL y túnel de CV-06.
La VM y sus servicios previos quedaron activos. Recibo de cierre
`5304e90af4240b3f172f01f259ea90c3d38ca7717aa6e81d3e5c67d378b8da38`.

## Par de archivos de la VM leído por OneATS

Se volvió a calcular el SHA-256 de cada descarga y se abrió en la
herramienta pública de OneATS. Durante la carga, el navegador permitió
como mutación únicamente el POST al servicio público de lectura. No
se enviaron postulaciones. Ambas respuestas comparadas fueron HTTP 200.

| Plantilla EN | Bytes | SHA-256 del archivo leído |
| --- | ---: | --- |
| Clásica | 20.142 | `55bcfa0f48847a6539535ccaa52b1544d64e83fa19f2acf5ade8839ed34eec8e` |
| Compacta | 20.134 | `574917b377603887b6ec19843a62ece592a469490a06b80fb8a16e8e0c94ea16` |

| Comprobaciones del par | Resultado observado en ambas |
| --- | --- |
| Nombre, correo y teléfono | Nombre y correo exactos. Conservó los diez dígitos nacionales. Omitió el prefijo `+1` |
| Empresa, cargo y meses de empleo | Campos correctos y separados. Desde 2021-04 hasta 2024-09. Duración informada 3,4 años |
| Título de formación, institución y años | Grado e institución correctos. Período 2015–2019 |
| Habilidades explícitas | TypeScript y PostgreSQL. También detectó React, presente en el resumen y la experiencia |
| Ubicación | El texto del PDF contiene «Austin, TX, United States». El parser informó «United States» y dejó ciudad y estado vacíos |

Coincidieron 9 de 10 comprobaciones por plantilla, contando el
teléfono nacional como tal y la ubicación completa como una
comprobación. La experiencia y formación estructuradas fueron
iguales entre los dos resultados. El comparativo JSON tiene SHA-256
`cce8f952dd7213bf1f1c5422ef76e79eb573c8812c8c8517c1b5722ad2cb6892`.
El resultado corresponde a estos dos PDF EN y al lector público,
con una limitación observada en ubicación. El mapeo dentro de un
tenant de reclutamiento y la selección de un empleador quedan fuera
de esta prueba. [Prueba pública de OneATS](https://www.oneats.co/tools/resume-parser).

## Restauración aislada y barrera de promoción

El ensayo de PostgreSQL 16.15 aplicó la migración 179400 a una copia con
76 migraciones y guardó la identidad de perfiles y revisiones. Un fallo
inducido antes del commit mantuvo el esquema y ledger anteriores. La
migración de bajada rechazó eliminar tablas con versiones guardadas.

La primera cuarentena de una copia capturada antes de dos bajas
reprodujo el problema de restaurar el PDF y el perfil eliminados. El
conjunto final amplía el journal con `cv_version` y `cv_profile`.
El ensayo final usó el productor y exportador compilados con CAS en
memoria, el CLI real de cuarentena y `pg_dump`/`pg_restore` sobre
bases descartables. Ambas copias, anterior y posterior a las bajas,
quedaron preparadas con cero despachos y `release_authorized:false`.
Conservaron la versión Clásica y su PDF
`7265f473dc455f733de26c980c39c5f647579ba952e440a5756907e74f55d224`.
La Compacta y el perfil eliminados devolvieron 404. Los borradores y
PDF temporales se retiraron. En tres controles la cuarentena rechazó
CV en cola, en ejecución o con cierre pendiente de ACK.

| Control | Observación |
| --- | --- |
| Copia anterior a las bajas | SHA-256 `1661317ee42ac18e5ba1bee7822fcb5f6d33871f9462667a2e398812239e6a9f` |
| Copia posterior a las bajas | SHA-256 `4dbedce66fed736c75cacd48563d72818f91fe8bd29b903ea4f98d1fcc27b709` |
| Recibo de diez verificaciones | SHA-256 `489a7904fad3c8d07ed32c001438ace5e8db8dbf3628a6bc5bd84d2656a70bee` |
| Testigo incierto | Una revisión nueva entre preparación y borrado conservó el perfil y dejó un testigo pendiente. La captura de copias siguió disponible y la exportación de restauración quedó bloqueada. El reintento autorizado confirmó el mismo UUID |
| Locks y autorización | 15 operaciones CAS del journal quedaron fuera de locks de autoridad/cola. Una revisión incorrecta y una sesión revocada fallaron antes de crear un testigo |

La prueba de restauración usó almacenamiento externo sintético y
ningún worker normal contra las bases restauradas. La prueba de
fase corresponde al esquema y cuarentena, con la adopción en destino
y sus artefactos de CI por SHA pendientes.

## Reproducción y estado

Los PDF sintéticos, respuestas del lector, recibos, scripts y capturas
de Edge se conservan bajo `.tmp/nodia-cv06/` y el recibo de cuarentena
está en `.tmp/nodia-cv06-restore/`. Las capturas y PDF permanecen fuera
de Git. `cv06-owner-open-es-dark-320.png` muestra el PDF guardado en
móvil y `cv06-reopened-classic-en-light.png` su versión de escritorio.
La rama de trabajo conserva los cambios locales. El repositorio remoto
no tenía esta rama durante la comprobación. El piloto acredita
artefactos de laboratorio y deja pendiente el cotejo de CI por SHA,
la prueba en dispositivo físico y la adopción de destino.
