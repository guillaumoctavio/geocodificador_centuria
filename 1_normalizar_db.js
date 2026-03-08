require('dotenv').config();
const { Client } = require('pg');
const correcciones = require('./reglas.js');

const TABLA_DB = 'public.dim_geocoding_comuna_5'; 
const SUFIJO_UBICACION = ', Ciudad Autonoma de Buenos Aires, Argentina'; 

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizarDireccion(direccion) {
    if (typeof direccion !== 'string' || !direccion) return "";
    
    // 🔴 CAMBIO CLAVE: toUpperCase() para que las reglas Regex coincidan
    let dir = direccion.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    
    const regexRuido = /\s+\b(PORT|DTO|DEPTO|DPTO|DT|UF|UC|ED|TIMBRE|TBRE|TR|HAB|OF|PB|PISO|UN|CPO|CUERPO|LADO|LOFT|BK|MOD|TORRE|S\/N)\s*(\w+|\d+)?\b/g;
    dir = dir.replace(regexRuido, '').replace(/\//g, ' '); 

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
        user: process.env.DB_USER, host: process.env.DB_HOST, 
        database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT 
    });
    
    try {
        await client.connect();
        const res = await client.query(`SELECT id_geocoding, direccion_original FROM ${TABLA_DB} WHERE direccion_normalizada IS NULL`);
        console.log(`Normalizando ${res.rows.length} direcciones...`);
        
        for (let fila of res.rows) {
            let dirNorm = normalizarDireccion(fila.direccion_original);
            
            if (!dirNorm || dirNorm.trim() === '') {
                await client.query(`UPDATE ${TABLA_DB} SET direccion_normalizada = 'NO_GEOCODIFICABLE' WHERE id_geocoding = $1`, [fila.id_geocoding]);
                continue;
            }

            // 🔴 CAMBIO CLAVE: Ignoramos el CP basura de la tabla y solo pegamos la ciudad
            dirNorm += SUFIJO_UBICACION;
            
            await client.query(`UPDATE ${TABLA_DB} SET direccion_normalizada = $1 WHERE id_geocoding = $2`, [dirNorm, fila.id_geocoding]);
        }
        console.log("✅ Normalización completada en BD. ¡Revisá la tabla en DBeaver!");
    } catch (err) { console.error("❌ Error:", err.message); } 
    finally { await client.end(); }
}

run();