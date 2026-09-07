# ADR-002 — Catálogo de Traducciones (i18n) Centralizado en Backend mediante Claves

> Estado: aprobado
> Fecha: 2026-09-07

## Contexto

El sistema Nodia requiere soporte multiidioma (`es`, `en` y futuros idiomas) para nombres legibles, descripciones y mensajes asociados a entidades del sistema (`roles`, `modules`, `actions`) y elementos de la interfaz. Originalmente, las traducciones residían en archivos estáticos JSON dentro del frontend (`nodia-client`). Se tomó la decisión de trasladar la administración de los textos al backend (`nodia-server`) y base de datos (PostgreSQL), evitando duplicidad y permitiendo que los textos de negocio sean gestionados dinámicamente sin requerir re-despliegues del cliente web.

## Opciones consideradas

### Opción A: Tabla Polimórfica con Columnas Fijas de Idioma (`source, source_id, es, en`)

- Ventajas:
  - Estructura conceptualmente intuitiva en una sola tabla.
- Desventajas:
  - Imposibilidad de aplicar `FOREIGN KEY` real en PostgreSQL (riesgo alto de registros huérfanos).
  - Incapacidad de manejar entidades con múltiples campos traducibles (ej. `actions` tiene nombre y `description`).
  - Violación de la Primera Forma Normal (1NF); incorporar un nuevo idioma (ej. `pt`, `fr`) exigiría `ALTER TABLE` en producción.
  - JOINs polimórficos de bajo rendimiento en lecturas masivas.

### Opción B: Columnas `jsonb` Nativas por Entidad (`name: jsonb, description: jsonb`)

- Ventajas:
  - Cero JOINs en lecturas de entidades individuales.
  - Soporte nativo de índices GIN en PostgreSQL.
- Desventajas:
  - No provee un catálogo unificado para extraer diccionarios completos de UI en un solo payload.
  - Mayor complejidad de tipado en DTOs y migraciones si se agregan campos traducibles en muchas tablas.

### Opción C: Tabla Centralizada de Catálogo Lingüístico por Clave (`translations(key, locale, value)`)

- Ventajas:
  - Aprovecha los campos `key` únicos existentes en `roles`, `modules` y `actions` (ej. `roles.admin`, `actions.users.create.desc`).
  - Extensible a N idiomas sin alterar el esquema DDL (`INSERT` de nuevas filas por locale).
  - Permite descargar el bundle lingüístico completo (`GET /api/v1/translations?locale=es`) y cachearlo eficientemente (en memoria, Redis o CDN/HTTP cache-control).
  - Índices B-Tree optimizados: índice único `(key, locale)` para evitar colisiones y `(locale, key)` para extracción en milisegundos.
- Desventajas:
  - Para entidades dinámicas transaccionales sin `key` natural (ej. comentarios), se debe seguir la convención de namespace `<tabla>.<id>.<campo>`.

## Decisión

Se adopta la **Opción C**: Implementar la tabla `translations` en PostgreSQL indexada por `(key, locale)` como catálogo central de traducciones del sistema.

### Estructura DBML aprobada:

```dbml
Table translations [headercolor: #175e7a] {
	id bigint [ pk, increment, not null ]
	key varchar(255) [ not null ]
	locale varchar(10) [ not null ]
	value text [ not null ]
	created_at timestamp [ not null ]
	updated_at timestamp [ not null ]

	indexes {
		(key, locale) [ name: 'uq_translation_key_locale', unique ]
		(locale, key) [ name: 'idx_translation_locale_key' ]
	}
}
```

## Consecuencias

- Consecuencias positivas:
  - Backend como única fuente de verdad para i18n.
  - Rendimiento óptimo en lecturas mediante índices compuestos y capacidad de caché de bundles.
  - Integridad de datos sin necesidad de DDLs destructivos al expandir idiomas.
- Costos o riesgos aceptados:
  - El backend deberá sincronizar o sembrar (`seed`) las traducciones iniciales correspondientes a los registros base del sistema.
- Trabajo posterior:
  - Crear la entidad TypeORM `Translation`, DTOs y migración/seed en `nodia-server`.
  - Crear endpoint de consumo de bundles (`GET /api/v1/translations`).

## Referencias

- `docs/mvp/03-domain-model-erd.md`
- `docs/mvp/00-progress.md`
