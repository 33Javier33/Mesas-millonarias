/**
 * Canal de comunicación entre el Panel de Control (index.html)
 * y la Pantalla de Sorteo (sorteo.html).
 *
 * Usa BroadcastChannel (comunicación instantánea entre pestañas/ventanas
 * del mismo navegador) con un respaldo por localStorage para navegadores
 * que no lo soporten. Así ambas pantallas quedan sincronizadas sin
 * depender de una referencia directa de ventana (window.opener), que se
 * pierde al recargar cualquiera de las dos páginas.
 */
(function (global) {
    const NOMBRE_CANAL = 'mesas-millonarias-canal';
    const CLAVE_RESPALDO = 'mesasMillonariasSenal';

    let canal = null;
    try {
        if ('BroadcastChannel' in global) {
            canal = new BroadcastChannel(NOMBRE_CANAL);
        }
    } catch (e) {
        canal = null;
    }

    const listeners = [];

    function notificar(mensaje) {
        listeners.forEach((cb) => {
            try { cb(mensaje); } catch (e) { console.error(e); }
        });
    }

    if (canal) {
        canal.onmessage = (ev) => notificar(ev.data);
    }

    global.addEventListener('storage', (ev) => {
        if (ev.key === CLAVE_RESPALDO && ev.newValue) {
            try { notificar(JSON.parse(ev.newValue)); } catch (e) { /* ignorar */ }
        }
    });

    function enviar(mensaje) {
        const payload = Object.assign({ _ts: Date.now() }, mensaje);
        if (canal) {
            try { canal.postMessage(payload); } catch (e) { /* ignorar */ }
        }
        try {
            localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(payload));
        } catch (e) { /* ignorar */ }
    }

    function escuchar(callback) {
        listeners.push(callback);
    }

    global.CanalSorteo = { enviar, escuchar };
})(window);
