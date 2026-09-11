let sorteoWindow = null;
const btnLanzar = document.getElementById('btn-lanzar-pantalla');
const btnPremio = document.getElementById('btn-premio');
const statusPantalla = document.getElementById('status-pantalla');
const btnIniciarSorteo = document.getElementById('btn-iniciar-sorteo');

// --- Conexión estable con la pantalla de sorteo vía CanalSorteo ---
// En vez de depender de la referencia de la ventana (que se pierde
// si esta página se recarga), escuchamos un "latido" periódico que
// envía sorteo.html mientras esté abierta, sin importar en qué
// pestaña/ventana se haya abierto.
const LATIDO_TIMEOUT_MS = 6000;
let ultimoLatido = 0;
let estadoSorteoRemoto = 'listo'; // 'listo' | 'girando'

const defaultData = {
    mesas: [ 'Blackjack 17', 'Blackjack 15', 'Blackjack 34', 'Draw-Poker 7', 'Draw-Poker 12', 'Hold\'em-Poker 8', 'Caribbean-Poker 13', 'Ruleta 21', 'Ruleta 22', 'Ruleta 23', 'Ruleta 24', 'Ruleta 25' ],
    colores21: ['Lila', 'Amarillo', 'Rojo', 'Verde', 'Azul', 'Plomo', 'Naranjo', 'Burdeo'],
    colores22: ['Amarillo', 'Verde', 'Azul', 'Celeste', 'Café', 'Negro', 'Burdeo', 'Rojo', 'Naranjo', 'Calipso', 'Gris'],
    colores23: ['Amarillo', 'Verde', 'Azul', 'Celeste', 'Café', 'Negro', 'Burdeo', 'Rojo', 'Naranjo', 'Calipso', 'Gris'],
    colorMap: { 'lila': '#9B59B6', 'amarillo': '#F1C40F', 'rojo': '#E74C3C', 'verde': '#2ECC71', 'azul': '#3498DB', 'plomo': '#95A5A6', 'naranjo': '#E67E22', 'burdeo': '#C0392B', 'celeste': '#5DADE2', 'cafe': '#A0522D', 'negro': '#000000', 'calipso': '#00A896', 'gris': '#7f8c8d' },
    montoPremio: 100000,
    duracionMesa: 3,
    duracionGanador: 3,
    confetiActivado: true,
    mensajeEstadoActivado: true,
    fuegosArtificialesActivado: true,
    confetiExplosivoActivado: true,
    temaSorteo: 'original'
};

let todasLasMesas, coloresRuleta21, coloresRuleta22, coloresRuleta23, colorMap, montoPremio;
const inputMontoPremio = document.getElementById('input-monto-premio');
const montoPremioPreview = document.getElementById('monto-premio-preview');
const inputDuracionMesa = document.getElementById('input-duracion-mesa');
const inputDuracionGanador = document.getElementById('input-duracion-ganador');
const inputConfetiActivado = document.getElementById('input-confeti-activado');
const inputMensajeActivado = document.getElementById('input-mensaje-activado');
const inputFuegosActivado = document.getElementById('input-fuegos-activado');
const inputConfetiExplosivoActivado = document.getElementById('input-confeti-explosivo-activado');
const inputsTemaSorteo = document.querySelectorAll('input[name="tema-sorteo"]');
const formatMonto = (numero) => (Number(numero) || 0).toLocaleString('es-CL');
const actualizarPreviewMonto = () => { montoPremioPreview.textContent = formatMonto(inputMontoPremio.value); };

// --- Sincronización remota (Google Apps Script) ---
// Ya viene conectada automáticamente (URL incluida en canal.js); este botón
// es solo para el caso avanzado de apuntar a otro backend en este dispositivo.
const btnSyncRemotaAvanzado = document.getElementById('btn-sync-remota-avanzado');
const editarUrlRemotaAvanzado = () => {
    const actual = CanalSorteo.obtenerUrlRemota();
    const nueva = prompt('La sincronización remota ya viene conectada automáticamente.\nSolo edita esto si quieres usar otro backend en este dispositivo:', actual);
    if (nueva !== null) {
        CanalSorteo.configurarUrlRemota(nueva);
        alert('¡Listo! Este dispositivo usará esa URL de sincronización remota.');
    }
};

// --- Lógica de Control de Ventana ---
function lanzarPantallaSorteo() { if (sorteoWindow && !sorteoWindow.closed) { sorteoWindow.focus(); return; } sorteoWindow = window.open('sorteo.html', 'Sorteo', 'fullscreen=yes,menubar=no,toolbar=no,location=no,status=no'); if (!sorteoWindow) { alert("El navegador bloqueó la ventana emergente."); return; } }

function actualizarStatusPantalla() {
    const conectado = (Date.now() - ultimoLatido) < LATIDO_TIMEOUT_MS;
    btnLanzar.textContent = (sorteoWindow && !sorteoWindow.closed) ? 'Enfocar Pantalla' : 'Lanzar Pantalla';

    if (conectado) {
        const girando = estadoSorteoRemoto === 'girando';
        statusPantalla.textContent = girando ? 'Sorteando...' : 'Conectado';
        statusPantalla.className = girando ? 'girando' : 'conectado';
        btnIniciarSorteo.disabled = girando;
    } else {
        statusPantalla.textContent = 'Desconectado';
        statusPantalla.className = 'desconectado';
        btnIniciarSorteo.disabled = true;
        btnPremio.disabled = true;
    }
}

function entregarPremio() {
    if ((Date.now() - ultimoLatido) >= LATIDO_TIMEOUT_MS) { alert('La pantalla de sorteo no está conectada.'); return; }
    CanalSorteo.enviar({ tipo: 'entregar-premio' });
    btnPremio.disabled = true;
}
function iniciarSorteoRemoto() {
    if ((Date.now() - ultimoLatido) >= LATIDO_TIMEOUT_MS) { alert('La pantalla de sorteo no está conectada.'); return; }
    CanalSorteo.enviar({ tipo: 'iniciar-sorteo' });
    btnPremio.disabled = true;
    btnIniciarSorteo.disabled = true;
}

CanalSorteo.escuchar((mensaje) => {
    if (!mensaje || !mensaje.tipo) return;
    switch (mensaje.tipo) {
        case 'latido':
            ultimoLatido = Date.now();
            estadoSorteoRemoto = mensaje.estado || 'listo';
            break;
        case 'sorteo-iniciado':
            estadoSorteoRemoto = 'girando';
            btnIniciarSorteo.disabled = true;
            btnPremio.disabled = true;
            break;
        case 'sorteo-terminado':
            estadoSorteoRemoto = 'listo';
            btnPremio.disabled = false;
            btnIniciarSorteo.disabled = false;
            break;
        case 'premio-entregado':
            btnPremio.disabled = true;
            break;
    }
    actualizarStatusPantalla();
});

setInterval(actualizarStatusPantalla, 1000);

const guardarDatos = () => {
    const data = {
        mesas: todasLasMesas,
        colores21: coloresRuleta21,
        colores22: coloresRuleta22, // Guardado por separado
        colores23: coloresRuleta23, // Guardado por separado
        colorMap: colorMap,
        montoPremio: parseInt(inputMontoPremio.value, 10) || 0,
        duracionMesa: parseFloat(inputDuracionMesa.value) || defaultData.duracionMesa,
        duracionGanador: parseFloat(inputDuracionGanador.value) || defaultData.duracionGanador,
        confetiActivado: inputConfetiActivado.checked,
        mensajeEstadoActivado: inputMensajeActivado.checked,
        fuegosArtificialesActivado: inputFuegosActivado.checked,
        confetiExplosivoActivado: inputConfetiExplosivoActivado.checked,
        temaSorteo: (document.querySelector('input[name="tema-sorteo"]:checked') || {}).value || defaultData.temaSorteo,
        checkedMesas: Array.from(document.querySelectorAll('input[name="mesas-en-juego"]:checked')).map(cb => cb.value),
        checkedColores21: Array.from(document.querySelectorAll('input[name="colores-ruleta-21"]:checked')).map(cb => cb.value),
        checkedColores22: Array.from(document.querySelectorAll('input[name="colores-ruleta-22"]:checked')).map(cb => cb.value),
        checkedColores23: Array.from(document.querySelectorAll('input[name="colores-ruleta-23"]:checked')).map(cb => cb.value),
    };
    localStorage.setItem('mesasMillonariasData', JSON.stringify(data));
    CanalSorteo.enviar({ tipo: 'config-actualizada', datos: data });
    alert('¡Configuración guardada y sincronizada!');
};

const cargarDatos = () => {
    const storedData = localStorage.getItem('mesasMillonariasData');
    const data = storedData ? JSON.parse(storedData) : defaultData;
    todasLasMesas = data.mesas || defaultData.mesas;
    coloresRuleta21 = data.colores21 || defaultData.colores21;
    coloresRuleta22 = data.colores22 || defaultData.colores22;
    coloresRuleta23 = data.colores23 || defaultData.colores23;
    colorMap = data.colorMap || defaultData.colorMap;
    montoPremio = (data.montoPremio !== undefined && data.montoPremio !== null) ? data.montoPremio : defaultData.montoPremio;
    inputMontoPremio.value = montoPremio;
    inputDuracionMesa.value = (data.duracionMesa !== undefined && data.duracionMesa !== null) ? data.duracionMesa : defaultData.duracionMesa;
    inputDuracionGanador.value = (data.duracionGanador !== undefined && data.duracionGanador !== null) ? data.duracionGanador : defaultData.duracionGanador;
    inputConfetiActivado.checked = (data.confetiActivado !== undefined && data.confetiActivado !== null) ? !!data.confetiActivado : defaultData.confetiActivado;
    inputMensajeActivado.checked = (data.mensajeEstadoActivado !== undefined && data.mensajeEstadoActivado !== null) ? !!data.mensajeEstadoActivado : defaultData.mensajeEstadoActivado;
    inputFuegosActivado.checked = (data.fuegosArtificialesActivado !== undefined && data.fuegosArtificialesActivado !== null) ? !!data.fuegosArtificialesActivado : defaultData.fuegosArtificialesActivado;
    inputConfetiExplosivoActivado.checked = (data.confetiExplosivoActivado !== undefined && data.confetiExplosivoActivado !== null) ? !!data.confetiExplosivoActivado : defaultData.confetiExplosivoActivado;
    const temaGuardado = data.temaSorteo || defaultData.temaSorteo;
    inputsTemaSorteo.forEach((input) => { input.checked = (input.value === temaGuardado); });
    actualizarPreviewMonto();
};

// Ojo: solo se resetean los checkboxes de las listas dinámicas (mesas y
// colores). Los checkboxes de efectos (confeti, mensaje, fuegos, etc.) ya
// los deja correctos cargarDatos() y no deben tocarse aquí.
const SELECTOR_CHECKBOXES_LISTAS = 'input[name="mesas-en-juego"], input[name="colores-ruleta-21"], input[name="colores-ruleta-22"], input[name="colores-ruleta-23"]';
const aplicarSeleccionesGuardadas = () => {
    const storedData = localStorage.getItem('mesasMillonariasData');
    document.querySelectorAll(SELECTOR_CHECKBOXES_LISTAS).forEach(cb => cb.checked = false);
    if (storedData) {
        const data = JSON.parse(storedData);
        (data.checkedMesas || []).forEach(val => { const cb = document.querySelector(`input[name="mesas-en-juego"][value="${val}"]`); if (cb) cb.checked = true; });
        (data.checkedColores21 || []).forEach(val => { const cb = document.querySelector(`input[name="colores-ruleta-21"][value="${val}"]`); if (cb) cb.checked = true; });
        (data.checkedColores22 || []).forEach(val => { const cb = document.querySelector(`input[name="colores-ruleta-22"][value="${val}"]`); if (cb) cb.checked = true; });
        (data.checkedColores23 || []).forEach(val => { const cb = document.querySelector(`input[name="colores-ruleta-23"][value="${val}"]`); if (cb) cb.checked = true; });
    } else {
         document.querySelectorAll(SELECTOR_CHECKBOXES_LISTAS).forEach(cb => cb.checked = true);
    }
};

const formatColorName = (name) => { if (typeof name !== 'string') return ''; return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-'); };
const crearCheckbox = (name, value) => { const li = document.createElement('li'); const label = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = name; checkbox.value = value; label.textContent = value; if (name.includes('colores')) { const hexColor = colorMap[formatColorName(value)] || '#ECF0F1'; label.style.color = hexColor; label.style.textShadow = '0 0 3px rgba(0,0,0,0.7)'; } const btnEliminar = document.createElement('button'); btnEliminar.className = 'btn-eliminar'; btnEliminar.innerHTML = '&#x2715;'; btnEliminar.title = `Eliminar "${value}"`; btnEliminar.onclick = (e) => { e.stopPropagation(); e.preventDefault(); eliminarOpcion(name, value); }; label.prepend(checkbox); li.appendChild(label); li.appendChild(btnEliminar); return li; };
const generarSelectores = (listId, dataArray, checkboxName) => { const listaElement = document.getElementById(listId); listaElement.innerHTML = ''; dataArray.forEach(item => listaElement.appendChild(crearCheckbox(checkboxName, item))); };
const toggleCheckboxes = (name, checked) => { document.querySelectorAll(`input[name="${name}"]`).forEach(cb => { cb.checked = checked; }); };

const eliminarOpcion = (name, value) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${value}" permanentemente?`)) return;
    let arrayToUpdate, listId;
    if (name === 'mesas-en-juego') { arrayToUpdate = todasLasMesas; listId = 'lista-mesas-juego'; }
    else if (name === 'colores-ruleta-21') { arrayToUpdate = coloresRuleta21; listId = 'lista-colores-21'; }
    else if (name === 'colores-ruleta-22') { arrayToUpdate = coloresRuleta22; listId = 'lista-colores-22'; }
    else if (name === 'colores-ruleta-23') { arrayToUpdate = coloresRuleta23; listId = 'lista-colores-23'; }

    if (arrayToUpdate) {
        const index = arrayToUpdate.indexOf(value);
        if (index > -1) arrayToUpdate.splice(index, 1);
        generarSelectores(listId, arrayToUpdate, name);
    }
};

const agregarOpcion = (listId, checkboxName, dataArray, nombreInputId, hexInputId) => {
    const nombreInputElement = document.getElementById(nombreInputId);
    const newValue = nombreInputElement.value.trim();
    if (!newValue) { alert('Por favor, ingresa un valor.'); return; }
    const formattedValue = newValue.charAt(0).toUpperCase() + newValue.slice(1);

    if (dataArray.find(item => item.toLowerCase() === formattedValue.toLowerCase())) {
        alert(`"${formattedValue}" ya existe.`); return;
    }
    if (hexInputId) {
        const hexValue = document.getElementById(hexInputId).value;
        colorMap[formatColorName(formattedValue)] = hexValue;
    }
    dataArray.push(formattedValue);
    generarSelectores(listId, dataArray, checkboxName);
    nombreInputElement.value = '';
};

// --- Event Listeners ---
btnLanzar.addEventListener('click', lanzarPantallaSorteo);
btnPremio.addEventListener('click', entregarPremio);
btnIniciarSorteo.addEventListener('click', iniciarSorteoRemoto);
document.getElementById('btn-guardar').addEventListener('click', guardarDatos);
document.getElementById('btn-agregar-mesa').addEventListener('click', () => agregarOpcion('lista-mesas-juego', 'mesas-en-juego', todasLasMesas, 'nueva-mesa-input'));
document.getElementById('btn-agregar-color-21').addEventListener('click', () => agregarOpcion('lista-colores-21', 'colores-ruleta-21', coloresRuleta21, 'nuevo-color-nombre-21-input', 'nuevo-color-hex-21-input'));
document.getElementById('btn-agregar-color-22').addEventListener('click', () => agregarOpcion('lista-colores-22', 'colores-ruleta-22', coloresRuleta22, 'nuevo-color-nombre-22-input', 'nuevo-color-hex-22-input'));
document.getElementById('btn-agregar-color-23').addEventListener('click', () => agregarOpcion('lista-colores-23', 'colores-ruleta-23', coloresRuleta23, 'nuevo-color-nombre-23-input', 'nuevo-color-hex-23-input'));
inputMontoPremio.addEventListener('input', actualizarPreviewMonto);
btnSyncRemotaAvanzado.addEventListener('click', editarUrlRemotaAvanzado);

document.addEventListener('DOMContentLoaded', () => {
    cargarDatos();
    generarSelectores('lista-mesas-juego', todasLasMesas, 'mesas-en-juego');
    generarSelectores('lista-colores-21', coloresRuleta21, 'colores-ruleta-21');
    generarSelectores('lista-colores-22', coloresRuleta22, 'colores-ruleta-22');
    generarSelectores('lista-colores-23', coloresRuleta23, 'colores-ruleta-23');
    aplicarSeleccionesGuardadas();
    actualizarStatusPantalla();
});

// --- Ayuda contextual ("?") y Manual de Uso ---
// Textos pensados para alguien que nunca ha usado el sistema: explican qué
// hace cada control y qué esperar en pantalla, sin tecnicismos.
const TEXTOS_AYUDA = {
    'control-pantalla': {
        titulo: 'Control de Pantalla de Sorteo',
        texto: '<p><strong>Lanzar Pantalla</strong> abre la Pantalla de Sorteo: la ventana que debes mostrar en el TV o monitor que ven los clientes.</p>' +
            '<p>El indicador <strong>Conectado / Desconectado</strong> te dice si esa pantalla está abierta y respondiendo. Si dice "Desconectado", ábrela de nuevo con "Lanzar Pantalla".</p>' +
            '<p><strong>▶️ Iniciar Sorteo</strong> hace girar las tómbolas (mesa y ganador) en la pantalla grande. Se activa solo cuando hay conexión.</p>' +
            '<p><strong>🎉 Entregar Premio</strong> se aprieta cuando el cliente ya retiró su premio: muestra un aviso de "premio entregado" y deja la pantalla lista para el próximo sorteo.</p>',
    },
    premio: {
        titulo: '💰 Premio',
        texto: '<p>Es el monto que se muestra en la Pantalla de Sorteo (por ejemplo, "100.000"). Cámbialo aquí antes de guardar si el premio del día es distinto.</p>',
    },
    duracion: {
        titulo: '⏱️ Duración de las tómbolas',
        texto: '<p>Controla cuántos segundos gira cada tómbola antes de detenerse: "Mesa" es la que elige la mesa ganadora, y "Ganador" es la que elige el color de ruleta o el puesto ganador.</p>' +
            '<p>Un valor más alto genera más suspenso; un valor más bajo hace el sorteo más rápido.</p>',
    },
    confeti: {
        titulo: '🎊 Confeti',
        texto: '<p>Cuando está activado, cae confeti en la pantalla en el momento en que se revela el ganador, como celebración. Desactívalo si prefieres una pantalla más sobria.</p>',
    },
    mensaje: {
        titulo: '💬 Mensaje',
        texto: '<p>Es el aviso de texto que aparece dentro de la Pantalla de Sorteo (por ejemplo "Girando la tómbola..." o "¡Tenemos ganador!"). Desactívalo si no quieres que se muestre ningún texto de estado ahí.</p>',
    },
    'efectos-tema23': {
        titulo: '🎆 Fuegos y 🎇 Confeti explosivo',
        texto: '<p>Son animaciones decorativas de fondo que aparecen solas, de vez en cuando, mientras la Pantalla de Sorteo está inactiva.</p>' +
            '<p><strong>Ojo:</strong> solo se ven cuando el tema elegido es "Tema 2" o "Tema 3". En el "Tema Original" no aparecen (ese tema ya tiene sus propias luces).</p>',
    },
    'sync-avanzado': {
        titulo: '🌐 Sincronización remota (avanzado)',
        texto: '<p>La sincronización entre este panel y la Pantalla de Sorteo ya viene conectada automáticamente: <strong>no necesitas tocar este botón para el uso normal</strong>.</p>' +
            '<p>Solo úsalo si un técnico te pide apuntar este dispositivo a otro servidor de sincronización distinto.</p>',
    },
    temas: {
        titulo: 'Tema de la Pantalla de Sorteo',
        texto: '<p>Elige el fondo visual que se muestra en la pantalla grande: Original, Tema 2 o Tema 3. Haz clic en la imagen que prefieras y luego aprieta "Guardar y Sincronizar".</p>',
    },
    'mesas-en-juego': {
        titulo: 'Mesas en juego',
        texto: '<p>Aquí marcas qué mesas pueden salir sorteadas hoy. Solo las mesas marcadas participan; las desmarcadas se ignoran.</p>' +
            '<p>Puedes agregar una mesa nueva escribiendo su nombre abajo y apretando "Agregar", o eliminar una existente con la ✕ que aparece al pasar el mouse o el dedo sobre ella.</p>',
    },
    'colores-ruletas': {
        titulo: 'Colores de Ruletas',
        texto: '<p>Cada grupo de mesas de ruleta (21-24-25, 22 y 23) tiene su propia lista de colores posibles. Cuando el sorteo elige una de esas mesas, el color ganador se sortea solo entre los colores marcados de su grupo.</p>' +
            '<p>Marca o desmarca colores, o agrega uno nuevo con su nombre y su color exacto usando el selector de color.</p>',
    },
    guardar: {
        titulo: 'Guardar y Sincronizar',
        texto: '<p><strong>Ningún cambio que hagas en este panel se aplica hasta que aprietes este botón.</strong> Úsalo siempre después de modificar mesas, colores, premio, tiempos, efectos o el tema.</p>',
    },
};

const modalAyuda = document.getElementById('modal-ayuda');
const modalAyudaTitulo = document.getElementById('modal-ayuda-titulo');
const modalAyudaTexto = document.getElementById('modal-ayuda-texto');
const modalManual = document.getElementById('modal-manual');

const mostrarAyuda = (clave) => {
    const contenido = TEXTOS_AYUDA[clave];
    if (!contenido) return;
    modalAyudaTitulo.textContent = contenido.titulo;
    modalAyudaTexto.innerHTML = contenido.texto;
    modalAyuda.classList.add('visible');
};
const cerrarModales = () => {
    modalAyuda.classList.remove('visible');
    modalManual.classList.remove('visible');
};

document.querySelectorAll('.btn-ayuda').forEach((boton) => {
    boton.addEventListener('click', (e) => {
        // Varios botones "?" viven dentro de un <summary>: sin esto, el
        // clic también abriría/cerraría esa sección de golpe.
        e.preventDefault();
        e.stopPropagation();
        mostrarAyuda(boton.dataset.ayuda);
    });
});
document.getElementById('btn-manual').addEventListener('click', () => modalManual.classList.add('visible'));
document.getElementById('modal-ayuda-cerrar').addEventListener('click', () => modalAyuda.classList.remove('visible'));
document.getElementById('modal-manual-cerrar').addEventListener('click', () => modalManual.classList.remove('visible'));
[modalAyuda, modalManual].forEach((overlay) => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('visible'); });
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModales(); });
