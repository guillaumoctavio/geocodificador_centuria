const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const correcciones = require('../reglas.js');

// Aplica solo la primera regla que produce un cambio (misma lógica que el normalizador)
function aplicarReglas(dir) {
    let resultado = dir;
    for (const regla of correcciones) {
        const modificada = resultado.replace(regla[0], regla[1]);
        if (modificada !== resultado) { resultado = modificada; break; }
    }
    return resultado.trim();
}

describe('Regla: eliminación S/N', () => {
    it('elimina S/N al final',  () => assert.equal(aplicarReglas('CORRIENTES S/N'), 'CORRIENTES'));
    it('elimina SN al final',   () => assert.equal(aplicarReglas('CORRIENTES SN'),  'CORRIENTES'));
});

describe('Regla: ruido de viviendas', () => {
    it('elimina DPTO con número', () => assert.equal(aplicarReglas('CORRIENTES 2500 DPTO 4'), 'CORRIENTES 2500'));
    it('elimina TORRE con nombre',() => assert.equal(aplicarReglas('CORRIENTES 2500 TR MEDRANO'), 'CORRIENTES 2500'));
    it('elimina PISO',            () => assert.equal(aplicarReglas('CORRIENTES 2500 PISO 3'), 'CORRIENTES 2500'));
});

describe('Regla: múltiples números', () => {
    it('se queda con el último número grande', () =>
        assert.equal(aplicarReglas('RIVADAVIA 13 1303 3645'), 'RIVADAVIA 3645'));
});

describe('Regla: correcciones ortográficas', () => {
    it('restaura MUÑIZ', () => assert.equal(aplicarReglas('MUIZ 100'),  'MUÑIZ 100'));
    it('restaura NUÑEZ', () => assert.equal(aplicarReglas('NUEZ 200'),  'NUÑEZ 200'));
});

describe('Regla: estandarización de calles', () => {
    it('expande B MITRE',       () => assert.equal(aplicarReglas('B MITRE 890'),       'BARTOLOME MITRE 890'));
    it('expande SANCHEZ LORIA', () => assert.equal(aplicarReglas('SANCHEZ LORIA 456'), 'SANCHEZ DE LORIA 456'));
    it('expande 33 ORIENTALES', () => assert.equal(aplicarReglas('33 ORIENTALES 100'), 'TREINTA Y TRES ORIENTALES 100'));
    it('expande Q BOCAYUVA',    () => assert.equal(aplicarReglas('Q BOCAYUVA 300'),    'QUINTINO BOCAYUVA 300'));
});

describe('Regla: prefijos de avenidas', () => {
    it('expande AV.',  () => assert.equal(aplicarReglas('AV. CORRIENTES 2500'), 'AVENIDA CORRIENTES 2500'));
    it('expande AV ',  () => assert.equal(aplicarReglas('AV CORRIENTES 2500'),  'AVENIDA CORRIENTES 2500'));
    it('expande AVDA', () => assert.equal(aplicarReglas('AVDA CORRIENTES 2500'),'AVENIDA CORRIENTES 2500'));
});
