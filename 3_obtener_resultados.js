const axios = require('axios');
const fs    = require('fs');
const { Client } = require('pg');
const { TABLA_DB, db } = require('./config.js');

if (!process.env.GEOAPIFY_API_KEY) {
    console.error('❌ Falta variable de entorno: GEOAPIFY_API_KEY');
    process.exit(1);
}

function guardarJobs(urls) {
    // Escritura atómica: escribir a .tmp y renombrar para evitar corrupción
    const tmp = 'jobs.json.tmp';
    fs.writeFileSync(tmp, JSON.stringify(urls, null, 2));
    fs.renameSync(tmp, 'jobs.json');
}

async function run() {
    if (!fs.existsSync('jobs.json')) return console.error('❌ Falta jobs.json');

    let urls = JSON.parse(fs.readFileSync('jobs.json', 'utf-8')).filter(u => u !== null);
    if (urls.length === 0) return console.log('✅ No hay URLs para procesar en jobs.json.');

    const client = new Client(db);
    await client.connect();

    while (urls.length > 0) {
        console.log(`\n⏳ Verificando ${urls.length} lotes pendientes en ${TABLA_DB}...`);
        const pendientes = [];

        for (const url of urls) {
            try {
                const urlConKey = url.includes('apiKey=') ? url : `${url}&apiKey=${process.env.GEOAPIFY_API_KEY}`;
                const res = await axios.get(urlConKey);

                if (res.status === 202) {
                    console.log('⏳ Lote aún en proceso en Geoapify...');
                    pendientes.push(url);

                } else if (res.status === 200 && Array.isArray(res.data)) {
                    let count = 0;

                    for (const item of res.data) {
                        const direccionOriginal = item.query.text;

                        if (item.lat && item.lon) {
                            const geom = `POINT (${item.lon} ${item.lat})`;
                            await client.query(`
                                UPDATE ${TABLA_DB}
                                SET latitud  = $1,
                                    longitud = $2,
                                    geom     = ST_GeomFromText($3, 4326)
                                WHERE direccion_normalizada = $4
                            `, [item.lat, item.lon, geom, direccionOriginal]);
                            count++;
                        } else {
                            // Dirección no encontrada: dejar NULL en lugar de (0, 0)
                            // para no generar puntos falsos en el Golfo de Guinea
                            await client.query(`
                                UPDATE ${TABLA_DB}
                                SET latitud = NULL, longitud = NULL
                                WHERE direccion_normalizada = $1
                                  AND latitud IS NULL
                            `, [direccionOriginal]);
                        }
                    }
                    console.log(`✅ Lote completado — ${count} registros geocodificados.`);

                } else {
                    console.log(`⚠️ Estado inesperado: HTTP ${res.status}`);
                    pendientes.push(url);
                }
            } catch (err) {
                console.error('❌ Error de red:', err.message);
                pendientes.push(url);
            }
        }

        urls = pendientes;
        guardarJobs(urls);

        if (urls.length > 0) {
            console.log('💤 Esperando 30 segundos antes de reintentar...');
            await new Promise(r => setTimeout(r, 30000));
        }
    }

    await client.end();
    console.log(`\n🚀 Geocodificación finalizada en ${TABLA_DB}.`);
}

run();
