require('dotenv').config();

// =========================================================
// ⚙️ CONFIGURACIÓN CENTRALIZADA
// Cambiar TABLA_DB aquí o definir la variable de entorno TABLA_DB en .env
// =========================================================
const TABLA_DB = process.env.TABLA_DB || 'geodata.geocoding_comuna_5_25';

// Validar variables obligatorias al arrancar cualquier script
const requiredBase = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT'];
const missingBase = requiredBase.filter(k => !process.env[k]);
if (missingBase.length) {
    console.error(`❌ Faltan variables de entorno en .env: ${missingBase.join(', ')}`);
    process.exit(1);
}

module.exports = {
    TABLA_DB,
    SUFIJO_UBICACION: ', Ciudad Autonoma de Buenos Aires, Argentina',
    TAMANO_LOTE: 1000,
    LIMITE_REGISTROS: 20000,
    db: {
        user:     process.env.DB_USER,
        host:     process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port:     process.env.DB_PORT,
    },
};
