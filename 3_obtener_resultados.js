require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { Client } = require('pg');

// =========================================================
// ⚙️ CONFIGURACIÓN DE LA LOCALIDAD
// =========================================================
const TABLA_DB = 'public.dim_geocoding_comuna_5';
// =========================================================

async function run() {
    if (!fs.existsSync('jobs.json')) return console.error("❌ Falta jobs.json");
    
    let urls = JSON.parse(fs.readFileSync('jobs.json', 'utf-8'));
    urls = urls.filter(u => u !== null); 
    
    if (urls.length === 0) return console.log("✅ No hay URLs para procesar en jobs.json.");

    const client = new Client({ 
        user: process.env.DB_USER, 
        host: process.env.DB_HOST, 
        database: process.env.DB_NAME, 
        password: process.env.DB_PASSWORD, 
        port: process.env.DB_PORT 
    });
    await client.connect();

    let activo = true;

    while (activo) {
        console.log(`\n⏳ Verificando estado de ${urls.length} lotes pendientes...`);
        let pendientes = [];

        for (const url of urls) {
            try {
                const urlConKey = url.includes('apiKey=') ? url : `${url}&apiKey=${process.env.GEOAPIFY_API_KEY}`;
                
                const res = await axios.get(urlConKey);
                
                if (res.status === 202) {
                    console.log(`⏳ Lote aún en proceso en Geoapify...`);
                    pendientes.push(url); 
                } 
                else if (res.status === 200 && Array.isArray(res.data)) {
                    console.log(`✅ Lote completado. Guardando coordenadas en ${TABLA_DB}...`);
                    
                    const resultados = res.data;
                    let count = 0;

                    for (const item of resultados) {
                        const direccionOriginal = item.query.text; 
                        
                        if (item.lat && item.lon) {
                            const geom = `POINT (${item.lon} ${item.lat})`;
                            
                            // =========================================================
                            // 🔴 CORRECCIÓN AQUÍ: ELIMINADO geom_qgis DEL UPDATE
                            // =========================================================
                            await client.query(`
                                UPDATE ${TABLA_DB} 
                                SET latitud = $1, longitud = $2, 
                                    geom = ST_GeomFromText($3, 4326)
                                WHERE direccion_normalizada = $4
                            `, [item.lat, item.lon, geom, direccionOriginal]);
                            count++;
                        } else {
                            await client.query(`
                                UPDATE ${TABLA_DB} 
                                SET latitud = 0, longitud = 0 
                                WHERE direccion_normalizada = $1
                            `, [direccionOriginal]);
                        }
                    }
                    console.log(`   -> Se actualizaron ${count} registros de este lote.`);
                    
                } else {
                    console.log(`⚠️ Estado inesperado del servidor: HTTP ${res.status}`);
                    pendientes.push(url);
                }
            } catch (err) { 
                console.error("❌ Error de red al verificar URL:", err.message); 
                pendientes.push(url); 
            }
        }
        
        urls = pendientes;
        fs.writeFileSync('jobs.json', JSON.stringify(urls, null, 2));
        
        if (urls.length === 0) {
            activo = false;
        } else {
            console.log("💤 Esperando 30 segundos antes de volver a consultar a Geoapify...");
            await new Promise(r => setTimeout(r, 30000)); 
        }
    }
    
    await client.end();
    console.log(`\n🚀 ¡Geocodificación 100% finalizada en la tabla ${TABLA_DB}!`);
}

run();