const axios = require('axios');
const fs    = require('fs');
const { Client } = require('pg');
const { TABLA_DB, TAMANO_LOTE, LIMITE_REGISTROS, db } = require('./config.js');

if (!process.env.GEOAPIFY_API_KEY) {
    console.error('❌ Falta variable de entorno: GEOAPIFY_API_KEY');
    process.exit(1);
}

const url_api = `https://api.geoapify.com/v1/batch/geocode/search?apiKey=${process.env.GEOAPIFY_API_KEY}`;

async function run() {
    const client = new Client(db);

    try {
        await client.connect();

        const res = await client.query(`
            SELECT DISTINCT direccion_normalizada
            FROM ${TABLA_DB}
            WHERE direccion_normalizada IS NOT NULL
              AND direccion_normalizada != 'NO_GEOCODIFICABLE'
              AND latitud IS NULL
            LIMIT ${LIMITE_REGISTROS}
        `);

        const direcciones = res.rows.map(r => r.direccion_normalizada);

        if (direcciones.length === 0) {
            return console.log('No hay direcciones pendientes para enviar.');
        }

        console.log(`Preparando ${direcciones.length} direcciones únicas de ${TABLA_DB}...`);

        const urls = [];
        for (let i = 0; i < direcciones.length; i += TAMANO_LOTE) {
            const lote = direcciones.slice(i, i + TAMANO_LOTE);
            console.log(`Enviando lote #${Math.floor(i / TAMANO_LOTE) + 1}...`);
            const response = await axios.post(url_api, lote);
            if (response.status === 202) urls.push(response.data.url);
        }

        fs.writeFileSync('jobs.json', JSON.stringify(urls, null, 2));
        console.log(`✅ ${urls.length} lotes enviados. URLs guardadas en jobs.json.`);

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
