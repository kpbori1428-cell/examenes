const text = `
Parámetros hematológicos : V.N. de Ref. Fórmula Leucocitaria
LEUCOCITOS (x mm3) : 6870 4500 - 10000 EOSINOFILOS (%) : 2 1 - 3
ERITROCITOS (mill/mm3) : 4,59 4,5 - 5,9 BASOFILOS (%) : 1 0 - 1
HEMOGLOBINA (g/dL) : 13,6 * 14 - 17 PROMIELOCITOS (%) : 0 .
HEMATOCRITO (%) : 43,0 36 - 52 MIELOCITOS (%) : 0 0 - 0
V.C.M (fL) : 93,6 82 - 95 JUVENILES (%) : 0 0 - 0
H.C.M (pg) : 29,7 27 - 31 BACILIFORMES (%) : 0 0 - 2
C.H.C.M (%) : 31,6 * 32 - 36 SEGMENTADOS (%) : 60 40 - 75
PLAQUETAS (x mm3) : 387000 140000 - 440000 LINFOCITOS (%) : 30 20 - 45
MPV (fL) : 8,0 6,5 - 12 MONOCITOS (%) : 7 2 - 10
BLASTOS (%) : 0 .
V.H.S (mm/hr) : 22 Hasta 20 TOTAL (%) : 100

RETICULOCITOS (%) : 3,54 * 0,3 - 3
RETICUL. ABSOLUTOS (x mm3) : 0,1625 0,02 - 0,2

RDW-CV (%) : 20,6 * 11 - 15

Fecha de Validación : 05/12/2025 00:00
Hora Recepción : 05/12/2025 10:15
Folio : 123456
Médico : JUAN PEREZ
Edad : 30 años
Sexo : M
`;

const resultados = {};
const tokens = text.split(/\s{2,}|\n/);
const ignorar = ['fecha', 'hora', 'validación', 'recepción', 'folio', 'edad', 'sexo', 'nombre', 'médico', 'procedencia', 'rut'];

for (let token of tokens) {
    token = token.trim();

    if (token.includes(':')) {
        const partes = token.split(':');
        if (partes.length >= 2) {
            let parametro = partes[0].trim();
            // Remover asteriscos o viñetas del inicio del parametro
            parametro = parametro.replace(/^[\*\-•]\s*/, '');

            const resto = partes.slice(1).join(':').trim();

            // Extraer el primer numero real (con comas decimales ej 13,6)
            const matchValor = resto.match(/^([\d,.]+)/);

            // Es basura si contiene la palabra "fecha" o literalmente tiene una fecha como 05/12/2025
            const esBasura = ignorar.some(p => parametro.toLowerCase().includes(p)) || !!parametro.match(/\d{2}\/\d{2}\/\d{4}/);

            if (matchValor && parametro.length > 2 && parametro.length < 50 && !esBasura) {
                // Limpiar exceso de espacios internos del parámetro (ej: "LEUCOCITOS  (x mm3)" -> "LEUCOCITOS (x mm3)")
                const nombreLimpio = parametro.replace(/\s+/g, ' ');
                resultados[nombreLimpio] = matchValor[1];
            }
        }
    }
}

console.log("\n================ EXTRACCIÓN REAL =================\n");
Object.entries(resultados).forEach(([clave, valor]) => {
    console.log(`${clave.padEnd(30)} => ${valor}`);
});
console.log("\n==================================================\n");
