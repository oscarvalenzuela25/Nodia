# Theme presets — synthetic browser QA

Start Vite in its own mode and port, then open `/src/test/manual/theme-presets/index.html`.
Optional parameters: `?actor=guest|member|admin&lang=es|en`. The actor and health
responses are synthetic; the Axios adapter rejects unrelated requests. No real
authentication, inference or application API writes occur.

Check topbar fit at320/390/599/600/900/1280px, search/keyboard/Escape/focus return,
light/dark independence, persistence on reload, draft retention and local table
scroll. Switch among subdued, bright and monochrome palettes. Browser storage
failure must keep the choice/search open and allow retry. This fixture is never
imported by the application; it does not verify production or physical devices.
