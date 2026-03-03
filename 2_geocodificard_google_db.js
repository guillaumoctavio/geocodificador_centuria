require('dotenv').config();
const axios = require('axios');
const { Client } = require('pg');

// =========================================================
// ⚙️ CONFIGURACIÓN DE LA LOCALIDAD (Cambiar solo esto)
// =========================================================
const TABLA_DB = 'public.dim_geocoding_coronel_pringles'; // <-- Tu tabla en DBeaver
// =========================================================

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Función para pausar el script unos milisegundos y no saturar a Google
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        await client.connect();
        console.log("✅ Conectado a PostgreSQL.");

        // 1. Buscamos direcciones válidas que no tengan latitud aún usando la variable TABLA_DB
        const res = await client.query(`
            SELECT id_geocoding, direccion_normalizada 
            FROM ${TABLA_DB} 
            WHERE direccion_normalizada IS NOT NULL 
              AND direccion_normalizada != 'NO_GEOCODIFICABLE'
              AND latitud IS NULL
        `);

        if (res.rows.length === 0) {
            return console.log(`No hay direcciones pendientes por geocodificar en ${TABLA_DB}.`);
        }

        console.log(`🚀 Iniciando geocodificación de ${res.rows.length} direcciones con Google Maps...`);

        let procesadas = 0;
        let exitosas = 0;

        // 2. Iteramos una por una
        for (let fila of res.rows) {
            const id = fila.id_geocoding;
            const direccion = fila.direccion_normalizada;
            
            // Codificamos la URL para que acepte espacios y acentos
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion)}&key=${API_KEY}`;

            try {
                const response = await axios.get(url);
                const data = response.data;

                if (data.status === 'OK' && data.results.length > 0) {
                    const location = data.results[0].geometry.location;
                    const lat = location.lat;
                    const lon = location.lng;
                    const tipoPrecision = data.results[0].geometry.location_type; // Ej: ROOFTOP, GEOMETRIC_CENTER

                    // Armamos el texto para la columna geométrica (POINT lon lat)
                    const geomPoint = `POINT (${lon} ${lat})`;

                    // Actualizamos la base de datos inyectando la variable TABLA_DB
                    await client.query(`
                        UPDATE ${TABLA_DB}
                        SET latitud = $1, longitud = $2, geom = $3
                        WHERE id_geocoding = $4
                    `, [lat, lon, geomPoint, id]);

                    exitosas++;
                    console.log(`[${procesadas + 1}/${res.rows.length}] ✅ Éxito: ${direccion} (${tipoPrecision})`);
                } else {
                    console.log(`[${procesadas + 1}/${res.rows.length}] ⚠️ No encontrada: ${direccion} (Status: ${data.status})`);
                }
            } catch (apiError) {
                console.error(`❌ Error en API con ${direccion}:`, apiError.message);
            }

            procesadas++;
            // Pausa de 50ms entre consultas para respetar el límite de Google (50 req/segundo)
            await sleep(50); 
        }

        console.log(`\n🎉 PROCESO FINALIZADO. Se geocodificaron ${exitosas} de ${res.rows.length} direcciones en ${TABLA_DB}.`);

    } catch (dbError) {
        console.error("❌ Error de Base de Datos:", dbError.message);
    } finally {
        await client.end();
    }
}

run();