const axios = require('axios');
const cheerio = require('cheerio');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const { URL } = require('url');

class ConsultaResultados {
    constructor() {
        this.BASE_URL = "http://163.247.80.155:90/resultados";
        this.HEADERS = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Cache-Control': 'max-age=0',
            'Connection': 'keep-alive',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            'Upgrade-Insecure-Requests': '1',
        };

        const jar = new CookieJar();
        const client = axios.create({
            headers: this.HEADERS,
            jar,
            withCredentials: true,
            maxRedirects: 10,
            validateStatus: function (status) {
                return status >= 200 && status < 400; // default
            }
        });
        this.session = wrapper(client);
    }

    _obtener_viewstate(html) {
        const $ = cheerio.load(html);
        const campos = {};
        const names = ['__VIEWSTATE', '__VIEWSTATEGENERATOR', '__EVENTVALIDATION', '__EVENTTARGET', '__EVENTARGUMENT'];

        names.forEach(name => {
            const campo = $(`input[name="${name}"]`);
            if (campo.length > 0) {
                campos[name] = campo.attr('value') || '';
            }
        });

        return campos;
    }

    _format_rut(rut) {
        // Strip everything except numbers and K
        let cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
        if (cleanRut.length < 2) return rut; // Too short to format

        const dv = cleanRut.slice(-1);
        const cuerpo = cleanRut.slice(0, -1);

        let res = "";
        for (let i = cuerpo.length - 1, j = 0; i >= 0; i--, j++) {
            if (j > 0 && j % 3 === 0) {
                res = "." + res;
            }
            res = cuerpo[i] + res;
        }

        return `${res}-${dv}`;
    }

    async consultar(rut, fecha_nacimiento, fecha_atencion) {
        const rutFormateado = this._format_rut(rut);

        const resultado = {
            rut: rut,
            nombre: "",
            apellidos: "",
            sexo: "",
            fecha_nacimiento: "",
            fecha_atencion: fecha_atencion, // Added tracking back the date queried
            atenciones: [],
            examenes: [],
            errores: []
        };

        try {
            // Paso 1: Obtener página de login para conseguir VIEWSTATE
            console.log("[1/4] Obteniendo página de login...");
            const resp_login = await this.session.get(`${this.BASE_URL}/pacientes.aspx`);
            const campos = this._obtener_viewstate(resp_login.data);

            // Paso 2: Enviar credenciales
            console.log(`[2/4] Enviando credenciales con RUT: ${rutFormateado}...`);
            const data = new URLSearchParams({
                ...campos,
                'ctl00$Principal$txRut': rutFormateado,
                'ctl00$Principal$TextBox2': fecha_nacimiento,
                'ctl00$Principal$TextBox1': fecha_atencion,
                'ctl00$Principal$ButtonPacientes': 'Iniciar'
            });

            const resp_atenciones = await this.session.post(
                `${this.BASE_URL}/Pacientes/Atenciones.aspx`,
                data.toString(),
                {
                    headers: { 'Referer': `${this.BASE_URL}/pacientes.aspx` }
                }
            );

            // Parsear datos del paciente y atenciones
            this._parsear_atenciones(resp_atenciones.data, resultado);

            if (resultado.atenciones.length === 0) {
                resultado.errores.push("No se encontraron atenciones para los datos proporcionados");
                return resultado;
            }

            // Paso 3: Obtener detalles de cada atención en paralelo
            console.log(`[3/4] Obteniendo detalles de ${resultado.atenciones.length} atención(es)...`);
            const examenesPromises = resultado.atenciones.map(atencion => this._obtener_examenes(atencion, resultado));
            await Promise.all(examenesPromises);

            // Paso 4: Intentar resolver URLs de PDFs en paralelo
            console.log("[4/4] Resolviendo enlaces de PDFs...");
            const pdfPromises = resultado.examenes.map(examen => this._resolver_pdf(examen));
            await Promise.all(pdfPromises);

            console.log(`✓ Consulta completada en paralelo. Se encontraron ${resultado.examenes.length} examen(es).`);

        } catch (e) {
            if (e.response) {
                resultado.errores.push(`Error de conexión: ${e.message}`);
            } else {
                resultado.errores.push(`Error inesperado: ${e.message}`);
            }
        }

        return resultado;
    }

    _parsear_atenciones(html, resultado) {
        const $ = cheerio.load(html);
        this._extraer_datos_paciente($, resultado);
        this._extraer_atenciones($, resultado);
    }

    _extraer_datos_paciente($, resultado) {
        const tabla_datos = $('tbody#ContentPlaceHolder1_tBodyTabla');
        if (tabla_datos.length === 0) return;

        const campo_mapping = {
            'nombre': (r, v) => r.nombre = v,
            'apellido': (r, v) => r.apellidos = v,
            'sexo': (r, v) => r.sexo = v,
            'nacimiento': (r, v) => r.fecha_nacimiento = v,
        };

        tabla_datos.find('tr').each((_, row) => {
            const tds = $(row).find('td');
            if (tds.length < 2) return;

            const label = $(tds[0]).text().trim().toLowerCase();
            const value = $(tds[1]).text().trim();

            for (const [key, setter] of Object.entries(campo_mapping)) {
                if (label.includes(key) && (key !== 'nombre' || !label.includes('apellido'))) {
                    setter(resultado, value);
                    break;
                }
            }
        });
    }

    _extraer_atenciones($, resultado) {
        const tabla_atenciones = $('tbody#ContentPlaceHolder1_tBodyTablaExa');
        if (tabla_atenciones.length === 0) return;

        tabla_atenciones.find('tr').each((_, row) => {
            const atencion = this._parsear_fila_atencion($, row);
            if (atencion) {
                resultado.atenciones.push(atencion);
            }
        });
    }

    _parsear_fila_atencion($, row) {
        const link = $(row).find('a[href*="Principal_Pacientes.aspx"]');
        if (link.length === 0) return null;

        const tds = $(row).find('td');
        if (tds.length < 2) return null;

        const href = link.attr('href') || '';
        let dato1 = '';
        let dato2 = '';

        try {
            // A veces href es un link relativo, url parse requires absolute
            const parsedUrl = new URL(href, `${this.BASE_URL}/Pacientes/`);
            dato1 = parsedUrl.searchParams.get('dato1') || '';
            dato2 = parsedUrl.searchParams.get('dato2') || '';
        } catch (e) {
            // Fallback for parsing search params
            const queryMatch = href.match(/\?(.*)$/);
            if (queryMatch) {
                const searchParams = new URLSearchParams(queryMatch[1]);
                dato1 = searchParams.get('dato1') || '';
                dato2 = searchParams.get('dato2') || '';
            }
        }

        const absoluteUrl = new URL(href, `${this.BASE_URL}/Pacientes/`).href;

        return {
            numero: $(tds[0]).text().trim(),
            paciente: $(tds[1]).text().trim(),
            dato1: dato1,
            dato2: dato2,
            url: absoluteUrl
        };
    }

    async _obtener_examenes(atencion, resultado) {
        try {
            const resp = await this.session.get(atencion.url);
            const $ = cheerio.load(resp.data);
            const tabla_examenes = $('tbody#ContentPlaceHolder1_tBodyTablaExa');

            if (tabla_examenes.length > 0) {
                tabla_examenes.find('tr').each((_, row) => {
                    const link = $(row).find('a[href*="iris_gen_pdf"]');
                    if (link.length > 0) {
                        const tds = $(row).find('td');
                        if (tds.length >= 2) {
                            const href = link.attr('href') || '';
                            const absoluteUrl = new URL(href, `${this.BASE_URL}/Pacientes/`).href;

                            resultado.examenes.push({
                                codigo: $(tds[0]).text().trim(),
                                descripcion: $(tds[1]).text().trim(),
                                url_ver: absoluteUrl,
                                url_pdf: null
                            });
                        }
                    }
                });
            }

            // También buscar el botón "Ver Exámenes" para todos
            const ver_todos = $('a[href*="iris_gen_pdf.aspx"]');
            if (ver_todos.length > 0) {
                const url_todos = ver_todos.attr('href') || '';
                const absoluteUrlTodos = new URL(url_todos, `${this.BASE_URL}/Pacientes/`).href;

                resultado.examenes.unshift({
                    codigo: "TODOS",
                    descripcion: "Ver todos los exámenes",
                    url_ver: absoluteUrlTodos,
                    url_pdf: null
                });
            }

        } catch (e) {
            resultado.errores.push(`Error obteniendo exámenes de atención ${atencion.numero}: ${e.message}`);
        }
    }

    async _resolver_pdf(examen) {
        try {
            const resp = await this.session.get(examen.url_ver);
            const finalUrl = resp.request.res.responseUrl || examen.url_ver; // Axios exposes final URL here

            if (finalUrl.toLowerCase().includes('.pdf')) {
                examen.url_pdf = finalUrl;
            } else {
                const $ = cheerio.load(resp.data);

                // Buscar en meta refresh
                const meta = $('meta[http-equiv*="refresh" i]');
                if (meta.length > 0) {
                    const content = meta.attr('content') || '';
                    const match = content.match(/url=([^\s"']+)/i);
                    if (match) {
                        examen.url_pdf = new URL(match[1], finalUrl).href;
                    }
                }

                if (!examen.url_pdf) {
                    // Buscar en iframes
                    const iframe = $('iframe[src*=".pdf" i]');
                    if (iframe.length > 0) {
                        examen.url_pdf = new URL(iframe.attr('src') || '', finalUrl).href;
                    }
                }

                if (!examen.url_pdf) {
                    // Buscar en enlaces directos
                    const link = $('a[href*=".pdf" i]');
                    if (link.length > 0) {
                        examen.url_pdf = new URL(link.attr('href') || '', finalUrl).href;
                    }
                }

                if (!examen.url_pdf) {
                    // Buscar en scripts (e.g. document.location.href = "PDF/...")
                    const scriptMatch = resp.data.match(/document\.location\.href\s*=\s*['"]([^'"]+)['"]/i);
                    if (scriptMatch) {
                        examen.url_pdf = new URL(scriptMatch[1], finalUrl).href;
                    }
                }
            }
        } catch (e) {
            // Silenciosamente ignorar errores al resolver PDFs
        }
    }
}

async function main() {
    console.log("=".repeat(60));
    console.log("  CONSULTA DE RESULTADOS DE EXÁMENES");
    console.log("  Hospital de Quilpué - Sistema IrisLab");
    console.log("=".repeat(60));
    console.log();

    let rut, fecha_nac, fecha_atencion;

    if (process.argv.length === 5) {
        rut = process.argv[2];
        fecha_nac = process.argv[3];
        fecha_atencion = process.argv[4];
    } else {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (query) => new Promise(resolve => readline.question(query, resolve));

        rut = (await question("RUT (ej: 19.185.163-3): ")).trim();
        fecha_nac = (await question("Fecha de nacimiento (ej: 22-08-1995): ")).trim();
        fecha_atencion = (await question("Fecha de atención (ej: 21-01-2026): ")).trim();

        readline.close();
    }

    console.log();
    console.log(`Consultando para RUT: ${rut}`);
    console.log(`Fecha nacimiento: ${fecha_nac}`);
    console.log(`Fecha atención: ${fecha_atencion}`);
    console.log("-".repeat(60));

    const cliente = new ConsultaResultados();
    const resultado = await cliente.consultar(rut, fecha_nac, fecha_atencion);

    console.log();
    console.log("=".repeat(60));
    console.log("  RESULTADOS");
    console.log("=".repeat(60));

    if (resultado.errores.length > 0) {
        console.log("\n⚠ ERRORES:");
        for (const error of resultado.errores) {
            console.log(`  - ${error}`);
        }
    }

    if (resultado.nombre) {
        console.log("\n📋 DATOS DEL PACIENTE:");
        console.log(`   Nombre: ${resultado.nombre} ${resultado.apellidos}`);
        console.log(`   RUT: ${resultado.rut}`);
        console.log(`   Sexo: ${resultado.sexo}`);
        console.log(`   Fecha nacimiento: ${resultado.fecha_nacimiento}`);
    }

    if (resultado.atenciones.length > 0) {
        console.log(`\n📅 ATENCIONES (${resultado.atenciones.length}):`);
        resultado.atenciones.forEach((atencion, i) => {
            console.log(`   ${i + 1}. N° ${atencion.numero} - ${atencion.paciente}`);
            console.log(`      URL: ${atencion.url}`);
        });
    }

    if (resultado.examenes.length > 0) {
        console.log(`\n🔬 EXÁMENES DISPONIBLES (${resultado.examenes.length}):`);
        resultado.examenes.forEach((examen, i) => {
            console.log(`   ${i + 1}. [${examen.codigo}] ${examen.descripcion}`);
            console.log(`      Ver: ${examen.url_ver}`);
            if (examen.url_pdf) {
                console.log(`      PDF: ${examen.url_pdf}`);
            }
        });
    }

    console.log();
    console.log("=".repeat(60));

    return resultado;
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ConsultaResultados };
