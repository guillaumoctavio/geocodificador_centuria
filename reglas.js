const correcciones = [
    // 1. DESTRUCCIÓN DE DATOS INVÁLIDOS
    [/^sin\s*(?:informar|nombre|domicilio|dom\b).*$/g, ''],
    [/^s\/?c\b.*$/g, ''],
    [/^calle\s*(?:publica|sin\s*nombre).*$/g, ''],
    [/^seccion\s*chacras.*$/g, ''],
    [/^chacras?\s*seccion.*$/g, ''],

    // 2. LIMPIEZA DE RUIDO Y "S/N" (Aquí conservamos las intersecciones "Y")
    [/\s+e\/\s*\d+.*$/g, ''], // Corta los "entre calle X y Y" (ej: E/41 Y 42)
    [/\b(?:dpto\/?casa\w*|casa|caba[nñ]a[s]?|dpto|piso|sec|mz|pc)\s*[a-z0-9]*\b/g, ''],
    [/\s+s\/?n.*$/g, ''], // Elimina S/N al final
    [/\bs\/?n\b/g, ''],   // Elimina S/N sueltos
    [/\s+entre\s+calle.*$/g, ''], // Corta los "entre calle..." escritos largos
    [/\s+intersecci[oó]n\s+/g, ' y '], // Cambia "intersección" por "y"
    [/\b\s+n\s+(\d+)\b/g, ' $1'], // Ej: "17 N 1544" -> "17 1544" (Quita la N de número)

    // 3. LIMPIEZA DE ERRORES DE EXPORTACIÓN (Números pegados a los nombres)
    [/\b2juan\b/g, 'juan'],
    [/\b6alem\b/g, 'alem'],
    [/\b2bisartigas\b/g, 'artigas'],
    [/\b14guemes\b/g, 'guemes'],
    [/\b16rodriguez\b/g, 'rodriguez'],
    [/\b19las\b/g, 'las'],
    [/\b18bahia\b/g, 'bahia'],
    [/\b50bisromano\b/g, 'romano'],
    [/\b2bis\b/g, '2 bis '],
    [/\b57bis\b/g, '57 bis '],

    // 4. CORRECCIONES ORTOGRÁFICAS LOCALES
    [/\bespaa\b/g, 'españa'],
    [/\bsaenz\s*pea\b/g, 'saenz peña'],
    [/\bstegman\b/g, 'stegmann'],
    [/\bfrondizzi\b/g, 'frondizi'],

    // 5. INVERSIÓN DE TÍTULOS Y NOMBRES
    [/\bdorrego\s*cnel\.?\b/g, 'coronel dorrego'],
    [/\brocha\s*dardo\b/g, 'dardo rocha'],
    [/\bmitre\s*bartolome\b/g, 'bartolome mitre'],
    [/\bsuarez\s*cnel\.?\b/g, 'coronel suarez'],
    [/\bmilani\s*palmiro\b/g, 'palmiro milani'],
    [/\bfrondiz[z]?i\s*pdte\.?\b/g, 'presidente frondizi'],
    [/\bamirin\s*pedro\s*presb\.?\b/g, 'presbitero pedro amirin'],
    [/\bbolivar\s*simon\b/g, 'simon bolivar'],
    [/\bcampos\s*julio\s*cnel\.?\b/g, 'coronel julio campos'],
    [/\bromano\s*aroldo\s*consc\.?\b/g, 'conscripto aroldo romano'],
    [/\brodriguez\s*martin\s*gral\.?\b/g, 'general martin rodriguez'],
    [/\bnewton\s*pastor\b/g, 'pastor newton'],
    [/\bspika\s*enrique\s*cnel\.?\b/g, 'coronel enrique spika'],
    [/\bgarcia\s*de\s*la\s*calle\s*jose\s*p\b/g, 'jose p garcia de la calle'],
    [/\bj\.?garcia\s*de\s*la\s*calle\b/g, 'jose p garcia de la calle'],
    [/\bguemes\s*martin\s*miguel\s*de\b/g, 'martin miguel de guemes'],

    // 6. ADAPTACIÓN DE CALLES NUMÉRICAS E INTERSECCIONES
    // Agrega "calle" para que Google no crea que son códigos postales o errores
    [/^(\d{1,3})\s+(\d{1,5})$/g, 'calle $1 $2'], // ej: "17 154" -> "calle 17 154"
    [/^(\d{1,3})\s+y\s+(\d{1,3})/g, 'calle $1 y calle $2'], // ej: "25 y 54" -> "calle 25 y calle 54"
    [/\by\s+(\d{1,3})\b/g, 'y calle $1'], // ej: "moreno y 21" -> "moreno y calle 21"
    [/^(\d{1,3})\s*bis\s+(\d{1,5})$/g, 'calle $1 bis $2'], // ej: "63 bis 73" -> "calle 63 bis 73"

    // 7. CORRECCIONES GENERALES (Prefijos)
    [/^av\.\s*acceso\s*/g, 'acceso '],
    [/^av\.\s*/g, 'avenida '],
    [/^av\s/g, 'avenida '],
    [/^avda\s/g, 'avenida '],
    [/^bv\s/g, 'boulevard '],
    [/^pje\.\s*/g, 'pasaje '],
    [/^pje\s/g, 'pasaje '],
    [/^psje\s/g, 'pasaje '],
    [/^tte\s/g, 'teniente '],
    [/^gral\.?\s/g, 'general '],
    [/^cnel\.?\s/g, 'coronel ']
];

module.exports = correcciones;