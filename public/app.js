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
                row1: {
                    grupo_rut: { input: { value: data.rut } },
                    grupo_nacimiento: { input: { value: data.fecha_nacimiento } }
                },
                grupo_fechas: {
                    flexbox: {
                        inicio: { input: { value: data.fecha_inicio } },
                        fin: { input: { value: data.fecha_fin } }
                    }
                },
                boton_consultar: {
                    text: 'Cargando (esto puede tardar)...',
                    disabled: true,
                    _style: { 'background-color': '#64748b', cursor: 'not-allowed' }
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
                        text: 'Consultar Exámenes',
                        disabled: false,
                        _style: { 'background-color': '#0ea5e9', cursor: 'pointer' }
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
            _style: { 'background': '#1e293b', 'padding': '20px', 'border-radius': '12px', 'border': '1px solid #334155', 'box-shadow': '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
            titulo: { tag: 'h2', text: 'Datos del Paciente', _style: { margin: '0 0 15px 0', color: '#38bdf8', 'font-size': '1.25rem' } },
            grid: {
                tag: 'div',
                _style: { display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' },
                rut: {
                    tag: 'div',
                    lbl: { tag: 'span', text: 'RUT', _style: { color:'#94a3b8', 'font-size':'0.875rem', display: 'block' } },
                    val: { tag: 'strong', text: data.rut, _style: { color:'#f8fafc' } }
                },
                nombre: {
                    tag: 'div',
                    lbl: { tag: 'span', text: 'Nombre Completo', _style: { color:'#94a3b8', 'font-size':'0.875rem', display: 'block' } },
                    val: { tag: 'strong', text: `${data.nombre} ${data.apellidos}`, _style: { color:'#f8fafc' } }
                },
                sexo: {
                    tag: 'div',
                    lbl: { tag: 'span', text: 'Sexo', _style: { color:'#94a3b8', 'font-size':'0.875rem', display: 'block' } },
                    val: { tag: 'strong', text: data.sexo, _style: { color:'#f8fafc' } }
                },
            }
        },
        atenciones: {
            tag: 'div',
            _style: { 'margin-top': '25px', 'background': '#1e293b', 'padding': '20px', 'border-radius': '12px', 'border': '1px solid #334155' },
            titulo: {
                tag: 'h2',
                _style: { margin: '0 0 15px 0', color: '#f8fafc', 'font-size': '1.25rem', display: 'flex', 'align-items': 'center', gap: '10px' },
                icono: { tag: 'span', text: '📅 Atenciones encontradas' },
                badge: { tag: 'span', text: String(data.atenciones.length), _style: { background:'#0ea5e9', padding:'2px 8px', 'border-radius':'12px', 'font-size':'0.9rem', color:'white' } }
            },
            lista: {
                tag: 'div',
                _style: { display: 'flex', 'flex-direction': 'column', gap: '10px' },
                children: data.atenciones.map(a => ({
                    tag: 'div',
                    _style: { padding: '12px 16px', background: '#0f172a', 'border-radius': '8px', border: '1px solid #1e293b', display: 'flex', 'align-items': 'center', gap: '15px' },
                    badge: { tag: 'span', text: `N° ${a.numero}`, _style: { background: '#047857', color: 'white', padding: '4px 10px', 'border-radius': '6px', 'font-weight': 'bold', 'font-size': '0.85rem' } },
                    paciente: { tag: 'span', text: a.paciente, _style: { color: '#e2e8f0', 'font-weight': '500' } }
                }))
            }
        },
        examenes: {
            tag: 'div',
            _style: { 'margin-top': '25px', 'background': '#1e293b', 'padding': '20px', 'border-radius': '12px', 'border': '1px solid #334155' },
            titulo: {
                tag: 'h2',
                _style: { margin: '0 0 15px 0', color: '#f8fafc', 'font-size': '1.25rem', display: 'flex', 'align-items': 'center', gap: '10px' },
                icono: { tag: 'span', text: '🔬 Exámenes Listos' },
                badge: { tag: 'span', text: String(data.examenes.length), _style: { background:'#f59e0b', padding:'2px 8px', 'border-radius':'12px', 'font-size':'0.9rem', color:'white' } }
            },
            grid: {
                tag: 'div',
                _style: { display: 'flex', 'flex-direction': 'column', gap: '10px' },
                children: data.examenes.map(e => ({
                    tag: 'div',
                    _style: { padding: '15px 20px', background: '#0f172a', border: '1px solid #1e293b', 'border-radius': '8px', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' },
                    info: {
                        tag: 'div',
                        _style: { display: 'flex', 'align-items': 'center', gap: '15px' },
                        codigo: { tag: 'span', text: e.codigo, _style: { color: '#94a3b8', 'font-family': 'monospace', 'font-size': '0.9rem', background: '#1e293b', padding: '2px 6px', 'border-radius': '4px' } },
                        descripcion: { tag: 'span', text: e.descripcion, _style: { color: '#f8fafc', 'font-weight': '500' } }
                    },
                    boton: {
                        tag: 'a',
                        text: '📄 Ver Detalle',
                        href: `/api/pdf?url_ver=${encodeURIComponent(e.url_ver)}`,
                        target: '_blank',
                        _style: { 'background-color': '#0ea5e9', color: '#ffffff', padding: '8px 16px', 'text-decoration': 'none', 'border-radius': '6px', 'font-weight': '600', 'font-size': '0.9rem', transition: 'background 0.2s', cursor: 'pointer', 'box-shadow': '0 2px 4px rgba(14, 165, 233, 0.3)' }
                    }
                }))
            }
        },
        errores: data.errores.length > 0 ? {
            tag: 'div',
            _style: { 'margin-top': '20px', color: '#f87171', background: '#450a0a', padding: '15px', 'border-radius': '8px', border: '1px solid #7f1d1d' },
            texto: { tag: 'p', text: `⚠️ Errores: ${data.errores.join(', ')}`, _style: { margin: 0 } }
        } : {
            // Reemplazo vacío para limpiar errores de búsquedas anteriores
            tag: 'div',
            _style: { display: 'none' },
            texto: { tag: 'span', text: '' }
        }
    };

    // Actualizamos únicamente la ruta "resultados" de nuestro Estado Principal reemplazando todo el bloque (sobreescribiendo lo anterior)
    inyectar_cambios({ resultados: uiResultados });
}

// ==========================================
// ESTADO INICIAL DE LA APP (El "ui.json")
// ==========================================
const estadoInicial = {
    tag: 'div',
    _style: { 'max-width': '1000px', margin: '0 auto', 'font-family': '"Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#e2e8f0' },
    encabezado: {
        tag: 'h1',
        text: 'Consulta Médica IrisLab',
        _style: { 'text-align': 'center', 'font-size': '2.5rem', color: '#f8fafc', margin: '20px 0 30px 0', 'font-weight': '800' }
    },
    formulario: {
        tag: 'form',
        id: 'consultaForm',
        submit: 'submit_consulta', // Llama a la acción mapeada
        _style: { 'background': '#1e293b', 'padding': '30px', 'border-radius': '16px', 'box-shadow': '0 10px 15px -3px rgba(0, 0, 0, 0.2)', border: '1px solid #334155', display: 'flex', 'flex-direction': 'column', gap: '20px' },

        row1: {
            tag: 'div',
            _style: { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '20px' },
            grupo_rut: {
                tag: 'div',
                _style: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
                label: { tag: 'label', text: 'RUT', _style: { 'font-weight': '600', color: '#94a3b8', 'font-size': '0.9rem' } },
                input: { tag: 'input', type: 'text', name: 'rut', placeholder: 'Ej: 19.185.163-3', required: true, _style: { padding: '12px', 'border-radius': '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', outline: 'none' } }
            },
            grupo_nacimiento: {
                tag: 'div',
                _style: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
                label: { tag: 'label', text: 'Fecha Nacimiento', _style: { 'font-weight': '600', color: '#94a3b8', 'font-size': '0.9rem' } },
                input: { tag: 'input', type: 'text', name: 'fecha_nacimiento', placeholder: 'DD-MM-YYYY', required: true, _style: { padding: '12px', 'border-radius': '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', outline: 'none' } }
            }
        },
        grupo_fechas: {
            tag: 'fieldset',
            _style: { padding: '20px', border: '1px solid #475569', 'border-radius': '12px' },
            legend: { tag: 'legend', text: 'Rango de Búsqueda', _style: { color: '#38bdf8', 'font-weight': '600', padding: '0 10px' } },
            flexbox: {
                tag: 'div',
                _style: { display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '20px' },
                inicio: {
                    tag: 'div',
                    _style: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
                    label: { tag: 'label', text: 'Desde', _style: { 'font-weight': '600', color: '#94a3b8', 'font-size': '0.9rem' } },
                    input: { tag: 'input', type: 'date', name: 'fecha_inicio', required: true, _style: { padding: '12px', 'border-radius': '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', outline: 'none', 'color-scheme': 'dark' } }
                },
                fin: {
                    tag: 'div',
                    _style: { display: 'flex', 'flex-direction': 'column', gap: '8px' },
                    label: { tag: 'label', text: 'Hasta', _style: { 'font-weight': '600', color: '#94a3b8', 'font-size': '0.9rem' } },
                    input: { tag: 'input', type: 'date', name: 'fecha_fin', required: true, _style: { padding: '12px', 'border-radius': '8px', border: '1px solid #475569', background: '#0f172a', color: 'white', outline: 'none', 'color-scheme': 'dark' } }
                }
            }
        },
        boton_consultar: {
            tag: 'button',
            type: 'submit',
            text: 'Consultar Exámenes',
            _style: { 'margin-top': '10px', padding: '14px', 'background-color': '#0ea5e9', color: 'white', border: 'none', cursor: 'pointer', 'font-size': '1rem', 'font-weight': 'bold', 'border-radius': '8px', transition: 'background 0.2s', 'box-shadow': '0 4px 6px -1px rgba(14, 165, 233, 0.4)' }
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
