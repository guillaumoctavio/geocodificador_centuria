const axios = require('axios');
const { Client } = require('pg');
const { TABLA_DB, db } = require('./config.js');

if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('❌ Falta variable de entorno: GOOGLE_MAPS_API_KEY');
    process.exit(1);
}

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const sleep   = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    const client = new Client(db);

    try {
        await client.connect();
        console.log(`✅ Conectado a PostgreSQL. Tabla: ${TABLA_DB}`);

        const res = await client.query(`
            SELECT id_geocoding, direccion_normalizada
            FROM ${TABLA_DB}
            WHERE direccion_normalizada IS NOT NULL
              AND direccion_normalizada != 'NO_GEOCODIFICABLE'
              AND latitud IS NULL
        `);

        if (res.rows.length === 0) {
            return console.log(`No hay direcciones pendientes en ${TABLA_DB}.`);
        }

        console.log(`🚀 Geocodificando ${res.rows.length} direcciones con Google Maps...`);

        let procesadas = 0, exitosas = 0;

        for (const fila of res.rows) {
            const { id_geocoding: id, direccion_normalizada: direccion } = fila;
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion)}&key=${API_KEY}`;

            try {
                const response = await axios.get(url);
                const data = response.data;

                if (data.status === 'OK' && data.results.length > 0) {
                    const { lat, lng: lon } = data.results[0].geometry.location;
                    const tipoPrecision     = data.results[0].geometry.location_type;
                    const geomPoint         = `POINT (${lon} ${lat})`;

                    // Guardar geom como geometry PostGIS real, no como texto
                    await client.query(`
                        UPDATE ${TABLA_DB}
                        SET latitud  = $1,
                            longitud = $2,
                            geom     = ST_GeomFromText($3, 4326)
                        WHERE id_geocoding = $4
                    `, [lat, lon, geomPoint, id]);

                    exitosas++;
                    console.log(`[${procesadas + 1}/${res.rows.length}] ✅ ${direccion} (${tipoPrecision})`);
                } else {
                    console.log(`[${procesadas + 1}/${res.rows.length}] ⚠️ No encontrada: ${direccion} (${data.status})`);
                }
            } catch (apiError) {
                console.error(`❌ Error en API: ${direccion}:`, apiError.message);
            }

            procesadas++;
            await sleep(50); // ~20 req/s, dentro del límite de Google
        }

        console.log(`\n🎉 Finalizado. ${exitosas}/${res.rows.length} geocodificadas en ${TABLA_DB}.`);

    } catch (dbError) {
        console.error('❌ Error de BD:', dbError.message);
    } finally {
        await client.end();
    }
}

run();
