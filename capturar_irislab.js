const { chromium } = require('playwright');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => readline.question(query, resolve));

// Formateador de RUT (mismo que usamos en nuestro servidor)
function formatRut(rut) {
    let cleanRut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (cleanRut.length < 2) return rut;
    const dv = cleanRut.slice(-1);
    const cuerpo = cleanRut.slice(0, -1);
    let res = "";
    for (let i = cuerpo.length - 1, j = 0; i >= 0; i--, j++) {
        if (j > 0 && j % 3 === 0) res = "." + res;
        res = cuerpo[i] + res;
    }
    return `${res}-${dv}`;
}

async function main() {
    console.log("\n========================================================");
    console.log("  📸 ROBOT CAPTURADOR DE PANTALLAS - IRISLAB QUILPUÉ");
    console.log("========================================================\n");
    console.log("Este script abrirá un navegador invisible, entrará al sitio");
    console.log("real del hospital y tomará fotos de cada paso por ti.\n");

    const rutRaw = await question("RUT del paciente (ej: 19.185.163-3): ");
    const fecha_nac = await question("Fecha de nacimiento (ej: 22-08-1995): ");
    const fecha_atencion = await question("Fecha de atención con exámenes pendientes (ej: 21-01-2026): ");

    const rut = formatRut(rutRaw);
    readline.close();

    console.log(`\nIniciando robot para el paciente ${rut}... Por favor, espera.`);

    // Iniciar navegador (headless: false si quieres ver cómo se mueve el mouse solo)
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
        // PASO 1: LOGIN
        console.log("-> Entrando a la página principal...");
        await page.goto('http://163.247.80.155:90/resultados/pacientes.aspx', { waitUntil: 'networkidle' });
        await page.screenshot({ path: '1_login_irislab.png', fullPage: true });
        console.log("   [✓] Captura guardada: 1_login_irislab.png");

        // PASO 2: LLENAR DATOS Y ENVIAR
        console.log("-> Llenando formulario con tus datos...");
        await page.fill('input[name="ctl00$Principal$txRut"]', rut);
        await page.fill('input[name="ctl00$Principal$TextBox2"]', fecha_nac);
        await page.fill('input[name="ctl00$Principal$TextBox1"]', fecha_atencion);
        await page.screenshot({ path: '2_formulario_lleno.png', fullPage: true });
        console.log("   [✓] Captura guardada: 2_formulario_lleno.png");

        // PASO 3: LISTA DE ATENCIONES
        console.log("-> Enviando datos y buscando atenciones...");
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle' }),
            page.click('input[name="ctl00$Principal$ButtonPacientes"]')
        ]);
        await page.screenshot({ path: '3_lista_atenciones.png', fullPage: true });
        console.log("   [✓] Captura guardada: 3_lista_atenciones.png");

        // PASO 4: ENTRAR A LA PRIMERA ATENCIÓN (PARA VER EXÁMENES)
        console.log("-> Entrando al detalle de la primera atención...");
        // Buscamos el primer link que nos lleve al detalle de la atención (el botón azul que suele decir "Ver")
        const linksAtencion = await page.$$('a[href*="Principal_Pacientes.aspx"]');

        if (linksAtencion.length > 0) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle' }),
                linksAtencion[0].click()
            ]);

            // Esperamos un segundo extra para asegurarnos de que la tabla cargó bien
            await page.waitForTimeout(2000);

            await page.screenshot({ path: '4_lista_examenes.png', fullPage: true });
            console.log("   [✓] Captura final guardada: 4_lista_examenes.png");

            console.log("\n¡ÉXITO! 🎉");
            console.log("Revisa la imagen '4_lista_examenes.png' en tu carpeta del proyecto.");
            console.log("Fíjate cómo se ve la fila de los exámenes que 'Aún no están listos'.");
            console.log("Cuéntame qué dice exactamente esa fila para que yo actualice nuestro sistema oscuro.");

        } else {
            console.log("\n   [X] No se encontraron atenciones para esa fecha/RUT.");
            console.log("   Por favor, intenta con otra fecha o verifica los datos.");
        }

    } catch (error) {
        console.error("\n❌ Ocurrió un error inesperado:", error.message);
        console.log("Asegúrate de estar conectado a la red del hospital o VPN si es necesario.");
    } finally {
        await browser.close();
    }
}

main();