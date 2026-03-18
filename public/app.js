import { inyectar_cambios } from './engine.js';

// Diccionario de Lógica del Negocio (Mapeado directo por String en el JSON)
window.actionDictionary = {
    "submit_consulta": async (e, formNode, config) => {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Guardar el estado actual del formulario para no perder lo tipeado al re-renderizar
        // y establecer el estado de carga declarativamente con spinner
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
                    html: '<span class="spinner"></span> Cargando...',
                    disabled: true,
                    _style: { 'background-color': '#64748b', cursor: 'not-allowed', display: 'flex', 'align-items': 'center', 'justify-content': 'center', gap: '10px' }
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
                        html: 'Consultar Exámenes',
                        disabled: false,
                        _style: { 'background-color': '#0ea5e9', cursor: 'pointer', display: 'block' }
                    }
                }
            });
        }
    }
};

// Generador de Componentes Visuales (Nodos JSON) a partir de los Datos Crudos
function obtenerIconoExamen(nombre) {
    const n = nombre.toLowerCase();
    if (n.includes('hemo') || n.includes('sangre')) return '🩸';
    if (n.includes('orina') || n.includes('uro')) return '💧';
    if (n.includes('perfil') || n.includes('bioqui')) return '🧪';
    if (n.includes('pcr') || n.includes('cultivo') || n.includes('virus')) return '🦠';
    if (n.includes('radiogra') || n.includes('rx') || n.includes('imagen')) return '🩻';
    return '📄';
}

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
            _style: { 'margin-top': '25px', 'background': '#1e293b', 'padding': '20px', 'border-radius': '12px', 'border': '1px solid #334155', 'position': 'relative' },
            titulo: {
                tag: 'h2',
                _style: { margin: '0 0 15px 0', color: '#f8fafc', 'font-size': '1.25rem', display: 'flex', 'align-items': 'center', gap: '10px' },
                icono: { tag: 'span', text: '🔬 Exámenes Listos' },
                badge: { tag: 'span', text: String(data.examenes.length), _style: { background:'#f59e0b', padding:'2px 8px', 'border-radius':'12px', 'font-size':'0.9rem', color:'white' } },
                instruccion: { tag: 'span', text: '(Selecciona 2 o más para comparar)', _style: { 'font-size': '0.85rem', color: '#94a3b8', 'margin-left': 'auto', 'font-weight': 'normal', display: 'none' } } // Oculto por defecto ya que ahora hay un buscador
            },
            buscador_inteligente: {
                tag: 'div',
                _style: { 'margin-bottom': '20px', display: 'flex', 'flex-direction': 'column', gap: '8px' },
                label: { tag: 'label', text: 'Búsqueda Rápida y Comparación Automática', _style: { color: '#38bdf8', 'font-size': '0.9rem', 'font-weight': '600' } },
                input: {
                    tag: 'input',
                    type: 'text',
                    id: 'input_buscador',
                    placeholder: 'Ej: Escribe "Hemograma" o "HEMA"...',
                    inputAction: 'filtrar_examenes', // Evento nuevo para búsqueda en tiempo real
                    _style: { padding: '12px 16px', 'border-radius': '8px', border: '1px solid #0ea5e9', background: '#0f172a', color: 'white', outline: 'none', 'font-size': '1rem', width: '100%', 'box-sizing': 'border-box' }
                }
            },
            fab_comparar: {
                tag: 'button',
                id: 'btn_comparar',
                text: 'Comparar Seleccionados (0)',
                click: 'iniciar_comparacion',
                _style: { display: 'none', position: 'fixed', bottom: '30px', right: '30px', 'background-color': '#10b981', color: 'white', padding: '15px 25px', 'border-radius': '30px', border: 'none', 'font-weight': 'bold', 'font-size': '1rem', 'box-shadow': '0 10px 15px -3px rgba(16, 185, 129, 0.4)', cursor: 'pointer', 'z-index': 100 }
            },
            grupos_por_fecha: {
                tag: 'div',
                _style: { display: 'flex', 'flex-direction': 'column', gap: '20px' },
                children: Object.entries(
                    data.examenes.reduce((acc, e) => {
                        const fecha = e.fecha || 'Sin Fecha';
                        if (!acc[fecha]) acc[fecha] = [];
                        acc[fecha].push(e);
                        return acc;
                    }, {})
                ).map(([fecha, examenesFecha]) => ({
                    tag: 'div',
                    _style: { display: 'flex', 'flex-direction': 'column', gap: '10px' },
                    header_fecha: {
                        tag: 'h3',
                        text: `Fecha de Atención: ${fecha}`,
                        _style: { margin: '10px 0 5px 0', color: '#cbd5e1', 'font-size': '1.1rem', 'border-bottom': '1px solid #475569', 'padding-bottom': '5px' }
                    },
                    grid: {
                        tag: 'div',
                        _style: { display: 'flex', 'flex-direction': 'column', gap: '10px' },
                        children: examenesFecha.map(e => ({
                            tag: 'div',
                            class: 'fila-examen', // Añadido para fácil filtrado y hover css
                            'data-nombre': e.descripcion.toLowerCase(),
                            'data-codigo': e.codigo.toLowerCase(),
                            _style: { padding: '15px 20px', background: '#0f172a', border: '1px solid #1e293b', 'border-radius': '8px', display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease' },
                            info: {
                                tag: 'div',
                                _style: { display: 'flex', 'align-items': 'center', gap: '15px' },
                                checkbox: {
                                    tag: 'input',
                                    type: 'checkbox',
                                    name: 'examenes_comparar',
                                    value: e.url_ver,
                                    'data-fecha': fecha,
                                    'data-nombre': e.descripcion,
                                    change: 'actualizar_contador_comparar',
                                    _style: { cursor: 'pointer', width: '18px', height: '18px', 'accent-color': '#10b981' }
                                },
                                codigo: { tag: 'span', text: e.codigo, _style: { color: '#94a3b8', 'font-family': 'monospace', 'font-size': '0.9rem', background: '#1e293b', padding: '2px 6px', 'border-radius': '4px' } },
                                icono_tipo: { tag: 'span', text: obtenerIconoExamen(e.descripcion), _style: { 'font-size': '1.2rem' } },
                                descripcion: { tag: 'span', text: e.descripcion, _style: { color: '#f8fafc', 'font-weight': '500' } }
                            },
                            boton: {
                                tag: 'a',
                                html: '📄 <span class="hover-text">Ver Detalle</span>',
                                class: 'btn-ver-detalle',
                                href: `/api/pdf?url_ver=${encodeURIComponent(e.url_ver)}`,
                                target: '_blank',
                                _style: { 'background-color': '#1e293b', color: '#38bdf8', padding: '8px 16px', 'text-decoration': 'none', 'border-radius': '6px', 'font-weight': '600', 'font-size': '0.9rem', transition: 'all 0.2s', cursor: 'pointer', border: '1px solid #38bdf8' }
                            }
                        }))
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

// Estilos globales adicionales (Spinner, Hover, Scrollbars) para no ensuciar el JSON
const globalStyles = document.createElement('style');
globalStyles.innerHTML = `
    .spinner {
        border: 3px solid rgba(255,255,255,0.3);
        border-radius: 50%;
        border-top: 3px solid #fff;
        width: 16px;
        height: 16px;
        animation: spin 1s linear infinite;
        display: inline-block;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

    .fila-examen:hover {
        transform: translateY(-2px);
        border-color: #38bdf8 !important;
        box-shadow: 0 4px 12px rgba(56, 189, 248, 0.15);
    }

    .btn-ver-detalle:hover {
        background-color: #38bdf8 !important;
        color: #0f172a !important;
    }

    #input_buscador:focus {
        border-color: #38bdf8 !important;
        box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.3);
    }

    /* Scrollbar estilizado para el modal */
    .modal-content::-webkit-scrollbar { width: 8px; height: 8px; }
    .modal-content::-webkit-scrollbar-track { background: #1e293b; border-radius: 4px; }
    .modal-content::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
    .modal-content::-webkit-scrollbar-thumb:hover { background: #64748b; }
`;
document.head.appendChild(globalStyles);

    // Añadir lógica extra al diccionario para la comparación
    window.actionDictionary['filtrar_examenes'] = (e) => {
        const termino = e.target.value.toLowerCase().trim();
        const filas = document.querySelectorAll('.fila-examen');

        filas.forEach(fila => {
            const nombre = fila.getAttribute('data-nombre') || '';
            const codigo = fila.getAttribute('data-codigo') || '';
            const checkbox = fila.querySelector('input[type="checkbox"]');

            if (termino === '') {
                // Si se borra la búsqueda, mostrar todos, pero desmarcar automáticamente
                fila.style.display = 'flex';
                if (checkbox) checkbox.checked = false;
            } else {
                // Filtrar por nombre o código
                const coincide = nombre.includes(termino) || codigo.includes(termino);
                fila.style.display = coincide ? 'flex' : 'none';

                // Magia: Seleccionar automáticamente solo si coincide y hay texto
                if (checkbox) checkbox.checked = coincide;
            }
        });

        // Ocultar cabeceras de fechas vacías
        const gruposFecha = document.querySelectorAll('#resultados_container h3'); // header_fecha
        gruposFecha.forEach(h3 => {
            const contenedorGrupo = h3.nextElementSibling; // El grid de ese dia
            if (contenedorGrupo) {
                const filasVisibles = Array.from(contenedorGrupo.children).filter(f => f.style.display !== 'none');
                h3.style.display = filasVisibles.length > 0 ? 'block' : 'none';
            }
        });

        // Actualizar el contador del FAB
        window.actionDictionary['actualizar_contador_comparar']();
    };

// Añadir lógica extra al diccionario para la comparación
window.actionDictionary['actualizar_contador_comparar'] = () => {
    const checkboxes = document.querySelectorAll('input[name="examenes_comparar"]:checked');
    const count = checkboxes.length;
    const btn = document.getElementById('btn_comparar');
    if (btn) {
        btn.style.display = count >= 2 ? 'block' : 'none';
        btn.textContent = `📊 Comparar Seleccionados (${count})`;
    }
};

window.actionDictionary['iniciar_comparacion'] = async (e, btnNode) => {
    const checkboxes = document.querySelectorAll('input[name="examenes_comparar"]:checked');
    const seleccionados = Array.from(checkboxes).map(cb => ({
        url_ver: cb.value,
        fecha: cb.getAttribute('data-fecha'),
        nombre: cb.getAttribute('data-nombre')
    }));

    if (seleccionados.length < 2) return;

    // Mostrar estado de carga
    btnNode.textContent = "Extrayendo PDFs (tardará)...";
    btnNode.style.backgroundColor = "#64748b";
    btnNode.style.cursor = "wait";

    try {
        const response = await fetch('/api/comparar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ examenes: seleccionados })
        });
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        generarUIComparacion(data, seleccionados[0].nombre);

    } catch (error) {
        alert("Error al comparar: " + error.message);
    } finally {
        btnNode.textContent = `📊 Comparar Seleccionados (${seleccionados.length})`;
        btnNode.style.backgroundColor = "#10b981";
        btnNode.style.cursor = "pointer";
    }
};

function generarUIComparacion(resultadosArray, nombreExamenGeneral) {
    // Collect all unique parameter keys from all successful extractions
    const parametrosMap = new Set();
    const fechas = [];

    resultadosArray.forEach(res => {
        fechas.push(res.fecha);
        if (res.datos) {
            Object.keys(res.datos).forEach(k => parametrosMap.add(k));
        }
    });

    const headersGrid = [
        { tag: 'div', text: 'Parámetro / Prueba', _style: { background: '#0ea5e9', color: 'white', padding: '10px', 'font-weight': 'bold', 'border-radius': '6px 0 0 6px' } }
    ];
    fechas.forEach(f => {
        headersGrid.push({ tag: 'div', text: f, _style: { background: '#0ea5e9', color: 'white', padding: '10px', 'font-weight': 'bold', 'text-align': 'center' } });
    });

    const rows = [];
    Array.from(parametrosMap).forEach(param => {
        const celdas = [
            { tag: 'div', text: param, _style: { padding: '10px', 'border-bottom': '1px solid #334155', 'font-weight': '500', color: '#cbd5e1' } }
        ];

        resultadosArray.forEach(res => {
            const val = res.datos ? (res.datos[param] || '-') : 'Error PDF';
            celdas.push({ tag: 'div', text: val, _style: { padding: '10px', 'border-bottom': '1px solid #334155', 'text-align': 'center', color: val !== '-' ? '#f8fafc' : '#475569' } });
        });

        // Wrap in a row container so the grid layout holds
        rows.push(...celdas);
    });

    // Aplicando Sticky Headers
    headersGrid[0]._style['position'] = 'sticky';
    headersGrid[0]._style['top'] = '0';
    headersGrid[0]._style['left'] = '0';
    headersGrid[0]._style['z-index'] = '20';

    for(let i=1; i<headersGrid.length; i++){
        headersGrid[i]._style['position'] = 'sticky';
        headersGrid[i]._style['top'] = '0';
        headersGrid[i]._style['z-index'] = '10';
    }

    rows.forEach((celda, i) => {
        // La primera celda de cada fila es el parametro, hay que fijarla a la izquierda
        if(i % (fechas.length + 1) === 0){
            celda._style['position'] = 'sticky';
            celda._style['left'] = '0';
            celda._style['z-index'] = '10';
            celda._style['background'] = '#1e293b'; // Un fondo solido para tapar lo que hace scroll detras
        } else {
            celda._style['background'] = '#0f172a';
        }
    });

    const modalUI = {
        tag: 'div',
        id: 'modal_comparacion',
        _style: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.7)', 'backdrop-filter': 'blur(8px)', '-webkit-backdrop-filter': 'blur(8px)', display: 'flex', 'justify-content': 'center', 'align-items': 'center', 'z-index': 1000 },
        click: 'cerrar_modal',
        content: {
            tag: 'div',
            class: 'modal-content', // Para el scrollbar
            _style: { background: '#1e293b', padding: '30px', 'border-radius': '16px', 'max-width': '900px', width: '90%', 'max-height': '85vh', 'overflow-y': 'auto', 'overflow-x': 'auto', border: '1px solid #334155', 'box-shadow': '0 25px 50px -12px rgba(0,0,0,0.5)' },
            click: 'evitar_cierre',
            header: {
                tag: 'div',
                _style: { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '20px' },
                title: { tag: 'h2', text: `Comparativa Evolutiva: ${nombreExamenGeneral}`, _style: { margin: 0, color: '#38bdf8' } },
                closeBtn: { tag: 'button', text: '✖ Cerrar', click: 'cerrar_modal', _style: { background: '#334155', color: '#f8fafc', border: 'none', cursor: 'pointer', 'font-size': '1rem', 'font-weight': 'bold', padding: '8px 12px', 'border-radius': '6px', transition: 'background 0.2s' } }
            },
            advertencia: {
                tag: 'div',
                text: '⚠ Nota: Estos datos son extraídos automáticamente del texto del PDF y pueden contener inexactitudes.',
                _style: { background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '10px', 'border-radius': '8px', 'margin-bottom': '20px', 'font-size': '0.85rem', 'text-align': 'center' }
            },
            tabla: {
                tag: 'div',
                _style: { display: 'grid', 'grid-template-columns': `minmax(250px, 2fr) repeat(${fechas.length}, minmax(120px, 1fr))`, gap: '1px', background: '#334155', 'border-radius': '8px', overflow: 'hidden' },
                children: [...headersGrid, ...rows]
            }
        }
    };

    window.actionDictionary['cerrar_modal'] = (e) => {
        const modal = document.getElementById('modal_comparacion');
        if (modal) modal.remove(); // No necesitamos el motor JSON aquí para destruir algo temporal superpuesto
    };
    window.actionDictionary['evitar_cierre'] = (e) => {
        e.stopPropagation();
    };

    // Inyectamos el modal directamente al body
    import('./engine.js').then(({ construir }) => {
        construir(modalUI, document.body, '', window.actionDictionary);
    });
}

// Arrancar App
document.addEventListener('DOMContentLoaded', () => {
    inyectar_cambios(estadoInicial);
});
