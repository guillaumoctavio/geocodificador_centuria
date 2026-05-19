const { Client } = require('pg');
const { TABLA_DB, SUFIJO_UBICACION, db } = require('./config.js');
const { normalizarBase } = require('./normalizar.js');
const { georefBatch }    = require('./georef.js');

async function run() {
    const client = new Client(db);

    try {
        await client.connect();

        const res = await client.query(
            `SELECT id_geocoding, direccion_original FROM ${TABLA_DB} WHERE direccion_normalizada IS NULL`
        );
        const total = res.rows.length;
        console.log(`${total} direcciones por normalizar en ${TABLA_DB}`);
        if (total === 0) return;

        // ── Paso 1: normalización base (regex) ──────────────────────────────
        // Cada fila → su versión limpia sin sufijo (null = solo ruido)
        const basesPorId = new Map();
        for (const fila of res.rows) {
            basesPorId.set(fila.id_geocoding, normalizarBase(fila.direccion_original));
        }

        // ── Paso 2: consultar Georef solo para las únicas con contenido ─────
        const uniqueBases = [...new Set(
            [...basesPorId.values()].filter(b => b !== null && b !== '')
        )];

        console.log(`Consultando Georef AR para ${uniqueBases.length} direcciones únicas...`);
        const georefMap = await georefBatch(uniqueBases);

        const georefOk  = [...georefMap.values()].filter(v => v !== null).length;
        const georefPct = Math.round(georefOk / uniqueBases.length * 100);
        console.log(`Georef: ${georefOk}/${uniqueBases.length} encontradas (${georefPct}%)`);

        // ── Paso 3: armar valor final para cada fila ─────────────────────────
        // Prioridad: nombre oficial Georef > regex base > NO_GEOCODIFICABLE
        const ids = [], dirs = [];
        for (const fila of res.rows) {
            const base = basesPorId.get(fila.id_geocoding);

            if (!base) {
                // Entrada inválida (null, vacía) o solo ruido → NO_GEOCODIFICABLE
                ids.push(fila.id_geocoding);
                dirs.push('NO_GEOCODIFICABLE');
                continue;
            }

            const georef = georefMap.get(base) ?? null;
            // georef: nombre oficial INDEC (ya en Title Case desde Georef)
            // Fallback: nombre de nuestra normalización regex
            ids.push(fila.id_geocoding);
            dirs.push((georef ?? base) + SUFIJO_UBICACION);
        }

        // ── Paso 4: un solo UPDATE masivo ────────────────────────────────────
        await client.query(`
            UPDATE ${TABLA_DB} AS t
            SET direccion_normalizada = v.dir
            FROM unnest($1::int[], $2::text[]) AS v(id, dir)
            WHERE t.id_geocoding = v.id
        `, [ids, dirs]);

        const noGeo    = dirs.filter(d => d === 'NO_GEOCODIFICABLE').length;
        const fallback = dirs.filter(d => d !== 'NO_GEOCODIFICABLE').length - georefOk;
        console.log(`✅ ${total} registros actualizados:`);
        console.log(`   ${georefOk} con nombre oficial Georef`);
        console.log(`   ${fallback > 0 ? fallback : 0} con fallback regex`);
        console.log(`   ${noGeo} marcados como NO_GEOCODIFICABLE`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
