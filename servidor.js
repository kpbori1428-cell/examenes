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

async function handleConsulta(params, res) {
    const rut = params.rut || (Array.isArray(params.rut) ? params.rut[0] : '');
    const fecha_nacimiento = params.fecha_nacimiento || (Array.isArray(params.fecha_nacimiento) ? params.fecha_nacimiento[0] : '');
    const fecha_atencion = params.fecha_atencion || (Array.isArray(params.fecha_atencion) ? params.fecha_atencion[0] : '');

    if (!rut || !fecha_nacimiento || !fecha_atencion) {
        return sendError(res, "Faltan parámetros requeridos");
    }

    try {
        const cliente = new ConsultaResultados();
        const resultado = await cliente.consultar(rut, fecha_nacimiento, fecha_atencion);

        res.status(200).json(resultado);
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