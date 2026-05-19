# Geocodificador Centuria

Pipeline de geocodificación masiva de direcciones postales para la Ciudad Autónoma de Buenos Aires (CABA). Toma direcciones crudas almacenadas en PostgreSQL, las normaliza, las envía a una API de geocodificación y persiste las coordenadas junto con geometrías PostGIS reales.

## Flujos disponibles

```
[PostgreSQL] → 1_normalizar_db.js → 2_enviar_lotes.js → 3_obtener_resultados.js → [PostgreSQL con coords]
               (regex + Georef AR)                        (Geoapify — batch, coords exactas)

[PostgreSQL] → 1_normalizar_db.js → 2_geocodificard_google_db.js → [PostgreSQL con coords]
               (regex + Georef AR)    (Google Maps — sincrónico, coords exactas)
```

El paso 1 combina dos fuentes de normalización en cascada:
1. **Regex propios** (`reglas.js`) — corrigen ruido, typos y abreviaturas del padrón
2. **API Georef AR** — valida el nombre de calle contra la base oficial INDEC y devuelve el nombre canónico

Las coordenadas siempre provienen de Geoapify o Google Maps (nunca de Georef, que solo da aproximados).

---

## Requisitos

- **Node.js** >= 18
- **PostgreSQL** con extensión **PostGIS** habilitada
- Cuenta en **[Geoapify](https://www.geoapify.com/)** (flujo batch) o en **Google Maps Platform** (flujo sincrónico)

---

## Instalación

```bash
cd geocodificador_centuria
npm install
```

Crear `.env` en la raíz de esta carpeta:

```env
# Base de datos
DB_USER=tu_usuario
DB_HOST=localhost
DB_NAME=analisis_electoral
DB_PASSWORD=tu_contraseña
DB_PORT=5432

# Tabla a procesar (se puede cambiar sin tocar ningún script)
TABLA_DB=geodata.geocoding_comuna_5_25

# APIs (solo la que uses)
GEOAPIFY_API_KEY=tu_api_key_geoapify
GOOGLE_MAPS_API_KEY=tu_api_key_google
```

**`TABLA_DB` es la única variable que cambia entre localidades.** No hay que editar ningún script.

---

## Estructura de archivos

```
geocodificador_centuria/
├── config.js           ← configuración centralizada (lee .env)
├── normalizar.js       ← normalizarBase() y normalizarDireccion()
├── reglas.js           ← motor de reglas regex para CABA
├── georef.js           ← cliente API Georef AR (nombre oficial INDEC)
├── 1_normalizar_db.js  ← Paso 1: normalizar (regex → Georef → BD)
├── 2_enviar_lotes.js   ← Paso 2a: enviar lotes a Geoapify
├── 2_geocodificard_google_db.js  ← Paso 2b: geocodificar con Google (alternativo)
├── 3_obtener_resultados.js       ← Paso 3: obtener resultados de Geoapify y guardar
├── jobs.json           ← URLs de lotes pendientes (generado por paso 2a)
└── tests/
    ├── reglas.test.js      ← 15 tests unitarios de reglas.js
    └── normalizar.test.js  ← 14 tests de normalizarDireccion()
```

---

## Estructura esperada de la tabla en PostgreSQL

| Columna | Tipo | Descripción |
|---|---|---|
| `id_geocoding` | INTEGER / SERIAL | PK |
| `direccion_original` | TEXT | Domicilio crudo de la fuente |
| `direccion_normalizada` | TEXT | Llenado en Paso 1. `NULL` = pendiente. `NO_GEOCODIFICABLE` = descartada |
| `latitud` | NUMERIC | Llenado en Paso 3. `NULL` = pendiente o no encontrada |
| `longitud` | NUMERIC | Llenado en Paso 3 |
| `geom` | GEOMETRY(Point, 4326) | Punto PostGIS real (no texto) |

---

## Flujo Geoapify — batch asincrónico

### Paso 1 — Normalizar

```bash
node 1_normalizar_db.js
```

Lee filas donde `direccion_normalizada IS NULL` y escribe el resultado en un solo `UPDATE` masivo (via `unnest`). El proceso tiene tres sub-pasos:

**1a — Limpieza regex (`normalizar.js` + `reglas.js`)**
1. Mayúsculas + quitar tildes, puntos, comas.
2. Elimina ruido de vivienda: DEPTO, PISO, TIMBRE, TORRE, UF, etc.
3. Aplica reglas de `reglas.js` (typos, abreviaturas CABA, prefijos de avenidas).
4. Title Case en la calle, número separado.
5. Dirección vacía tras limpieza → `NO_GEOCODIFICABLE`.

**1b — Validación oficial Georef AR (`georef.js`)**
- Consulta `apis.datos.gob.ar/georef/api/direcciones` para cada dirección única válida.
- Si Georef reconoce la calle → reemplaza el nombre con el nombre oficial INDEC.
- Si Georef no encuentra → usa el resultado de la limpieza regex (fallback).
- Se usa **solo el nombre de calle** de Georef; el número viene siempre de nuestra entrada (Georef hace snapping al número válido más cercano, lo que puede desviarse del real).
- Sin API key. Rate limit ~200 req/s. Las direcciones únicas se procesan en lotes de 10 concurrentes.

**1c — Escritura en BD**
- Agrega sufijo `, Ciudad Autonoma de Buenos Aires, Argentina`.
- Un solo `UPDATE ... FROM unnest()` para todas las filas.

### Paso 2 — Enviar lotes

```bash
node 2_enviar_lotes.js
```

Lee `direccion_normalizada` únicas sin coordenadas (hasta `LIMITE_REGISTROS = 20000`), las envía a Geoapify en lotes de `TAMANO_LOTE = 1000`. Las URLs de resultado quedan en `jobs.json`.

### Paso 3 — Obtener resultados

```bash
node 3_obtener_resultados.js
```

Lee `jobs.json`, consulta cada URL y:
- HTTP 202 → lote en proceso, queda pendiente.
- HTTP 200 → itera resultados, actualiza `latitud`, `longitud`, `geom = ST_GeomFromText(...)`.
- Sin coordenadas → escribe `latitud = NULL, longitud = NULL` (no `0, 0`).
- `jobs.json` se escribe atómicamente (write `.tmp` + rename) para evitar corrupción.

Si el proceso se interrumpe, relanzar `node 3_obtener_resultados.js` retoma desde donde estaba.

---

## Flujo Google Maps — sincrónico

```bash
node 1_normalizar_db.js
node 2_geocodificard_google_db.js
```

Geocodifica dirección por dirección con un delay de 50 ms entre consultas (~20 req/s). Guarda `latitud`, `longitud` y `geom = ST_GeomFromText(...)` como geometry PostGIS real. Registra el tipo de precisión (`ROOFTOP`, `GEOMETRIC_CENTER`, etc.) en consola.

---

## Motor de reglas (`reglas.js`)

Expresiones regulares organizadas en 7 categorías, aplicadas en orden. Se detiene en la primera que produce un cambio. Las reglas de limpieza (doble espacio, trim) se aplican siempre al final.

| # | Categoría | Ejemplos |
|---|---|---|
| 1 | Eliminación S/N | `RIVADAVIA S/N` → `RIVADAVIA` |
| 2 | Ruido de viviendas | `TORRE 2`, `DPTO 4A`, `PISO 3`, `TIMBRE` → eliminados |
| 3 | Múltiples números | `RIVADAVIA 13 1303 3645` → `RIVADAVIA 3645` |
| 4 | Correcciones ortográficas | `MUIZ` → `MUÑIZ`, `NUEZ` → `NUÑEZ`, `H YRIGOYEN` → `HIPOLITO YRIGOYEN` |
| 5 | Estandarización de calles | `SANCHEZ LORIA` → `SANCHEZ DE LORIA`, `B MITRE` → `BARTOLOME MITRE` |
| 6 | Prefijos de avenidas | `AV.`, `AV `, `AVDA ` → `AVENIDA ` |
| 7 | Limpieza de espacios | Colapsa múltiples, trim final (siempre aplica) |

**Nota de orden:** las alternativas dentro de cada regex están ordenadas de mayor a menor longitud para evitar que una alternativa corta (ej. `T`) capture antes que una larga (ej. `TORRE`).

---

## Tests

Sin dependencias adicionales — usa el test runner nativo de Node 18.

```bash
node --test tests/reglas.test.js tests/normalizar.test.js
# 29 tests, 0 failures
```

---

## Dependencias

| Paquete | Uso |
|---|---|
| `axios` | Llamadas HTTP a las APIs |
| `pg` | Cliente PostgreSQL |
| `dotenv` | Variables de entorno desde `.env` |

---

## Notas operativas

- **Cambiar de tabla:** definir `TABLA_DB=geodata.geocoding_nueva_localidad` en `.env`. No hay que tocar ningún script.
- **Freno de mano:** `LIMITE_REGISTROS = 20000` en `config.js` evita enviar más registros de los previstos en una corrida.
- **Valores NULL:** `latitud = NULL` en la tabla indica dirección no encontrada. `latitud = 0` indica un punto real en el océano (no debería aparecer con la versión actual).
- **Reintentos:** si `3_obtener_resultados.js` falla a mitad, relanzar sin pérdida de datos — solo actualiza registros donde `latitud IS NULL` y retoma las URLs de `jobs.json`.
