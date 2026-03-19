const { chromium } = require('playwright');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => readline.question(query, resolve));

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
    const rut = formatRut('19.185.163-3');
    const fecha_nac = '22-08-1995';
    // Use the exact date the user provided that has "pending" exams
    const fecha_atencion = '03-12-2025';

    readline.close();

    console.log(`\nIniciando robot para el paciente ${rut}...`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    try {
        console.log("-> Entrando a la página principal...");
        await page.goto('http://163.247.80.155:90/resultados/pacientes.aspx', { waitUntil: 'networkidle' });

        console.log("-> Llenando formulario con tus datos...");
        await page.fill('input[name="ctl00$Principal$txRut"]', rut);
        await page.fill('input[name="ctl00$Principal$TextBox2"]', fecha_nac);
        await page.fill('input[name="ctl00$Principal$TextBox1"]', fecha_atencion);

        console.log("-> Enviando datos y buscando atenciones...");
        await page.click('input[name="ctl00$Principal$ButtonPacientes"]');
        await page.waitForTimeout(3000); // Give it time to load

        console.log("-> Entrando al detalle de la primera atención...");
        const linksAtencion = await page.$$('a[href*="Principal_Pacientes.aspx"]');

        if (linksAtencion.length > 0) {
            await linksAtencion[0].click();
            await page.waitForTimeout(3000);

            // Get the HTML content of the exams table to analyze it!
            const tableHTML = await page.innerHTML('tbody#ContentPlaceHolder1_tBodyTablaExa');
            const fs = require('fs');
            fs.writeFileSync('exams_table_html.txt', tableHTML);

            await page.screenshot({ path: '4_lista_examenes.png', fullPage: true });
            console.log("\n¡ÉXITO! HTML guardado en exams_table_html.txt");

        } else {
            console.log("\n   [X] No se encontraron atenciones para esa fecha/RUT.");
        }

    } catch (error) {
        console.error("\n❌ Ocurrió un error inesperado:", error.message);
    } finally {
        await browser.close();
    }
}

main();