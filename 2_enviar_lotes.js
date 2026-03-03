require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { Client } = require('pg');

// =========================================================
// ⚙️ CONFIGURACIÓN DE LA LOCALIDAD (Cambiar solo esto)
// =========================================================
const TABLA_DB = 'public.dim_geocoding_coronel_pringles'; // <-- Tu tabla en DBeaver
// =========================================================

const TAMANO_LOTE = 1000;
const url_api = `https://api.geoapify.com/v1/batch/geocode/search?apiKey=${process.env.GEOAPIFY_API_KEY}`;

async function run() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT
    });

    try {
        await client.connect();

        // Usamos la variable TABLA_DB e ignoramos los NO_GEOCODIFICABLE
        const res = await client.query(`
            SELECT DISTINCT direccion_normalizada 
            FROM ${TABLA_DB} 
            WHERE direccion_normalizada IS NOT NULL 
              AND direccion_normalizada != 'NO_GEOCODIFICABLE'
              AND latitud IS NULL
        `);

        const direcciones = res.rows.map(r => r.direccion_normalizada);

        if (direcciones.length === 0) {
            return console.log("Nada para enviar.");
        }

        console.log(`Preparando ${direcciones.length} direcciones únicas de la tabla ${TABLA_DB}...`);

        const urls = [];
        for (let i = 0; i < direcciones.length; i += TAMANO_LOTE) {
            const lote = direcciones.slice(i, i + TAMANO_LOTE);
            console.log(`Enviando Lote #${(i / TAMANO_LOTE) + 1}...`);
            const response = await axios.post(url_api, lote);
            if (response.status === 202) urls.push(response.data.url);
        }

        fs.writeFileSync('jobs.json', JSON.stringify(urls, null, 2));
        console.log(`✅ Lotes enviados. URLs guardadas en jobs.json`);

    } catch (err) {
        console.error("❌ Error:", err.message);
    } finally {
        await client.end();
    }
}

run();