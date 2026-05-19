const correcciones = require('./reglas.js');
const { SUFIJO_UBICACION } = require('./config.js');

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Limpieza y normalización base de una dirección postal.
 * NO agrega sufijo de ciudad. Útil como input para la API Georef.
 *
 * Retorna:
 *   - string (Title Case, sin sufijo) para entradas válidas
 *   - null  si la dirección queda vacía tras la limpieza (solo ruido)
 *   - ''    si la entrada es nula, vacía o no es string
 */
function normalizarBase(direccion) {
    if (typeof direccion !== 'string' || !direccion) return '';

    // Mayúsculas, quitar tildes, puntos, comas y espacios múltiples
    let dir = direccion
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[.,]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    // Eliminar ruido de vivienda antes de aplicar reglas
    const regexRuido = /\s+\b(PORT|DTO|DEPTO|DPTO|DT|UF|UC|ED|TIMBRE|TBRE|TR|HAB|OF|PB|PISO|UN|CPO|CUERPO|LADO|LOFT|BK|MOD|TORRE|S\/N)\s*(\w+|\d+)?\b/g;
    dir = dir.replace(regexRuido, '').replace(/\//g, ' ');

    // Reglas: detener en la primera que produce cambio.
    // Las últimas 2 (doble espacio + trim) se aplican siempre.
    const mainRules    = correcciones.slice(0, correcciones.length - 2);
    const cleanupRules = correcciones.slice(correcciones.length - 2);

    for (const regla of mainRules) {
        const mod = dir.replace(regla[0], regla[1]);
        if (mod !== dir) { dir = mod; break; }
    }
    for (const regla of cleanupRules) {
        dir = dir.replace(regla[0], regla[1]);
    }

    // Separar calle y número, aplicar Title Case a la calle
    const match = dir.match(/(\d+)$/);
    let calle = dir, numero = '';
    if (match) {
        numero = match[1];
        calle  = dir.substring(0, match.index).trim();
    }

    const resultado = numero ? `${toTitleCase(calle)} ${numero}` : toTitleCase(calle);

    if (!resultado.trim()) return null; // entrada válida pero solo era ruido
    return resultado;
}

/**
 * Normalización completa lista para guardar en la BD.
 * Usa normalizarBase() internamente y agrega el sufijo de ciudad.
 *
 * Retorna:
 *   - 'Dirección ..., Ciudad Autonoma de Buenos Aires, Argentina' si válida
 *   - 'NO_GEOCODIFICABLE' si la dirección queda vacía tras la limpieza
 *   - '' si la entrada es nula, vacía o no es string
 *
 * Nota: en el pipeline normal este resultado es REEMPLAZADO por
 * georefNormalizar() + sufijo. Esta función queda como fallback y
 * para compatibilidad con scripts que no usan Georef.
 */
function normalizarDireccion(direccion) {
    const base = normalizarBase(direccion);
    if (base === '') return '';        // entrada inválida
    if (base === null) return 'NO_GEOCODIFICABLE'; // solo ruido
    return base + SUFIJO_UBICACION;
}

module.exports = { normalizarBase, normalizarDireccion };
