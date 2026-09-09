/**
 * Canal de comunicación entre el Panel de Control (index.html)
 * y la Pantalla de Sorteo (sorteo.html).
 *
 * Tiene dos capas, activas al mismo tiempo:
 *
 * 1) Local (mismo navegador): BroadcastChannel, con respaldo por
 *    localStorage para navegadores que no lo soporten. Instantáneo, pero
 *    solo funciona entre pestañas/ventanas del mismo dispositivo.
 *
 * 2) Remota (otros dispositivos, ej. una tablet controlando el
 *    computador con la pantalla de sorteo): un backend de Google Apps
 *    Script (ver /google-apps-script/Codigo.gs) al que se le hace POST
 *    para guardar cambios y GET (sondeo periódico) para detectarlos.
 *    Es opcional: si no se configura ninguna URL remota, todo sigue
 *    funcionando igual que antes, solo en local.
 */
(function (global) {
    const NOMBRE_CANAL = 'mesas-millonarias-canal';
    const CLAVE_RESPALDO = 'mesasMillonariasSenal';
    const CLAVE_URL_REMOTA = 'mesasMillonariasUrlRemota';
    const INTERVALO_POLL_MS = 3000;
    const INTERVALO_MIN_LATIDO_REMOTO_MS = 4000;

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

    function enviarLocal(mensaje) {
        const payload = Object.assign({ _ts: Date.now() }, mensaje);
        if (canal) {
            try { canal.postMessage(payload); } catch (e) { /* ignorar */ }
        }
        try {
            localStorage.setItem(CLAVE_RESPALDO, JSON.stringify(payload));
        } catch (e) { /* ignorar */ }
    }

    // --- Capa remota (Google Apps Script), opcional ---

    function obtenerUrlRemota() {
        try { return (localStorage.getItem(CLAVE_URL_REMOTA) || '').trim(); } catch (e) { return ''; }
    }

    function configurarUrlRemota(url) {
        try {
            const limpia = (url || '').trim();
            if (limpia) localStorage.setItem(CLAVE_URL_REMOTA, limpia);
            else localStorage.removeItem(CLAVE_URL_REMOTA);
        } catch (e) { /* ignorar */ }
        reiniciarPolling();
    }

    let ultimasRevisiones = { config: 0, comando: 0, estado: 0 };
    let primerPoll = true;
    let pollTimer = null;
    let ultimoEnvioRemotoLatido = 0;

    async function poll() {
        const url = obtenerUrlRemota();
        if (!url) return;
        try {
            const resp = await fetch(url, { cache: 'no-store' });
            const data = await resp.json();
            ['config', 'comando', 'estado'].forEach((campo) => {
                const valor = data && data[campo];
                const rev = (valor && valor._rev) || 0;
                if (!rev || rev === ultimasRevisiones[campo]) return;
                const esPrimerPollDeEsteCampo = primerPoll;
                ultimasRevisiones[campo] = rev;
                // En el primer sondeo solo tomamos la config (para partir con la
                // última guardada); ignoramos comandos/estados viejos que hayan
                // quedado guardados de una sesión anterior, para no re-disparar
                // un sorteo o un estado obsoleto apenas se abre la página.
                if (esPrimerPollDeEsteCampo && campo !== 'config') return;
                const copia = Object.assign({}, valor);
                delete copia._rev;
                const mensaje = campo === 'config' ? { tipo: 'config-actualizada', datos: copia } : copia;
                if (mensaje && mensaje.tipo) notificar(mensaje);
            });
        } catch (e) { /* sin conexión o URL inválida: se reintenta en el próximo sondeo */ }
        primerPoll = false;
    }

    function reiniciarPolling() {
        if (pollTimer) clearInterval(pollTimer);
        ultimasRevisiones = { config: 0, comando: 0, estado: 0 };
        primerPoll = true;
        const url = obtenerUrlRemota();
        if (url) {
            poll();
            pollTimer = setInterval(poll, INTERVALO_POLL_MS);
        }
    }

    function enviarRemoto(campo, valor) {
        const url = obtenerUrlRemota();
        if (!url) return;
        // Sin cabecera Content-Type explícita a propósito: así el navegador la
        // envía como "text/plain" y evita el preflight CORS que Apps Script
        // no puede responder. doPost igual lo parsea como JSON.
        fetch(url, { method: 'POST', body: JSON.stringify({ campo, valor }) }).catch(() => { /* ignorar */ });
    }

    function enviar(mensaje) {
        enviarLocal(mensaje);
        if (!obtenerUrlRemota()) return;

        switch (mensaje.tipo) {
            case 'config-actualizada':
                enviarRemoto('config', mensaje.datos);
                break;
            case 'iniciar-sorteo':
            case 'entregar-premio':
                enviarRemoto('comando', mensaje);
                break;
            case 'latido': {
                const ahora = Date.now();
                if (ahora - ultimoEnvioRemotoLatido < INTERVALO_MIN_LATIDO_REMOTO_MS) return;
                ultimoEnvioRemotoLatido = ahora;
                enviarRemoto('estado', mensaje);
                break;
            }
            case 'sorteo-iniciado':
            case 'sorteo-terminado':
            case 'premio-entregado':
                enviarRemoto('estado', mensaje);
                break;
        }
    }

    function escuchar(callback) {
        listeners.push(callback);
    }

    reiniciarPolling();

    global.CanalSorteo = { enviar, escuchar, configurarUrlRemota, obtenerUrlRemota };
})(window);
