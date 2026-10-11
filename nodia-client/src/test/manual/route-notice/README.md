# Aviso de autorización bajo el topbar

Fixture aislado que renderiza las rutas de producción y el layout real. El adaptador de Axios intercepta todas las solicitudes: solo datos sintéticos, sin acceso a cuentas ni servicios reales.

Con Vite local, abrir `/src/test/manual/route-notice/index.html`:

- `theme=dark` y `lang=en`: tema e idioma alternativos.
- `cached=1`: contexto previo disponible y revalidación fallida; página conservada e inerte.
- `recover=1`: primer fallo, primer reintento fallido y segundo reintento exitoso. Cada reintento tarda 800 ms para observar el bloqueo del botón.

Comprobar que el aviso aparece después del topbar, dentro del ancho del contenido, con drawer abierto o colapsado. En xs, la acción ocupa una fila completa y mide al menos44px de alto; no hay scroll horizontal del documento. Reintentar con teclado debe conservar el shell y el aviso hasta resolver. Al recuperar el contexto desaparece el aviso y se habilita la página. Las pruebas automatizadas correspondientes están en `src/test/routes/RouteNotices.test.tsx`.
