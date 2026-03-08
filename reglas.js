const correcciones = [
    // 1. ELIMINACIÓN DE "S/N" Y DATOS SIN ALTURA
    [/\s+S\/?N.*$/g, ''],
    [/\bS\/?N\b/g, ''],

    // 2. DESTRUCCIÓN MASIVA DE "RUIDO" DE VIVIENDAS (Edificios, Torres, Deptos, Porterías)
    // Elimina la palabra clave y el número/letra asociado (ej: "TR 2", "PORT", "HAB 19", "DPTO 168")
    [/\b(?:TR|T|TORRE|CPO|CUERPO|ED|EDIF|HAB|HB|PORT|PORTERIA|PLAN|MOD|DUP|DPX|CTFT|FRENTE|UF|UFUN|U|UN|LOC|TIM|TIMBRE|TMB|TB|PH|EP|DEPT|DTO|DT|DPTO|DPT|PISO|P|MZ|PC|CE|PLANTA ALTA|PL ALTA)\s*(?:[0-9]+[A-Z]*|[A-Z]+)?\b/g, ''],
    
    // Elimina torres con nombres pegados (ej: "TR MEDRANO")
    [/\bTR\s+[A-Z]+\b/g, ''],
    
    // Elimina indicadores de departamento alfanuméricos sueltos (ej: "1F", "3A", "4D")
    [/\b\d+[A-Z]\b/g, ''],
    
    // Elimina letras sueltas al final (ej: "RIVADAVIA 4566 D" -> "RIVADAVIA 4566")
    [/\b[A-Z]\b$/g, ''],

    // 3. LIMPIEZA DE MÚLTIPLES NÚMEROS (La magia de CABA)
    // Convierte cosas como "RIVADAVIA 13 1303 3645" en "RIVADAVIA 3645" (Se queda con el último número grande)
    [/\b(?:\d{1,4}\s+)+(\d{2,5})\b$/g, '$1'],
    // Convierte "QUITO 4317 5" (calle, altura, piso suelto) en "QUITO 4317"
    [/\b(\d{2,5})\s+\d{1,2}\b$/g, '$1'],

    // 4. CORRECCIONES ORTOGRÁFICAS Y CARACTERES ROTOS (Recuperando la "Ñ")
    [/\bMUIZ\b/g, 'MUÑIZ'],
    [/\bACUA DE FIGUEROA\b/g, 'ACUÑA DE FIGUEROA'],
    [/\bNUEZ\b/g, 'NUÑEZ'],
    [/\bRSREY LINIERS\b/g, 'VIRREY LINIERS'],
    [/\bCOPRRIENTES\b/g, 'CORRIENTES'],
    [/\bQUINAYUBA\b/g, 'QUINTINO BOCAYUVA'],
    [/\bH YRIGOYEN\b/g, 'HIPOLITO YRIGOYEN'],
    [/\bTTE GRAL PERON\b/g, 'TENIENTE GENERAL JUAN DOMINGO PERON'],

    // 5. ESTANDARIZACIÓN DE NOMBRES DE CALLES (Específico Almagro / Boedo)
    [/\b(?:T Y T|T|33)\s+ORIENTALES\b/g, 'TREINTA Y TRES ORIENTALES'],
    [/\b(?:S DE LORIA|SANCHEZ LORIA)\b/g, 'SANCHEZ DE LORIA'],
    [/\b(?:S DE BUSTAMANTE|SANCHEZ BUSTAMANTE|S BUSTAMANTE)\b/g, 'SANCHEZ DE BUSTAMANTE'],
    [/\b(?:TTE GRAL J D PERON|TTE GRAL PERON|PERON)\b/g, 'TENIENTE GENERAL JUAN DOMINGO PERON'],
    [/\b(?:B MITRE|BME MITRE)\b/g, 'BARTOLOME MITRE'],
    [/\b(?:REP BOLIV DE VENEZUELA|REPUBLICA BOLIVARIANA DE VENEZUELA)\b/g, 'VENEZUELA'],
    [/\bQ\s+BOCAYUVA\b/g, 'QUINTINO BOCAYUVA'],
    [/\bJ\s+SALGUERO\b/g, 'JERONIMO SALGUERO'],
    [/\bJ\s+MARMOL\b/g, 'JOSE MARMOL'],
    [/\bJ\s+DE\s+GARAY\b/g, 'JUAN DE GARAY'],
    [/\bE\s+UNIDOS\b/g, 'ESTADOS UNIDOS'],
    [/\b(?:EST DE ISRAEL|E DE ISRAEL)\b/g, 'ESTADO DE ISRAEL'],
    [/\bAVALLE\b/g, 'LAVALLE'],
    [/\bA\s+TROILO\b/g, 'ANIBAL TROILO'],
    [/\bPASEO CULT S IGNACIO\b|\bPASEO C S IGNACIO\b/g, 'PASEO CULTURAL SAN IGNACIO'],
    [/\bR\s+SAENZ\s+PEA\b/g, 'ROQUE SAENZ PEÑA'],
    [/\bF\s+DEVOTO\b/g, 'FERNANDEZ DEVOTO'],
    [/\bF\s+ACUA\s+DE\s+FIGUEROA\b/g, 'FRANCISCO ACUÑA DE FIGUEROA'],
    [/\bC\s+SPEGAZZINI\b/g, 'CARLOS SPEGAZZINI'],
    [/\bAV\s+D\s+VELEZ\b/g, 'AVENIDA DIAZ VELEZ'],

    // 6. NORMALIZACIÓN DE PREFIJOS DE AVENIDAS
    [/\bAV\.\s*/g, 'AVENIDA '],
    [/\bAV\s/g, 'AVENIDA '],
    [/\bAVDA\s/g, 'AVENIDA '],

    // 7. TOQUE FINAL: ELIMINAR ESPACIOS DOBLES GENERADOS POR LA LIMPIEZA
    [/\s{2,}/g, ' '],
    [/^\s+|\s+$/g, ''] // Trim final
];

module.exports = correcciones;