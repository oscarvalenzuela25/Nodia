# Nodia CV Agentic — recorrido normal y promoción

2026-11-25, America/Santiago. Piloto `nodia-vps-lab`, PostgreSQL
16.15 aislado y Edge. La VM ejecutó el candidato de
[`1f9fd554`](https://github.com/oscarvalenzuela25/Nodia/commit/1f9fd55483d75c62b0b1c0a770054793eec67f30).
Integrar `b2200ef9` incorporó el tip de development. Los árboles de
Nodia CV, Gemini y host Codex CV conservan los mismos archivos de código
que los probados en el piloto.

## Recorrido con sesiones existentes y datos sintéticos

Una cuenta normal con acceso al módulo seleccionó el perfil sintético y
una oferta que pedía TypeScript y mencionaba Kubernetes como deseable.
Cada clic en **Generar borrador** obtuvo HTTP 202. Ambos borradores
respaldaron TypeScript y conservaron Kubernetes como brecha. Cada
operación reservó e inició un intercambio y finalizó en `ready`, con
ledger `closed/completed`, cierre de proceso, ACK confirmado y slot libre.

Para cada borrador se prepararon Clásica y Compacta y se leyó la capa
de texto de cada PDF de una página. Se guardó Clásica para Gemini y
Compacta para Codex. Las dos versiones devolvieron HTTP 201 y siguieron
visibles después de recargar. Se reabrieron desde **CV guardados**, se
comprobó el PDF guardado y se descargó como archivo. SHA-256 del archivo
descargado y bytes en PostgreSQL coinciden con el artefacto revisado.
La recuperación de la oferta y del borrador anterior usó la solicitud
original tras recargar. No volvió a generar ni guardar esa versión.

| Selección Agentic | Generación y recibo de cierre | Versión guardada | SHA-256 descargado |
| --- | --- | --- | --- |
| Gemini `2 / gemini-4-hydrogen-high / high` | `30e6d22b-5a48-471a-8ca8-db1190c7b9b8` · `be8b398e-9161-463a-9bfd-305ec5a0353f` | Clásica, nº 1 · `570155bd-1d9b-4d95-ad11-d0826bfed1d3` | `3cf5c73ea8a7e3c850d19f34dcca726654b5597d3b9d11ca7ea7515065000a9f` |
| OpenAI `1 / gpt-6.2-sol / high` | `eeb146f9-f9b4-4d0b-80c8-7219f1119cb6` · `37d0052f-5e13-4e8a-bfe3-c23e1a2a401a` | Compacta, nº 2 · `3b606ec2-f134-4bdb-917c-e1017f8d5ee0` | `0f44546918f069fc337d3ac05d38d3cdf17aff2276e94b8f2d876a9426d7d596` |

La lectura se comprobó en Nodia CV y PDF.js. El recorrido se limitó al
piloto y no envió postulaciones. La prueba anterior en OneATS conserva
su alcance propio. [Evidencia de CV-06](nodia-cv-pilot-vm-and-ats-20261124.md).

## Comprobaciones de Plan91

| Casos aplicables | Resultado y entorno |
| --- | --- |
| P01–P05, P15–P16 | Catálogo y elegibilidad exactos, recarga por sesión, selección no calificada, configuración ajena y recuperación probadas en unidades de Server y Client. Piloto con sesión real y UI ES. Evidencia de teclado y móvil en [pasos 4 y 5](nodia-cv-agentic-baseline-vm-20261125.md#paso-5-gemini-agentic-en-el-piloto-aislado-de-la-vm). UI EN comprobada por traducciones y pruebas focales, sin segunda inferencia por idioma. |
| P06, P10–P11 | Prueba ordinaria real por cada selección de la tabla, guardado explícito, reapertura y descarga. PDF y versiones aprobados en PostgreSQL desechable, con tres versiones y cero llamadas a proveedores en esa suite. |
| P12–P14 | Pruebas locales de perfil ausente/ajeno, revocación, selección inválida y sesión ausente, salida inválida/excesiva, cuota simulada, caída, timeout, duplicación, reinicio antes del cierre y del ACK, y recuperación sin reenvío. Custodia, slot y rollback de operaciones verificados por integración PostgreSQL y suites nativas. |
| P07–P09 | Fuera del transporte de CV. El flujo acepta perfil y texto de oferta y produce borrador textual y PDF. |

Pasaron 161 pruebas focales de Server, build, lint y conocimiento, y 26
pruebas focales de Client, typecheck, lint y build. La suite Gemini
ejecutó 674 pruebas en Linux sin red. Windows aprobó 659 y omitió 15
por plataforma. Las integraciones de generación API key, Agentic, PDF
y versiones usaron PostgreSQL 16.15 desechable y 82 migraciones.

## Promoción productiva

La lectura previa a la promoción encontró el release productivo
`backend-b2200ef94416-17dff4fd6407` en estado `deployment_ready`.
El árbol Gemini instalado es `194430e008303998a347c9fcb0556eedc6e14890`.
El árbol candidato Gemini es `39aee4bccd178dbf1403460763eec5a1b2024ab8`
y el de host Codex es `174765ff83c3820b01d4a8741f702472c0b466d6`.

El planificador de CD rechazó el diff del candidato con
`unmanaged_runtime_change_requires_coordinated_rollout` incluso con una
atestación sintética Gemini de forma y árbol exactos. Cambian ocho
archivos operativos de Gemini y seis del host Rust de Codex. El
[gate actual](../../ops/ci/cd-selection.mjs) admite la atestación Gemini.
Para una promoción íntegra falta un contrato equivalente para el
árbol y binario de Codex CV.

1. Preparar el binario Codex CV de release y validar arquitectura,
   capacidades, catálogo 0.171.0 y hashes. Integrar la instalación,
   reversión y atestación del host en el inventario exacto de API/worker
   y comprobar esa atestación durante CD.
2. Aprovisionar el SDK restringido de Gemini y su sesión para CV en el VPS.
   El despliegue vigente monta el perfil CLI y el estado privado. El
   [operador de Gemini](../../ops/production/ai-runtime/README.md#actualización-coordinada-del-adaptador-gemini--2026-11-24)
   requiere activación autenticada y un recibo ligado al árbol candidato.
3. Con las puertas productivas comprobadas, promover por ascendencia a
   master y verificar CI del push, dispatch de CD, release de Server,
   Pages y smoke en destino. Calificar cada selección con su propia
   sesión y prueba de CV de producción.

El acceso de operador restringido comprobó el estado productivo. La
sesión privada con sudo para instalar los runtimes está pendiente.
