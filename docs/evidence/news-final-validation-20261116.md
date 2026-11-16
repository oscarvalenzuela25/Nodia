# Noticias — validación final y preparación NEWS-06

Fecha2026-11-16, rama `codex/news-implementation`, base `2585b767` de development.
Alcance solicitado: validar y dejar preparado para desplegar. No ejecutar
promoción a master, migraciones de la app o despliegue. Complementa
[NEWS-04](news-nodejs-integration-20261116.md),
[QA final UI](news-final-ui-20261116.md) y
[guía de entrega](../features/news/deployment-readiness.md).

## Resultado técnico local

Preparación local completada: lectura pública de caché web.dev/Node.js,
obtención explícita sólo super_admin vigente, fuentes/errores independientes,
procedencias/licencias y migraciones verificadas. Las comprobaciones finales
añaden autenticación real de laboratorio y recorrido completo con RSS reales;
no se reclasifican como Google, cuenta humana o producción.

## JWT, SQL y HTTP compilados

`nodia-server/test/news.integration.mjs`, SHA256
`7d1403ee958fef1597b7eecec50105579d7413a3c0c1356a962a911ccb8c337f`.
Usa AuthGuard, AuthenticateRequestUseCase, AuthService/TypeORM y
AuthTokenService/JwtService reales. Clave HS256 efímera, actores y sesiones
sintéticos en PostgreSQL16 descartable. No carga `.env` o DB configurada.

- Ejecución predeterminada final:13gates correctos,16dispatches sintéticos y
  **cero consultas externas**. JWT inválido, vencido, audiencia incorrecta,
  refresh token o firma ajena reciben401 sin consumo. El mismo JWT válido deja
  de habilitar POST ante usuario inactivo, sesión expirada o rol revocado.
- POST ordinario403, sesión revocada401, super_admin vigente200; GET anónimo200
  incluso con bearer inválido, sin introducir auth en lectura pública.
- Conserva migraciones up/down/up y rollback Node preservando web.dev;
  concurrencia entre instancias, fencing, GUID/URL/304, retención, Retry-After,
  independencia entre fuentes, dedupe y paginado comprobados.
- Opt-in explícito `NEWS_TEST_LIVE_RSS=1`:14gates correctos. Dos POST con JWT
  administrativo de laboratorio usaron el adaptador HTTPS real: web.dev10 y
  Node.js100 noticias, persistidas en SQL descartable. GET anónimo verificó
  110noticias/3páginas con límite50, procedencias coherentes y opcionales Node
  null. **Exactamente dos GET upstream**, sin retry/fallback; los16dispatches
  sintéticos previos se contabilizan aparte.
- Contenedores retirados. Sintaxis/lint focal del arnés correctos; JWT/claves no
  aparecen en recibos. Default no activa la lectura real por ejecutar los tests.

Recibos completos de laboratorio ignorados:
`.tmp/news06-verification/backend-auth-receipt.json` y
`backend-live-receipt.json`; fechas de cierre respectivamente en esos recibos,
opt-in2026-11-16T21:04:28.811524Z. Los hechos duraderos se condensan aquí sin
tokens, XML crudo, artículos completos o secretos.

## UI compilada y corrección encontrada

Preview del build de producción, no Vite dev; APIs/actores sintéticos interceptados
por Playwright. La [evidencia UI](news-final-ui-20261116.md) detalla vacío con
fechas null, JSON inválido,503 inicial/reintento, carga, selección por teclado,
refetch fallido con contenido, actor ordinario y logout durante POST tardío.
GET News nunca envía Authorization y no hay POST implícito o replay.

La primera carga falló: Boneyard1.9.0 sin initialBones/fallback sustituía su hijo
por contenido vacío; región de carga de0px. Se corrige con `NewsInitialLoading`,
huesos geométricos del theme y reserva220px, sin noticias ficticias o animación.
La regresión usa Boneyard real, sin mock de su regla. **41pruebas News/5archivos**,
typecheck, lint focal y build final correctos. Build conserva aviso histórico
chunks>500kB.

Build final revalidado en320/900/1440: región visible220px y cinco huesos, sin
artículos/controles ficticios; después dos tarjetas y ningún skeleton. Refetch:
dos tarjetas conservadas, cero huesos y siete enlaces bloqueados durante carga.
Reflow visual464CSS/DPR1 correcto, con selección conservada; no equivale a zoom.

## Zoom nativo: observación y límites

Chrome de escritorio en ventana propia `News06 Zoom QA`, controlada mediante
teclado nativo de Windows. UI accesible registró110/125/150/175/**200%**; no se
usaron CSS zoom, pinch o emulación de tamaño para acreditar ese porcentaje.

| Observación |100% |200% |Restauración100% |
| --- | --- | --- | --- |
| outerWidth |945 |945 |945 |
| innerWidth |929 |464 |929 |
| devicePixelRatio |1 |2 |1 |

Al200%, CSS zoom1 y visualViewport.scale1; scrollWidth/clientWidth459/459 en
primera medida y464/464 al final del recorrido. Seis tarjetas, títulos y enlaces
finales accesibles. Space seleccionó Programación con aria-pressed y retorno de
foco correctos; después se restauró100%. Ventana propia cerrada,
sin alterar el zoom de las pestañas del usuario.

La captura nativa falló (`FrameArrived timed out` / `window capture timed out`)
y las PNG del contexto visible resultaron negras; **no se utilizan como prueba
visual**. El porcentaje se acredita por Chrome accesible y la geometría/teclado
por DOM. Sigue sin acreditarse inspección visual nativa al200%; el reflow
headless464px tiene evidencia separada. Logs ignorados de métricas y texto en
`.tmp/news06-verification/zoom-*` y `native-zoom-accessibility.txt`.

## Checks reutilizados, entrega y límites

Las suites globales anteriores al fix de carga pasaron: Client3103/375 y
Server6091/355+1omitida histórica Linux. No se presentan como ejecución de la
nueva regresión: ésta tiene sus41focales y build/QA posteriores. CI debe validar
el SHA final versionado en Linux antes de promocionarlo; estado/recibos se
consultan en la PR y Actions de ese SHA. No se construye ni publica un paquete
productivo desde este workspace.

La guía de entrega conserva Server→Client, inventario append-only, las dos
migraciones y postchecks concretos. Los down/up ensayados no son rollback
automático productivo. Tras migrar, un paquete pre-News con menos migraciones
no satisface el ledger; corrección compatible o rollback explícito requiere su
procedimiento propio.

Pendientes manuales declarados: teléfono/teclado físico, Google/sesión humana e
inspección visual nativa200%. No se dispone de esos resultados y no se inventan.
No bloquean documentar el candidato técnico; la aceptación humana y adopción de
entorno permanecen separadas. No hay inferencias, habilitación daily.dev,
credenciales nuevas, aprobación de ADR105/fichas o publicación de conocimiento.
