require('dotenv').config();
const { Client } = require('pg');
const correcciones = require('./reglas.js');

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function normalizarDireccion(direccion) {
    if (typeof direccion !== 'string' || !direccion) return "";
    let dir = direccion.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    const regexRuido = /\s+\b(port|dto|depto|dpto|dt|uf|uc|ed|timbre|tbre|tr|hab|of|pb|piso|un|cpo|cuerpo|lado|loft|bk|col|mod|torre|s\/n)\s*(\w+|\d+)?\b/g;
    dir = dir.replace(regexRuido, '');

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
    const client = new Client({ user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT });
    try {
        await client.connect();
        const res = await client.query(`SELECT id_geocoding, direccion_original, codigo_postal FROM public.dim_geocoding_perito_moreno WHERE direccion_normalizada IS NULL`);
        console.log(`Normalizando ${res.rows.length} direcciones...`);
        for (let fila of res.rows) {
            let dirNorm = normalizarDireccion(fila.direccion_original);
            let cp = fila.codigo_postal ? String(fila.codigo_postal).trim() : '';
            if (cp) dirNorm += `, CP ${cp}`;
            dirNorm += ', Perito Moreno, Santa Cruz, Argentina';
            await client.query(`UPDATE public.dim_geocoding_perito_moreno SET direccion_normalizada = $1 WHERE id_geocoding = $2`, [dirNorm, fila.id_geocoding]);
        }
        console.log("✅ Normalización completada en BD.");
    } catch (err) { console.error("❌ Error:", err.message); } finally { await client.end(); }
}
run();