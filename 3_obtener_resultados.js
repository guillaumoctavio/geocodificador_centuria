require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');
const { Client } = require('pg');

// =========================================================
// ⚙️ CONFIGURACIÓN DE LA LOCALIDAD (Cambiar solo esto)
// =========================================================
const TABLA_DB = 'public.dim_geocoding_coronel_pringles'; // <-- Tu tabla en DBeaver
// =========================================================

async function run() {
    if (!fs.existsSync('jobs.json')) return console.error("Falta jobs.json");
    const urls = JSON.parse(fs.readFileSync('jobs.json', 'utf-8'));
    if (urls.length === 0) return console.log("No hay URLs para procesar.");

    const client = new Client({ 
        user: process.env.DB_USER, 
        host: process.env.DB_HOST, 
        database: process.env.DB_NAME, 
        password: process.env.DB_PASSWORD, 
        port: process.env.DB_PORT 
    });
    await client.connect();

    const procesados = new Set();
    let activo = true;

    while (activo) {
        console.log(`⏳ Verificando estado de los lotes...`);
        for (const url of urls) {
            if (procesados.has(url)) continue;
            try {
                const res = await axios.get(url);
                
                if (res.data.status === 'completed') {
                    console.log(`✅ Lote completado. Descargando y guardando en ${TABLA_DB}...`);
                    
                    // 1. Descargamos el CSV temporal
                    const csvData = await axios.get(res.data.url);
                    fs.writeFileSync('temp_results.csv', csvData.data);
                    
                    // 2. Leemos el CSV y lo guardamos en memoria (para no saturar la BD)
                    const filas = [];
                    await new Promise((resolve, reject) => {
                        fs.createReadStream('temp_results.csv')
                            .pipe(csv())
                            .on('data', (fila) => filas.push(fila))
                            .on('end', resolve)
                            .on('error', reject);
                    });

                    // 3. Procesamos los UPDATE uno por uno de forma segura usando la variable TABLA_DB
                    for (const fila of filas) {
                        if (fila.lat && fila.lon) {
                            const geom = `POINT (${fila.lon} ${fila.lat})`;
                            await client.query(`
                                UPDATE ${TABLA_DB} 
                                SET latitud = $1, longitud = $2, geom = $3 
                                WHERE direccion_normalizada = $4
                            `, [fila.lat, fila.lon, geom, fila.query]);
                        }
                    }
                    
                    procesados.add(url);
                    
                } else if (res.data.status !== 'pending' && res.data.status !== 'processing') {
                    console.log(`⚠️ Lote con estado inesperado: ${res.data.status}`);
                    procesados.add(url);
                }
            } catch (err) { 
                console.error("❌ Error de red al verificar URL:", err.message); 
            }
        }
        
        if (procesados.size === urls.length) {
            activo = false;
        } else {
            await new Promise(r => setTimeout(r, 60000)); // Espera 1 min
        }
    }
    
    // Limpieza de archivos temporales
    if (fs.existsSync('temp_results.csv')) fs.unlinkSync('temp_results.csv');
    
    await client.end();
    console.log(`🚀 ¡Geocodificación finalizada en la tabla ${TABLA_DB}!`);
}

run();