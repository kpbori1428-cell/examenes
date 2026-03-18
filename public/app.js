import { inyectar_cambios } from './engine.js';

// Diccionario de Lógica del Negocio (Mapeado directo por String en el JSON)
window.actionDictionary = {
    "submit_consulta": async (e, formNode, config) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Guardar el estado actual del formulario para no perder lo tipeado al re-renderizar
        // y establecer el estado de carga declarativamente
        inyectar_cambios({
            formulario: {
                grupo_rut: { input: { value: data.rut } },
                grupo_nacimiento: { input: { value: data.fecha_nacimiento } },
                grupo_fechas: {
                    inicio: { input: { value: data.fecha_inicio } },
                    fin: { input: { value: data.fecha_fin } }
                },
                boton_consultar: {
                    text: 'Cargando (esto puede tardar)...',
                    disabled: true
                }
            }
        });

        const formatInputDate = (dateStr) => {
            if (!dateStr || !dateStr.includes('-')) return dateStr;
            const parts = dateStr.split('-');
            if (parts[0].length === 4) return `${parts[2]}-${parts[1]}-${parts[0]}`;
            return dateStr;
        };

        data.fecha_inicio = formatInputDate(data.fecha_inicio);
        data.fecha_fin = formatInputDate(data.fecha_fin);

        try {
            const response = await fetch('/api/consultar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            // INYECTAMOS EL RESULTADO EN EL MOTOR (Mapeo de Datos a JSON UI)
            generarUIResultados(result);

        } catch (error) {
            inyectar_cambios({
                resultados: {
                    tag: 'div',
                    text: `Error: ${error.message}`,
                    _style: { color: 'red', 'margin-top': '20px' }
                }
            });
        } finally {
            inyectar_cambios({
                formulario: {
                    boton_consultar: {
                        text: 'Consultar',
                        disabled: false
                    }
                }
            });
        }
    }
};

// Generador de Componentes Visuales (Nodos JSON) a partir de los Datos Crudos
function generarUIResultados(data) {
    if (data.error) {
        return inyectar_cambios({ resultados: { tag: 'div', text: data.error, _style: { color: 'red' } } });
    }

    const uiResultados = {
        tag: 'div',
        _style: { 'margin-top': '30px', 'font-family': 'sans-serif' },
        paciente: {
            tag: 'div',
            _style: { 'background': '#f0f0f0', 'padding': '15px', 'border-radius': '8px' },
            titulo: { tag: 'h2', text: 'Datos del Paciente', _style: { margin: '0 0 10px 0' } },
            rut: { tag: 'p', html: `<strong>RUT:</strong> ${data.rut}` },
            nombre: { tag: 'p', html: `<strong>Nombre:</strong> ${data.nombre} ${data.apellidos}` },
            sexo: { tag: 'p', html: `<strong>Sexo:</strong> ${data.sexo}` },
        },
        atenciones: {
            tag: 'div',
            _style: { 'margin-top': '20px' },
            titulo: { tag: 'h2', text: `Atenciones encontradas (${data.atenciones.length})` },
            lista: {
                tag: 'ul',
                children: data.atenciones.map(a => ({
                    tag: 'li',
                    text: `N° ${a.numero} - ${a.paciente}`
                }))
            }
        },
        examenes: {
            tag: 'div',
            _style: { 'margin-top': '20px' },
            titulo: { tag: 'h2', text: `Exámenes (${data.examenes.length})` },
            grid: {
                tag: 'div',
                _style: { display: 'grid', gap: '10px' },
                children: data.examenes.map(e => ({
                    tag: 'div',
                    _style: { padding: '10px', border: '1px solid #ccc', 'border-radius': '5px', display: 'flex', 'justify-content': 'space-between' },
                    texto: { tag: 'span', text: `[${e.codigo}] ${e.descripcion}` },
                    boton: {
                        tag: 'a',
                        text: 'Ver Detalle PDF',
                        href: `/api/pdf?url_ver=${encodeURIComponent(e.url_ver)}`,
                        target: '_blank',
                        _style: { 'background-color': '#0ea5e9', color: '#fff', padding: '5px 10px', 'text-decoration': 'none', 'border-radius': '4px' }
                    }
                }))
            }
        },
        errores: data.errores.length > 0 ? {
            tag: 'div',
            _style: { 'margin-top': '20px', color: 'red' },
            texto: { tag: 'p', text: `Errores: ${data.errores.join(', ')}` }
        } : { tag: 'div' }
    };

    // Actualizamos únicamente la ruta "resultados" de nuestro Estado Principal
    inyectar_cambios({ resultados: uiResultados });
}

// ==========================================
// ESTADO INICIAL DE LA APP (El "ui.json")
// ==========================================
const estadoInicial = {
    tag: 'div',
    _style: { 'max-width': '800px', margin: '0 auto', 'font-family': 'sans-serif' },
    encabezado: {
        tag: 'h1',
        text: 'Consulta de Resultados de Exámenes'
    },
    formulario: {
        tag: 'form',
        id: 'consultaForm',
        submit: 'submit_consulta', // Llama a la acción mapeada
        _style: { display: 'flex', 'flex-direction': 'column', gap: '15px' },
        grupo_rut: {
            tag: 'div',
            label: { tag: 'label', text: 'RUT: ' },
            input: { tag: 'input', type: 'text', name: 'rut', placeholder: 'Ej: 19.185.163-3', required: true }
        },
        grupo_nacimiento: {
            tag: 'div',
            label: { tag: 'label', text: 'Fecha Nacimiento: ' },
            input: { tag: 'input', type: 'text', name: 'fecha_nacimiento', placeholder: 'DD-MM-YYYY', required: true }
        },
        grupo_fechas: {
            tag: 'fieldset',
            _style: { padding: '10px' },
            legend: { tag: 'legend', text: 'Rango de Fechas (Sin límite)' },
            inicio: {
                tag: 'div',
                label: { tag: 'label', text: 'Desde: ' },
                input: { tag: 'input', type: 'date', name: 'fecha_inicio', required: true }
            },
            fin: {
                tag: 'div',
                _style: { 'margin-top': '10px' },
                label: { tag: 'label', text: 'Hasta: ' },
                input: { tag: 'input', type: 'date', name: 'fecha_fin', required: true }
            }
        },
        boton_consultar: {
            tag: 'button',
            type: 'submit',
            text: 'Consultar',
            _style: { padding: '10px', 'background-color': '#f59e0b', color: 'white', border: 'none', cursor: 'pointer', 'font-size': '16px', 'border-radius': '4px' }
        }
    },
    resultados: {
        // Nace vacío, se inyectará dinámicamente aquí
        tag: 'div',
        id: 'resultados_container'
    }
};

// Arrancar App
document.addEventListener('DOMContentLoaded', () => {
    inyectar_cambios(estadoInicial);
});
