export const RESERVED = {
    tag: true, id: true, class: true, text: true, html: true, value: true, name: true, placeholder: true, type: true, required: true,
    disabled: true, click: true, submit: true, change: true, href: true, target: true, src: true, children: true, _style: true
};

let currentContent = null;

export function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
            deepMerge(target[key], source[key]);
        } else target[key] = source[key];
    }
    return target;
}

export function inyectar_cambios(partial, targetNodeId = 'app') {
    if(!currentContent) currentContent = {};
    deepMerge(currentContent, partial);

    const app = document.getElementById(targetNodeId);
    app.innerHTML = '';
    // Reconstruimos el arbol
    construir(currentContent, app, '', window.actionDictionary || {});
}

export function construir(config, parent, pathPrefix = '', actionDictionary = {}) {
    if (Array.isArray(config)) {
        config.forEach((c, idx) => construir(c, parent, `${pathPrefix}[${idx}]`, actionDictionary));
        return;
    }

    const tagName = config.tag || 'div';
    const el = document.createElement(tagName);
    if (pathPrefix) el.dataset.path = pathPrefix;

    if (config.id) el.id = config.id;
    if (config.class) el.className = config.class;
    if (config.text !== undefined) el.textContent = config.text; // Seguro contra XSS
    if (config.html !== undefined) el.innerHTML = config.html; // Peligroso, usar solo para plantillas controladas
    if (config.value !== undefined) el.value = config.value;
    if (config.name) el.name = config.name;
    if (config.placeholder) el.placeholder = config.placeholder;
    if (config.type) el.type = config.type;
    if (config.required) el.required = config.required;
    if (config.disabled !== undefined) el.disabled = config.disabled;
    if (config.href) el.href = config.href;
    if (config.target) el.target = config.target;
    if (config.src) el.src = config.src;

    if (config.click && actionDictionary[config.click]) el.addEventListener('click', (e) => actionDictionary[config.click](e, el, config, pathPrefix));
    if (config.submit && actionDictionary[config.submit]) el.addEventListener('submit', (e) => actionDictionary[config.submit](e, el, config, pathPrefix));
    if (config.change && actionDictionary[config.change]) el.addEventListener('change', (e) => actionDictionary[config.change](e, el, config, pathPrefix));

    // Si pasamos estilos bajo la llave especial _style, los aplicamos
    if (config._style) {
        for (const cssKey in config._style) {
            el.style.setProperty(cssKey, config._style[cssKey]);
        }
    }

    // Children array explicitly defined
    if (config.children && Array.isArray(config.children)) {
        config.children.forEach((childConfig, idx) => {
            const childPath = pathPrefix ? `${pathPrefix}.children[${idx}]` : `children[${idx}]`;
            construir(childConfig, el, childPath, actionDictionary);
        });
    }
    // Implicit children defined as object keys
    else {
        for (const key in config) {
            if (RESERVED[key]) continue;
            const val = config[key];
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
                construir(val, el, childPath, actionDictionary);
            }
        }
    }

    parent.appendChild(el);
    return el;
}
