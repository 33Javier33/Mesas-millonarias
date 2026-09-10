const cssSheet = document.getElementById('estilos-dinamicos');
const escenarioSorteo = document.getElementById('escenario-sorteo');
const fondoImagenEl = document.getElementById('fondo-imagen');
const cajaMontoEl = document.getElementById('caja-monto');
const cajaSubtituloEl = document.getElementById('caja-subtitulo');
const textoMontoPremio = document.getElementById('texto-monto-premio');
const cajaMesa = document.getElementById('reel-mesa');
const cajaGanador = document.getElementById('reel-ganador');
const textoMesa = cajaMesa.querySelector('.reel-texto');
const textoGanador = cajaGanador.querySelector('.reel-texto');
const mensajeEstado = document.getElementById('mensaje-estado');
const confettiContainer = document.getElementById('confetti-container');
const fuegosContainer = document.getElementById('fuegos-artificiales');
const confetiAmbienteContainer = document.getElementById('confeti-ambiente');
let sorteoEnCurso = false;
let confettiInterval;
let fuegosTimeoutId = null;
let confetiExplosivoTimeoutId = null;
let ultimoColorGanador = '';
let datosSorteo = {};

// Evita que el mismo resultado se repita dos veces seguidas dentro de cada categoría.
let ultimaMesaGanadora = '';
let ultimoPuestoGanador = '';
const ultimosColoresPorGrupo = { 21: '', 22: '', 23: '' };
const elegirSinRepetir = (lista, ultimoValor) => {
    if (!lista || lista.length === 0) return undefined;
    if (lista.length === 1) return lista[0];
    const opciones = lista.filter((v) => v !== ultimoValor);
    const pool = opciones.length ? opciones : lista;
    return pool[Math.floor(Math.random() * pool.length)];
};

const formatColorName = (name) => { if (typeof name !== 'string') return ''; return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-'); };
// Colores oscuros (ej. Negro) son invisibles sobre el fondo oscuro de las
// cajas en Tema 2 y Tema 3, así que se les agrega un halo/contorno claro
// para que resalten. Sobre el fondo blanco del Tema Original ese halo
// claro se funde con el blanco y no afecta en nada.
const obtenerLuminancia = (hex) => {
    const h = (hex || '').replace('#', '');
    if (h.length !== 6) return 1;
    const r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const generarClasesColores = (colorName, hexCode) => {
    const formattedName = formatColorName(colorName);
    if (hexCode && !cssSheet.innerHTML.includes(`.color-${formattedName}`)) {
        const esOscuro = obtenerLuminancia(hexCode) < 0.35;
        const contorno = esOscuro ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.3)';
        const halo = esOscuro
            ? '0 0 8px rgba(255, 255, 255, 0.75), 0 0 3px rgba(255, 255, 255, 0.9)'
            : '0 0 4px rgba(0, 0, 0, 0.65), 0 0 2px rgba(0, 0, 0, 0.8)';
        cssSheet.innerHTML += ` .color-${formattedName} { color: ${hexCode} !important; -webkit-text-stroke: 1px ${contorno} !important; text-shadow: ${halo} !important; }`;
    }
};
const formatMonto = (numero) => (Number(numero) || 0).toLocaleString('es-CL');
const obtenerMontoPremio = () => (datosSorteo.montoPremio !== undefined && datosSorteo.montoPremio !== null) ? datosSorteo.montoPremio : 100000;

// --- Temas visuales de la pantalla de sorteo ---
// Cada tema define su imagen de fondo, su proporción (ancho/alto) y la posición
// en % de cada elemento superpuesto, calculada sobre esa imagen.
const TEMAS = {
    original: {
        imagen: 'img/fondo-sorteo.png',
        aspecto: 1220 / 699,
        monto: { left: 31.72, top: 38.91, width: 36.31, height: 11.73 },
        subtitulo: { left: 33.44, top: 52.79, width: 33.28, height: 6.3 },
        reelMesa: { left: 15.66, top: 74.96, width: 32.21, height: 9.45 },
        reelGanador: { left: 53.2, top: 74.96, width: 32.21, height: 9.45 },
    },
    tema2: {
        imagen: 'img/fondo-tema2.jpg',
        aspecto: 1368 / 784,
        monto: { left: 31.73, top: 38.52, width: 36.62, height: 12.12 },
        subtitulo: { left: 33.63, top: 53.06, width: 33.48, height: 6.12 },
        reelMesa: { left: 14.25, top: 73.60, width: 35.01, height: 12.76 },
        reelGanador: { left: 52.05, top: 73.60, width: 35.67, height: 12.76 },
    },
    tema3: {
        imagen: 'img/fondo-tema3.jpg',
        aspecto: 1288 / 730,
        monto: { left: 33.70, top: 41.37, width: 38.90, height: 13.01 },
        subtitulo: { left: 35.71, top: 56.99, width: 35.56, height: 6.58 },
        reelMesa: { left: 14.52, top: 78.36, width: 37.81, height: 14.52 },
        reelGanador: { left: 55.05, top: 78.36, width: 38.12, height: 14.52 },
    },
};
let temaActual = '';
const ubicar = (el, pos) => { el.style.left = pos.left + '%'; el.style.top = pos.top + '%'; el.style.width = pos.width + '%'; el.style.height = pos.height + '%'; };
const aplicarTema = (temaKey) => {
    const clave = TEMAS[temaKey] ? temaKey : 'original';
    const tema = TEMAS[clave];
    if (clave !== temaActual) {
        fondoImagenEl.src = tema.imagen;
        escenarioSorteo.classList.remove('tema-original', 'tema-tema2', 'tema-tema3');
        escenarioSorteo.classList.add('tema-' + clave);
        temaActual = clave;
    }
    escenarioSorteo.style.width = `min(100vw, ${(tema.aspecto * 100)}vh)`;
    escenarioSorteo.style.height = `min(100vh, ${(100 / tema.aspecto)}vw)`;
    ubicar(cajaMontoEl, tema.monto);
    ubicar(cajaSubtituloEl, tema.subtitulo);
    ubicar(cajaMesa, tema.reelMesa);
    ubicar(cajaGanador, tema.reelGanador);
    ajustarTamano(cajaSubtituloEl.querySelector('span'), false);
};

const aplicarDatos = (data) => {
    datosSorteo = data || {};
    if (datosSorteo.colorMap) {
        Object.entries(datosSorteo.colorMap).forEach(([key, value]) => {
            const originalName = Object.keys(datosSorteo.colorMap).find(k => formatColorName(k) === key) || key;
            generarClasesColores(originalName, value);
        });
    }
    aplicarTema(datosSorteo.temaSorteo);
    textoMontoPremio.textContent = formatMonto(obtenerMontoPremio());
    ajustarTamano(textoMontoPremio, false);
    mensajeEstado.classList.toggle('mensaje-oculto', datosSorteo.mensajeEstadoActivado === false);
    actualizarEfectosAmbiente();
};

const cargarDatosLocalStorage = () => {
    const storedData = localStorage.getItem('mesasMillonariasData');
    if (storedData) {
        aplicarDatos(JSON.parse(storedData));
    } else {
        aplicarDatos({});
        mensajeEstado.textContent = 'Esperando configuración desde el panel de control...';
    }
};

const crearConfettiParticula = () => { const confetti = document.createElement('div'); confetti.classList.add('confetti'); const colors = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6']; confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]; confetti.style.setProperty('--x', `${(Math.random() - 0.5) * 150}vw`); confetti.style.setProperty('--x-end', `${(Math.random() - 0.5) * 200}vw`); confetti.style.setProperty('--deg', `${Math.random() * 360}deg`); confetti.style.setProperty('--deg-end', `${Math.random() * 360 * 2 + 360}deg`); const duration = Math.random() * 3 + 4; confetti.style.animationDuration = `${duration}s`; confetti.style.animationDelay = `-${Math.random() * duration}s`; confettiContainer.appendChild(confetti); confetti.addEventListener('animationend', () => confetti.remove()); };
const iniciarConfetiContinuo = () => { for (let i = 0; i < 50; i++) crearConfettiParticula(); confettiInterval = setInterval(crearConfettiParticula, 100); };
const detenerConfetiContinuo = () => { clearInterval(confettiInterval); confettiContainer.innerHTML = ''; };

// --- Efectos ambientales de fondo para Tema 2 y Tema 3: fuegos artificiales
// sutiles y ráfagas de confeti explosivo, independientes del confeti de
// celebración de arriba (ese solo se activa cuando hay un ganador). Se
// repiten solos con una espera aleatoria entre estallidos.
const COLORES_FUEGOS = ['#ffe9a8', '#f6da70', '#ff8fa3', '#8fd3ff', '#b98cff', '#9dffb0'];
const crearFuegoArtificial = () => {
    const estallido = document.createElement('div');
    estallido.className = 'fuego-estallido';
    estallido.style.left = `${10 + Math.random() * 80}%`;
    estallido.style.top = `${8 + Math.random() * 45}%`;
    const color = COLORES_FUEGOS[Math.floor(Math.random() * COLORES_FUEGOS.length)];
    const numChispas = 14;
    for (let i = 0; i < numChispas; i++) {
        const chispa = document.createElement('span');
        chispa.className = 'chispa';
        const angulo = (Math.PI * 2 * i) / numChispas + (Math.random() * 0.3 - 0.15);
        const distancia = 2.6 + Math.random() * 2.2;
        chispa.style.setProperty('--dx', `${(Math.cos(angulo) * distancia).toFixed(2)}cqw`);
        chispa.style.setProperty('--dy', `${(Math.sin(angulo) * distancia).toFixed(2)}cqw`);
        chispa.style.setProperty('--color', color);
        chispa.style.animationDelay = `${(Math.random() * 0.08).toFixed(2)}s`;
        estallido.appendChild(chispa);
    }
    fuegosContainer.appendChild(estallido);
    setTimeout(() => estallido.remove(), 1400);
};
const programarSiguienteFuego = () => {
    fuegosTimeoutId = setTimeout(() => { crearFuegoArtificial(); programarSiguienteFuego(); }, 3000 + Math.random() * 3000);
};
const detenerFuegosAmbiente = () => { if (fuegosTimeoutId) { clearTimeout(fuegosTimeoutId); fuegosTimeoutId = null; } fuegosContainer.innerHTML = ''; };
const iniciarFuegosAmbiente = () => { crearFuegoArtificial(); programarSiguienteFuego(); };

const COLORES_CONFETI_AMBIENTE = ['#f39c12', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f6da70'];
const crearEstallidoConfeti = () => {
    const origen = document.createElement('div');
    origen.className = 'confeti-origen';
    origen.style.left = `${12 + Math.random() * 76}%`;
    origen.style.top = `${52 + Math.random() * 16}%`;
    const numPiezas = 16;
    for (let i = 0; i < numPiezas; i++) {
        const pieza = document.createElement('span');
        pieza.className = 'confeti-pieza';
        const angulo = Math.random() * Math.PI * 2;
        const distancia = 5 + Math.random() * 9;
        pieza.style.setProperty('--dx', `${(Math.cos(angulo) * distancia).toFixed(2)}cqw`);
        pieza.style.setProperty('--dy', `${(Math.sin(angulo) * distancia + 3).toFixed(2)}cqw`);
        pieza.style.setProperty('--rot', `${Math.floor(Math.random() * 720 - 360)}deg`);
        pieza.style.setProperty('--color', COLORES_CONFETI_AMBIENTE[Math.floor(Math.random() * COLORES_CONFETI_AMBIENTE.length)]);
        pieza.style.animationDelay = `${(Math.random() * 0.05).toFixed(2)}s`;
        origen.appendChild(pieza);
    }
    confetiAmbienteContainer.appendChild(origen);
    setTimeout(() => origen.remove(), 1600);
};
const programarSiguienteConfetiExplosivo = () => {
    confetiExplosivoTimeoutId = setTimeout(() => { crearEstallidoConfeti(); programarSiguienteConfetiExplosivo(); }, 5000 + Math.random() * 4000);
};
const detenerConfetiExplosivoAmbiente = () => { if (confetiExplosivoTimeoutId) { clearTimeout(confetiExplosivoTimeoutId); confetiExplosivoTimeoutId = null; } confetiAmbienteContainer.innerHTML = ''; };
const iniciarConfetiExplosivoAmbiente = () => { crearEstallidoConfeti(); programarSiguienteConfetiExplosivo(); };

const actualizarEfectosAmbiente = () => {
    const enTema23 = (temaActual === 'tema2' || temaActual === 'tema3');
    const fuegosOn = enTema23 && datosSorteo.fuegosArtificialesActivado !== false;
    const confetiExplOn = enTema23 && datosSorteo.confetiExplosivoActivado !== false;
    if (fuegosOn && !fuegosTimeoutId) { iniciarFuegosAmbiente(); }
    else if (!fuegosOn && fuegosTimeoutId) { detenerFuegosAmbiente(); }
    if (confetiExplOn && !confetiExplosivoTimeoutId) { iniciarConfetiExplosivoAmbiente(); }
    else if (!confetiExplOn && confetiExplosivoTimeoutId) { detenerConfetiExplosivoAmbiente(); }
};

// Reduce el tamaño de fuente solo lo justo para que el texto entre en una
// sola línea dentro del ancho de la caja (y, si se pide, también su alto).
// No achica nada si el texto ya cabe: es una red de seguridad contra
// cortes, no un tamaño "ajustado a medida" en cada render.
const ajustarTamano = (elementoTexto, verificarAlto = true) => {
    elementoTexto.style.fontSize = '';
    const contenedor = elementoTexto.parentElement;
    const estiloContenedor = getComputedStyle(contenedor);
    const paddingHorizontal = parseFloat(estiloContenedor.paddingLeft) + parseFloat(estiloContenedor.paddingRight);
    const disponibleAncho = contenedor.clientWidth - paddingHorizontal - 4;
    // La caja no tiene padding vertical propio; dejamos un margen (18%) para que
    // el texto no toque el marco decorativo de arriba/abajo (solo aplica a las
    // tómbolas, que sí están encajadas dentro de un marco ajustado).
    const disponibleAlto = verificarAlto ? contenedor.clientHeight * 0.82 : Infinity;
    let tamano = parseFloat(getComputedStyle(elementoTexto).fontSize);

    const ancho = elementoTexto.scrollWidth;
    if (ancho > disponibleAncho && ancho > 0) {
        tamano = Math.max(10, Math.floor(tamano * disponibleAncho / ancho));
        elementoTexto.style.fontSize = tamano + 'px';
    }
    // El alto de una línea de texto es ~1.05 veces el tamaño de fuente (line-height).
    const altoLinea = tamano * 1.05;
    if (altoLinea > disponibleAlto) {
        tamano = Math.max(10, Math.floor(tamano * disponibleAlto / altoLinea));
        elementoTexto.style.fontSize = tamano + 'px';
    }

    let intentos = 0;
    while ((elementoTexto.scrollWidth > disponibleAncho || elementoTexto.scrollHeight > disponibleAlto) && tamano > 10 && intentos < 20) {
        tamano -= 1;
        elementoTexto.style.fontSize = tamano + 'px';
        intentos++;
    }
};

// --- Tómbola: gira mostrando candidatos al azar, desacelerando hasta detenerse en el ganador ---
const girarTombola = (caja, elementoTexto, candidatos, ganador, duracionMs, esColor, callback) => {
    const lista = (candidatos && candidatos.length) ? candidatos : [ganador];
    caja.classList.remove('reel-ganadora');
    caja.classList.add('reel-girando');
    const inicio = performance.now();
    const delayMin = 55, delayMax = 260;

    const tick = () => {
        const transcurrido = performance.now() - inicio;
        const progreso = Math.min(transcurrido / duracionMs, 1);

        if (progreso >= 1) {
            elementoTexto.textContent = ganador;
            elementoTexto.className = 'reel-texto' + (esColor && ganador ? ` color-${formatColorName(ganador)}` : '');
            ajustarTamano(elementoTexto);
            caja.classList.remove('reel-girando');
            caja.classList.add('reel-ganadora');
            if (callback) callback();
            return;
        }

        const opciones = lista.filter(x => x !== elementoTexto.textContent);
        const candidato = (opciones.length ? opciones : lista)[Math.floor(Math.random() * (opciones.length || lista.length))];
        elementoTexto.textContent = candidato;
        elementoTexto.className = 'reel-texto' + (esColor ? ` color-${formatColorName(candidato)}` : '');
        ajustarTamano(elementoTexto);

        const delayActual = delayMin + (delayMax - delayMin) * Math.pow(progreso, 3);
        setTimeout(tick, delayActual);
    };
    tick();
};

const realizarSorteo = () => {
    if (sorteoEnCurso) return;
    cargarDatosLocalStorage();
    if (!datosSorteo || !datosSorteo.checkedMesas) { mensajeEstado.textContent = 'Faltan datos. Guarda la configuración en el panel de control.'; return; }

    const mesasEnJuego = datosSorteo.checkedMesas || [];
    if (mesasEnJuego.length === 0) {
        mensajeEstado.textContent = '¡Error! Debes seleccionar al menos una mesa en el panel de control.';
        return;
    }

    sorteoEnCurso = true;
    CanalSorteo.enviar({ tipo: 'sorteo-iniciado' });
    detenerConfetiContinuo();
    cajaGanador.classList.remove('reel-ganadora');
    textoGanador.textContent = '—';
    textoGanador.className = 'reel-texto';
    mensajeEstado.textContent = 'Girando la tómbola de mesas...';

    const mesaGanadora = elegirSinRepetir(mesasEnJuego, ultimaMesaGanadora);
    ultimaMesaGanadora = mesaGanadora;
    const todasLasMesas = datosSorteo.mesas || mesasEnJuego;
    const duracionMesaMs = (Number(datosSorteo.duracionMesa) > 0 ? Number(datosSorteo.duracionMesa) : 3) * 1000;
    const duracionGanadorMs = (Number(datosSorteo.duracionGanador) > 0 ? Number(datosSorteo.duracionGanador) : 3) * 1000;
    const confetiActivado = datosSorteo.confetiActivado !== false;

    girarTombola(cajaMesa, textoMesa, todasLasMesas, mesaGanadora, duracionMesaMs, false, () => {
        mensajeEstado.textContent = 'Girando la tómbola del ganador...';

        let candidatosGanador, listaChequeada, esColor = true, grupoRuleta = null;
        if (mesaGanadora.includes('Ruleta')) {
            if (mesaGanadora.includes('21') || mesaGanadora.includes('24') || mesaGanadora.includes('25')) {
                grupoRuleta = 21;
                candidatosGanador = datosSorteo.colores21 || [];
                listaChequeada = datosSorteo.checkedColores21 || [];
            } else if (mesaGanadora.includes('22')) {
                grupoRuleta = 22;
                candidatosGanador = datosSorteo.colores22 || [];
                listaChequeada = datosSorteo.checkedColores22 || [];
            } else if (mesaGanadora.includes('23')) {
                grupoRuleta = 23;
                candidatosGanador = datosSorteo.colores23 || [];
                listaChequeada = datosSorteo.checkedColores23 || [];
            }
        } else {
            esColor = false;
            candidatosGanador = ['1', '2', '3', '4', '5', '6'];
            listaChequeada = candidatosGanador;
        }

        if (!listaChequeada || listaChequeada.length === 0) {
            mensajeEstado.textContent = `¡Error! Faltan colores para la ${mesaGanadora}.`;
            cajaMesa.classList.remove('reel-ganadora');
            sorteoEnCurso = false;
            return;
        }

        const ultimoValorCategoria = grupoRuleta ? ultimosColoresPorGrupo[grupoRuleta] : ultimoPuestoGanador;
        const valorGanador = elegirSinRepetir(listaChequeada, ultimoValorCategoria);
        if (grupoRuleta) { ultimosColoresPorGrupo[grupoRuleta] = valorGanador; } else { ultimoPuestoGanador = valorGanador; }
        ultimoColorGanador = esColor ? valorGanador : '';

        girarTombola(cajaGanador, textoGanador, candidatosGanador, valorGanador, duracionGanadorMs, esColor, () => {
            mensajeEstado.innerHTML = `¡Tenemos ganador! Mesa <strong>${mesaGanadora}</strong>`;
            if (confetiActivado) { iniciarConfetiContinuo(); }
            sorteoEnCurso = false;
            CanalSorteo.enviar({ tipo: 'sorteo-terminado', mesa: mesaGanadora, ganador: valorGanador });
        });
    });
};

window.entregarPremio = function () {
    const claseColor = ultimoColorGanador ? `color-${formatColorName(ultimoColorGanador)}` : 'color-amarillo';
    mensajeEstado.innerHTML = `<span class="${claseColor}">¡${formatMonto(obtenerMontoPremio())} en Fichas Promocionales entregadas!</span><span class="subtexto">Premio válido con tarjeta del casino.</span>`;
    CanalSorteo.enviar({ tipo: 'premio-entregado' });
};

CanalSorteo.escuchar((mensaje) => {
    if (!mensaje || !mensaje.tipo) return;
    switch (mensaje.tipo) {
        case 'config-actualizada':
            try { localStorage.setItem('mesasMillonariasData', JSON.stringify(mensaje.datos)); } catch (e) { /* ignorar */ }
            aplicarDatos(mensaje.datos);
            break;
        case 'iniciar-sorteo':
            realizarSorteo();
            break;
        case 'entregar-premio':
            window.entregarPremio();
            break;
    }
});

document.body.addEventListener('click', realizarSorteo);

document.addEventListener('DOMContentLoaded', () => {
    cargarDatosLocalStorage();
    // Latido: informa al panel de control que esta pantalla sigue activa.
    const enviarLatido = () => CanalSorteo.enviar({ tipo: 'latido', estado: sorteoEnCurso ? 'girando' : 'listo' });
    enviarLatido();
    setInterval(enviarLatido, 1500);
});

window.addEventListener('resize', () => {
    [textoMesa, textoGanador].forEach((el) => { if (el.textContent && el.textContent !== '—') ajustarTamano(el); });
    ajustarTamano(textoMontoPremio, false);
    ajustarTamano(cajaSubtituloEl.querySelector('span'), false);
});
