# Billboards — paneles publicitarios

Fecha: 2026-10-22. Antecedente técnico para un desarrollo futuro.

## Propósito y estado

Billboards es el nombre previsto para paneles publicitarios de Nodia: pantallas destinadas a presentar productos y precios de forma legible en un televisor.

Este documento conserva el aprendizaje del ensayo visual solicitado por el usuario. **La función comercial Billboards no está implementada ni especificada operativamente**; este registro no aprueba un producto, contratos ni publicación de capacidades.

El usuario solicitó retirar el prototipo público `/test-market` después de confirmar que funcionó en su televisor. Esa ruta, sus productos ficticios, imágenes, traducciones, pruebas y evidencias de demostración se retiraron; no son una implementación reutilizable de Billboards ni un catálogo real.

## Ensayo y resultado observado

El prototipo mostraba seis productos inventados con fotografía, precio CLP y unidad, en una cuadrícula de tres columnas/dos filas horizontal o dos columnas/tres filas vertical. Permitía girar todo el contenido en pasos de 90 grados y solicitar pantalla completa cuando el navegador lo admitía.

La primera fotografía enviada desde el televisor mostraba encabezado y pie, con las tarjetas de productos invisibles. Ese síntoma es un hecho observado; no se verificaron marca, modelo, sistema operativo ni motor/versión del navegador del dispositivo.

La versión inicial dependía de `dvw`/`dvh` para dimensionar el lienzo, y de container queries, unidades `cqmin`/`cqw` y `clamp()` para adaptar contenido. La hipótesis técnica fue que el navegador podía ignorar las dimensiones y dejar el lienzo sin altura efectiva, colapsando la cuadrícula flexible. **Es una inferencia compatible con la imagen, no una causa aislada y demostrada en ese motor.**

Se sustituyeron esas dependencias de tamaño por dimensiones y métricas explícitas en píxeles. El usuario confirmó posteriormente **«Funciono» el 2026-10-22**, tras probar la corrección en el televisor. Esta confirmación física acredita su ensayo concreto; no certifica compatibilidad con todos los televisores ni todos los recorridos.

## Patrón técnico que conviene conservar

- Medir `window.innerWidth`/`window.innerHeight` y mantener un snapshot estable mientras el tamaño no cambie.
- Releer dimensiones ante `resize`, `orientationchange` y `fullscreenchange`; escuchar también `visualViewport.resize` si existe, conservando las dimensiones de `window` como referencia.
- Suscribir y retirar listeners con el ciclo de vida de la pantalla. Evitar estado duplicado y actualizaciones cuando el tamaño permanezca igual.
- Dar al lienzo ancho y alto explícitos en píxeles e intercambiarlos a 90/270 grados. Girar conjuntamente cabecera, productos, precios y pie en el ciclo `0 → 90 → 180 → 270 → 0`.
- Resolver orientación, cortes responsive y tamaños de texto sin exigir unidades dinámicas de viewport o container queries para que el contenido esencial sea visible.
- Usar capas explícitas para fotografía, sombreado y texto; comprobar altura positiva de tarjetas y límites del lienzo en cada orientación.
- Tratar fullscreen como capacidad opcional: reflejar cambios externos, impedir solicitudes concurrentes y permitir reintentar un rechazo conservando giro y contenido.

La corrección del ensayo seguía utilizando CSS Grid, variables CSS y el stack de Nodia. No se creó un modo universal para navegadores antiguos ni se cambió el soporte mínimo de la aplicación completa.

## Evidencia histórica anterior al retiro

- La suite Client anterior al retiro terminó con **1.791 pruebas en 230 archivos correctas**, con cuatro avisos previos de JSDOM por navegación entre documentos y sin fallos.
- Incluía **18 regresiones del prototipo**: 14 de componente y cuatro de rutas. Cubrían contenido ficticio, traducciones, giro/foco/dimensiones, eventos de viewport, fullscreen/reintento/concurrencia y acceso público independiente de sesión/API.
- Seis comprobaciones de dimensiones fallaron contra la versión anterior y pasaron con la corrección en píxeles. La ausencia simulada de APIs opcionales no reproducía el parser completo del navegador de la TV.
- Chromium local comprobó seis tarjetas con altura positiva y los cuatro giros en Full HD, además de formatos pequeños y entrada/salida de fullscreen. Tipado, lint y build de la corrección resultaron correctos.
- Esas pruebas y capturas pertenecían al prototipo y se retiran por solicitud del usuario. Sus cifras son históricas: **no representan la cobertura ni los resultados del repositorio después de la limpieza**.

Retiro verificado el 2026-10-22:

- Código Client idéntico a su estado anterior al ensayo (`git diff --quiet -- nodia-client` correcto): se restituyeron el provider de sesión, las rutas y el registro de traducciones. No quedan imports ni recursos de la demo en `src` o `public`.
- Se eliminaron el módulo, sus dos archivos de pruebas, fixtures, traducciones ES/EN, fotografías, capturas, documentación temporal y logs del ensayo. Este archivo conserva el aprendizaje sin enlaces a recursos retirados.
- Pruebas focalizadas de aplicación, rutas y `AuthSessionProvider`: **55 pruebas en 12 archivos correctas**. `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check` correctos.
- La salida regenerada de producción no contiene la ruta, referencias ni los recursos de la demo. El único cambio versionable que queda de este trabajo es `docs/features/billboards.md`; Billboards permanece sin implementar.

## Criterios para un futuro desarrollo

Antes de implementar Billboards, definir fuentes reales de productos/precios, ámbito por negocio, permisos, contenido permitido y forma de configurar cada panel. Aún no se han acordado esos contratos ni sus campos obligatorios.

Quedan pendientes las decisiones sobre actualización de precios, comportamiento sin conexión, caché, programación, cantidad de productos/pantallas y eventual acceso público. No deben deducirse del prototipo ni presentarse como capacidades existentes.

La aceptación futura deberá comprobar legibilidad a distancia, recorte/overscan, tamaños y orientaciones, teclado/control remoto, carga de imágenes y recuperación de fallos en los dispositivos concretos objetivo. Registrar modelo y navegador cuando puedan verificarse, separando pruebas de laboratorio de confirmación física.

Si hay una integración comercial, contrastar entidades, DTOs, casos de uso y autorización de Server; especificar manejo de errores y datos ausentes antes de exponer precios operativos. Los datos ficticios del ensayo no autorizan valores inventados en producción.

## Impacto NodiaAI

Conforme al [estándar de conocimiento](../nodia-ai/knowledge/README.md), este archivo conserva un antecedente técnico y su retiro; no define nuevas reglas comerciales, herramientas ni interpretación de resultados reales. Por ese alcance no se crea todavía una ficha de producto/funcionalidad ni se registra o publica conocimiento operativo.

Cuando Billboards se especifique como función de producto, deberán crearse sus fichas y enlaces, contrastarse contratos y estados reales, y aplicar las validaciones de publicación correspondientes. El nombre del producto y este Markdown no habilitan capacidades ni permisos de NodiaAI.
