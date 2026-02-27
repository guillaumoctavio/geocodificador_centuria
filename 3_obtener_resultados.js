require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const { Client } = require('pg');

async function run() {
    if (!fs.existsSync('jobs.json')) return console.error("Falta jobs.json");
    const urls = JSON.parse(fs.readFileSync('jobs.json', 'utf-8'));
    if (urls.length === 0) return;

    const client = new Client({ user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT });
    await client.connect();

    const procesados = new Set();
    let activo = true;

    while (activo) {
        console.log(`⏳ Verificando estado...`);
        for (const url of urls) {
            if (procesados.has(url)) continue;
            try {
                const res = await axios.get(url);
                if (res.data.status === 'completed') {
                    console.log(`✅ Lote completado. Guardando en BD...`);
                    const csvData = await axios.get(res.data.url);
                    fs.writeFileSync('temp_results.csv', csvData.data);
                    
                    await new Promise(resolve => {
                        fs.createReadStream('temp_results.csv').pipe(csv()).on('data', async (fila) => {
                            if (fila.lat && fila.lon) {
                                const geom = `POINT (${fila.lon} ${fila.lat})`;
                                await client.query(`UPDATE public.dim_geocoding_perito_moreno SET latitud = $1, longitud = $2, geom = $3 WHERE direccion_normalizada = $4`, [fila.lat, fila.lon, geom, fila.query]);
                            }
                        }).on('end', resolve);
                    });
                    procesados.add(url);
                } else if (res.data.status !== 'pending' && res.data.status !== 'processing') {
                    procesados.add(url);
                }
            } catch (err) { console.error("Error de red"); }
        }
        if (procesados.size === urls.length) activo = false;
        else await new Promise(r => setTimeout(r, 60000)); // Espera 1 min
    }
    if (fs.existsSync('temp_results.csv')) fs.unlinkSync('temp_results.csv');
    await client.end();
    console.log("🚀 ¡Geocodificación finalizada en la Base de Datos!");
}
run();