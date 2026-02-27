const correcciones = [
    [/^av /g, 'avenida '],
    [/ av /g, ' avenida '],
    [/^pje /g, 'pasaje '],
    [/ pje /g, ' pasaje '],
    [/^tte /g, 'teniente '],
    [/^gral /g, 'general '],
    [/^cnel /g, 'coronel '],
    [/^almte /g, 'almirante '],
    [/^alte /g, 'almirante '],
    [/avda san martin/g, 'avenida san martin'],
    [/av san martin/g, 'avenida san martin'],
    [/av juan d peron/g, 'avenida juan domingo peron'],
    [/av peron/g, 'avenida juan domingo peron'],
    [/alte brown/g, 'almirante brown'],
    [/almte brown/g, 'almirante brown']
];
module.exports = correcciones;