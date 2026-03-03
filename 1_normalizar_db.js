require('dotenv').config();
const { Client } = require('pg');
const correcciones = require('./reglas.js');

// =========================================================
// ⚙️ CONFIGURACIÓN DE LA LOCALIDAD (Cambiar solo esto)
// =========================================================
const TABLA_DB = 'public.dim_geocoding_coronel_pringles'; // <-- Tu tabla en DBeaver
const SUFIJO_UBICACION = ', Coronel Pringles, Buenos Aires, Argentina'; // <-- Ciudad y Provincia
// =========================================================

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizarDireccion(direccion) {
    if (typeof direccion !== 'string' || !direccion) return "";
    let dir = direccion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    const regexRuido = /\s+\b(port|dto|depto|dpto|dt|uf|uc|ed|timbre|tbre|tr|hab|of|pb|piso|un|cpo|cuerpo|lado|loft|bk|mod|torre|s\/n)\s*(\w+|\d+)?\b/g;
    dir = dir.replace(regexRuido, '').replace(/\//g, ' '); // Quitamos ruido y borramos las barras divisorias

    for (const regla of correcciones) {
        const modificada = dir.replace(regla[0], regla[1]);
        if (modificada !== dir) { dir = modificada; break; }
    }

    const match = dir.match(/(\d+)$/);
    let calle = dir, numero = '';
    if (match) { numero = match[1]; calle = dir.substring(0, match.index).trim(); }
    return numero ? `${toTitleCase(calle)} ${numero}` : toTitleCase(calle);
}

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
        
        // Usamos la variable TABLA_DB dinámicamente
        const res = await client.query(`SELECT id_geocoding, direccion_original, codigo_postal FROM ${TABLA_DB} WHERE direccion_normalizada IS NULL`);
        console.log(`Normalizando ${res.rows.length} direcciones en la tabla ${TABLA_DB}...`);
        
        for (let fila of res.rows) {
            let dirNorm = normalizarDireccion(fila.direccion_original);
            
            // Si la limpieza dejó la calle vacía, la ignoramos.
            if (!dirNorm || dirNorm.trim() === '') {
                await client.query(`UPDATE ${TABLA_DB} SET direccion_normalizada = 'NO_GEOCODIFICABLE' WHERE id_geocoding = $1`, [fila.id_geocoding]);
                continue;
            }

            let cp = fila.codigo_postal ? String(fila.codigo_postal).trim() : '';
            if (cp) dirNorm += `, CP ${cp}`;
            
            // Usamos la variable SUFIJO_UBICACION
            dirNorm += SUFIJO_UBICACION;
            
            await client.query(`UPDATE ${TABLA_DB} SET direccion_normalizada = $1 WHERE id_geocoding = $2`, [dirNorm, fila.id_geocoding]);
        }
        console.log("✅ Normalización completada en BD.");
    } catch (err) { 
        console.error("❌ Error:", err.message); 
    } finally { 
        await client.end(); 
    }
}

run();