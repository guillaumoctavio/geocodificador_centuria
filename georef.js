/**
 * Cliente para la API Georef del gobierno argentino.
 * Usada exclusivamente para obtener el nombre oficial INDEC de la calle.
 * Las coordenadas NO se usan de aquí — son aproximadas (centroide de cuadra).
 *
 * Docs: https://datosgobar.github.io/georef-ar-api/
 * Sin API key. Rate limit: ~200 req/s.
 */

const axios = require('axios');

const GEOREF_BASE  = 'https://apis.datos.gob.ar/georef/api';
const PROVINCIA_ID = '02'; // Ciudad Autónoma de Buenos Aires

/**
 * Consulta Georef con una dirección ya pre-normalizada (sin sufijo de ciudad).
 * Devuelve el nombre oficial de la calle + el número original (no el número
 * que Georef snappea, que puede desviarse del real).
 *
 * @param {string} baseNormalizada - Ej: "Corrientes 2500" o "Avenida Corrientes 2500"
 * @returns {string|null} Nombre oficial + número, o null si no hay match
 */
async function georefNormalizar(baseNormalizada) {
    try {
        const res = await axios.get(`${GEOREF_BASE}/direcciones`, {
            params: {
                direccion: baseNormalizada,
                provincia: PROVINCIA_ID,
                max: 1,
            },
            timeout: 6000,
        });

        const dirs = res.data?.direcciones;
        if (!dirs || dirs.length === 0) return null;

        const d       = dirs[0];
        const nombre  = d.calle?.nombre;
        if (!nombre) return null;

        // Usamos el número de nuestra entrada, no el de Georef
        // (Georef hace snapping al número de puerta más cercano válido)
        const match  = baseNormalizada.match(/(\d+)\s*$/);
        const numero = match ? match[1] : null;

        return numero ? `${nombre} ${numero}` : nombre;

    } catch {
        // Cualquier error de red o timeout → retornar null para usar el fallback
        return null;
    }
}

/**
 * Normaliza un lote de direcciones contra Georef en paralelo (N concurrentes).
 * Devuelve un Map: baseNormalizada → nombreOficial (o null si no encontró).
 *
 * @param {string[]} bases      - Array de direcciones pre-normalizadas únicas
 * @param {number}   concurrencia - Requests simultáneos (default: 10)
 */
async function georefBatch(bases, concurrencia = 10) {
    const resultado = new Map();
    let procesadas  = 0;

    for (let i = 0; i < bases.length; i += concurrencia) {
        const lote  = bases.slice(i, i + concurrencia);
        const resps = await Promise.all(lote.map(b => georefNormalizar(b)));
        lote.forEach((b, j) => resultado.set(b, resps[j]));

        procesadas += lote.length;
        if (procesadas % 200 === 0 || procesadas === bases.length) {
            console.log(`  Georef: ${procesadas}/${bases.length} direcciones consultadas`);
        }
    }

    return resultado;
}

module.exports = { georefNormalizar, georefBatch };
