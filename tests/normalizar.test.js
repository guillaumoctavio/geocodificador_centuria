// Silenciar la validación de .env durante los tests
process.env.DB_USER     = process.env.DB_USER     || 'test';
process.env.DB_HOST     = process.env.DB_HOST     || 'test';
process.env.DB_NAME     = process.env.DB_NAME     || 'test';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test';
process.env.DB_PORT     = process.env.DB_PORT     || '5432';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizarDireccion } = require('../normalizar.js');

const SUF = ', Ciudad Autonoma de Buenos Aires, Argentina';

describe('normalizarDireccion — caso base', () => {
    it('mayúsculas → Title Case con sufijo', () =>
        assert.equal(normalizarDireccion('RIVADAVIA 1234'), `Rivadavia 1234${SUF}`));
    it('minúsculas → Title Case con sufijo', () =>
        assert.equal(normalizarDireccion('rivadavia 1234'), `Rivadavia 1234${SUF}`));
});

describe('normalizarDireccion — eliminación de ruido', () => {
    it('elimina DPTO', () =>
        assert.equal(normalizarDireccion('CORRIENTES 2500 DPTO 4A'), `Corrientes 2500${SUF}`));
    it('elimina PISO', () =>
        assert.equal(normalizarDireccion('CORRIENTES 2500 PISO 3'),  `Corrientes 2500${SUF}`));
    it('elimina S/N',  () =>
        assert.equal(normalizarDireccion('CORRIENTES S/N'), `Corrientes${SUF}`));
});

describe('normalizarDireccion — múltiples números', () => {
    it('se queda con el último número grande', () =>
        assert.equal(normalizarDireccion('CORRIENTES 13 1303 2500'), `Corrientes 2500${SUF}`));
});

describe('normalizarDireccion — expansiones', () => {
    it('expande AV', () =>
        assert.equal(normalizarDireccion('AV CORRIENTES 2500'), `Avenida Corrientes 2500${SUF}`));
    it('expande B MITRE', () =>
        assert.equal(normalizarDireccion('B MITRE 890'), `Bartolome Mitre 890${SUF}`));
    it('expande SANCHEZ LORIA', () =>
        assert.equal(normalizarDireccion('SANCHEZ LORIA 456'), `Sanchez De Loria 456${SUF}`));
});

describe('normalizarDireccion — correcciones ortográficas', () => {
    it('restaura MUÑIZ', () =>
        assert.equal(normalizarDireccion('MUIZ 321'), `Muñiz 321${SUF}`));
});

describe('normalizarDireccion — entradas inválidas', () => {
    it('cadena vacía → ""',    () => assert.equal(normalizarDireccion(''),   ''));
    it('null → ""',            () => assert.equal(normalizarDireccion(null), ''));
    it('número → ""',          () => assert.equal(normalizarDireccion(123),  ''));
    it('solo ruido → NO_GEOCODIFICABLE', () =>
        assert.equal(normalizarDireccion('TORRE 2 DPTO 5B'), 'NO_GEOCODIFICABLE'));
});
