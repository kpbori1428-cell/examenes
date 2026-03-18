const express = require('express');
const cors = require('cors');
const path = require('path');
const { ConsultaResultados } = require('./consultaResultados');

const app = express();
const PORT = 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Intercept JSON parsing errors from express.json()
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: "Invalid JSON format received" });
    }
    next();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/consultar', async (req, res) => {
    try {
        await handleConsulta(req.query, res);
    } catch (e) {
        sendError(res, "Error interno del servidor: " + e.message);
    }
});

app.post('/api/consultar', async (req, res) => {
    try {
        await handleConsulta(req.body, res);
    } catch (e) {
        sendError(res, "Error interno del servidor: " + e.message);
    }
});

app.post('/api/comparar', async (req, res) => {
    const { examenes } = req.body; // [{ url_ver: string, fecha: string }]

    if (!examenes || !Array.isArray(examenes) || examenes.length < 2) {
        return res.status(400).json({ error: "Debe proveer al menos dos exámenes para comparar" });
    }

    try {
        const cliente = new ConsultaResultados();

        // Procesar en paralelo todos los examenes seleccionados
        const comparacionPromises = examenes.map(async (examen) => {
            if (!examen.url_ver.startsWith('http://163.247.80.155:90/resultados/Pacientes/')) {
                return { fecha: examen.fecha, error: "URL Inválida", datos: null };
            }

            // 1. Resolver el PDF final perezosamente
            const url_final = await cliente.resolver_url_pdf_unica(examen.url_ver);
            if (!url_final) {
                 return { fecha: examen.fecha, error: "No se pudo obtener el PDF", datos: null };
            }

            // 2. Extraer los datos numéricos del PDF resuelto
            const datos = await cliente.extraer_datos_pdf(url_final);
            return {
                fecha: examen.fecha,
                url_pdf: url_final,
                datos: datos
            };
        });

        const resultadosCompletos = await Promise.all(comparacionPromises);
        res.status(200).json(resultadosCompletos);

    } catch (e) {
        res.status(500).json({ error: "Error extrayendo datos de comparación: " + e.message });
    }
});

app.get('/api/pdf', async (req, res) => {
    const url_ver = req.query.url_ver;
    if (!url_ver) {
        return res.status(400).send("Falta parámetro url_ver");
    }

    // Prevent SSRF attacks: Ensure the requested URL actually points to the target hospital system
    if (!url_ver.startsWith('http://163.247.80.155:90/resultados/Pacientes/')) {
        return res.status(403).send("URL de examen denegada por seguridad.");
    }

    try {
        const cliente = new ConsultaResultados();
        const url_final = await cliente.resolver_url_pdf_unica(url_ver);
        if (url_final) {
            return res.redirect(url_final);
        } else {
            return res.status(404).send("No se pudo resolver el PDF");
        }
    } catch (e) {
        return res.status(500).send("Error del servidor: " + e.message);
    }
});

async function handleConsulta(params, res) {
    const rut = params.rut || (Array.isArray(params.rut) ? params.rut[0] : '');
    const fecha_nacimiento = params.fecha_nacimiento || (Array.isArray(params.fecha_nacimiento) ? params.fecha_nacimiento[0] : '');
    const fecha_inicio = params.fecha_inicio || (Array.isArray(params.fecha_inicio) ? params.fecha_inicio[0] : params.fecha_atencion || '');
    const fecha_fin = params.fecha_fin || (Array.isArray(params.fecha_fin) ? params.fecha_fin[0] : params.fecha_atencion || '');

    if (!rut || !fecha_nacimiento || !fecha_inicio || !fecha_fin) {
        return sendError(res, "Faltan parámetros requeridos");
    }

    // Generar arreglo de fechas (DD-MM-YYYY) entre inicio y fin
    const datesToQuery = [];
    const partsStart = fecha_inicio.split('-');
    const partsEnd = fecha_fin.split('-');

    if (partsStart.length !== 3 || partsEnd.length !== 3) {
         return sendError(res, "El formato de las fechas debe ser DD-MM-YYYY");
    }

    let currentDate = new Date(partsStart[2], partsStart[1] - 1, partsStart[0]);
    const endDate = new Date(partsEnd[2], partsEnd[1] - 1, partsEnd[0]);

    if (currentDate > endDate) {
        return sendError(res, "La fecha de inicio no puede ser mayor a la fecha de fin");
    }

    while (currentDate <= endDate) {
        const day = String(currentDate.getDate()).padStart(2, '0');
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const year = currentDate.getFullYear();
        datesToQuery.push(`${day}-${month}-${year}`);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    try {
        const resultadosAgrupados = {
            rut: rut,
            nombre: "",
            apellidos: "",
            sexo: "",
            fecha_nacimiento: "",
            atenciones: [],
            examenes: [],
            errores: []
        };

        // Procesar en chunks de 3 para no saturar/bloquear la IP del hospital
        const CHUNK_SIZE = 3;
        for (let i = 0; i < datesToQuery.length; i += CHUNK_SIZE) {
            const chunk = datesToQuery.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (fecha) => {
                const cliente = new ConsultaResultados();
                return await cliente.consultar(rut, fecha_nacimiento, fecha);
            });

            const results = await Promise.all(promises);

            for (const res of results) {
                // Setear datos del paciente si los encontramos y no los teníamos
                if (!resultadosAgrupados.nombre && res.nombre) {
                    resultadosAgrupados.nombre = res.nombre;
                    resultadosAgrupados.apellidos = res.apellidos;
                    resultadosAgrupados.sexo = res.sexo;
                    resultadosAgrupados.fecha_nacimiento = res.fecha_nacimiento;
                }

                // Agregar atenciones sin duplicados (por número)
                for (const atencion of res.atenciones) {
                    if (!resultadosAgrupados.atenciones.some(a => a.numero === atencion.numero)) {
                        resultadosAgrupados.atenciones.push(atencion);
                    }
                }

                // Agregar examenes sin duplicados (por url_ver) y marcarlos con su fecha
                for (const examen of res.examenes) {
                    if (!resultadosAgrupados.examenes.some(e => e.url_ver === examen.url_ver)) {
                        examen.fecha = res.fecha_atencion; // Registrar la fecha de la consulta que encontró este examen
                        resultadosAgrupados.examenes.push(examen);
                    }
                }

                // Agregar errores específicos si hubo problemas de conexión u otros, pero
                // ignorar el típico "No se encontraron atenciones" si se consultan múltiples días vacíos.
                for (const err of res.errores) {
                    if (!err.includes("No se encontraron atenciones")) {
                        const errMsg = `[Fecha ${res.fecha_atencion || 'Desconocida'}]: ${err}`;
                        if (!resultadosAgrupados.errores.includes(errMsg)) {
                            resultadosAgrupados.errores.push(errMsg);
                        }
                    }
                }
            }
        }

        // Si al final todas las fechas devolvieron vacío, ponemos el mensaje genérico
        if (resultadosAgrupados.atenciones.length === 0 && resultadosAgrupados.errores.length === 0) {
             resultadosAgrupados.errores.push("No se encontraron atenciones para el rango de fechas proporcionado");
        }

        res.status(200).json(resultadosAgrupados);
    } catch (e) {
        return sendError(res, e.message);
    }
}

// Fallback for everything else
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something went wrong! " + err.message });
});

function sendError(res, message) {
    res.status(400).json({ error: message });
}

function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║      SERVIDOR DE CONSULTA DE RESULTADOS DE EXÁMENES      ║
║           Hospital de Quilpué - Sistema IrisLab          ║
╚══════════════════════════════════════════════════════════╝

Servidor iniciado en: http://localhost:${PORT}

Abre el navegador en la dirección anterior para usar la interfaz.
Presiona Ctrl+C para detener el servidor.
    `);

    app.listen(PORT, () => {
        // server running
    });
}

if (require.main === module) {
    main();
}

module.exports = app;