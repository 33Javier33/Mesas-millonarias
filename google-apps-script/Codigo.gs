/**
 * Backend remoto para Mesas Millonarias (Google Apps Script).
 *
 * Permite sincronizar el Panel de Control (ej. desde una tablet) con la
 * Pantalla de Sorteo (ej. en un computador) a través de internet, sin
 * necesidad de que ambos dispositivos estén en el mismo navegador.
 *
 * Guarda en las Propiedades del script:
 *   - "config":  la configuración completa (mesas, colores, monto, temas, etc.)
 *   - "comando": la última orden enviada desde el panel (iniciar sorteo, entregar premio)
 *   - "estado":  el último estado reportado por la pantalla de sorteo (latido, resultado)
 *   - "pin":     el PIN del panel. NUNCA se entrega en doGet: solo se compara aquí.
 *   - "sesiones", "intentosFallidos", "bloqueadoHasta": control de acceso (ver abajo).
 *
 * Cada valor guardado lleva un campo _rev (timestamp) para que quien
 * consulta (doGet) pueda detectar si cambió desde la última vez que miró,
 * sin tener que comparar el contenido completo.
 *
 * --- Seguridad ---
 * La URL de este script está escrita en canal.js, que es público, así que
 * cualquiera puede llamarla. Por eso:
 *   - Leer (doGet) es libre, pero nunca devuelve el PIN.
 *   - Cambiar "config" o enviar un "comando" exige una sesión válida, que
 *     solo se obtiene con el PIN correcto (accion "login").
 *   - "estado" lo escribe la Pantalla de Sorteo, que no tiene PIN; se acepta
 *     sin sesión pero solo con los tipos y campos conocidos.
 *   - Tras MAX_INTENTOS_FALLIDOS PIN incorrectos seguidos, el login queda
 *     bloqueado MINUTOS_BLOQUEO minutos, para que no se pueda adivinar el PIN
 *     probando las 10.000 combinaciones. Las sesiones ya abiertas siguen
 *     funcionando durante el bloqueo.
 *
 * --- Cómo publicarlo ---
 * 1. Ir a https://script.google.com/ e iniciar sesión con tu cuenta de Google.
 * 2. Crear un "Nuevo proyecto".
 * 3. Borrar el código de ejemplo que trae y pegar TODO este archivo.
 * 4. Guardar el proyecto (por ejemplo, con el nombre "Mesas Millonarias Backend").
 * 5. Ir a "Implementar" (Deploy) > "Nueva implementación" (New deployment).
 *    - Tipo: "Aplicación web" (Web app).
 *    - Descripción: la que quieras.
 *    - Ejecutar como: "Yo" (tu cuenta).
 *    - Quién tiene acceso: "Cualquier usuario" (Anyone).
 * 6. Al implementar, Google pedirá autorizar permisos: acéptalos (es tu propio script).
 * 7. Copiar la URL que termina en ".../exec" — esa es la URL de sincronización
 *    remota que hay que pegar en el Panel de Control (index.html) y en la
 *    Pantalla de Sorteo (sorteo.html, botón ⚙ en la esquina).
 *
 * Si alguna vez necesitas cambiar este código, hay que volver a
 * "Implementar > Gestionar implementaciones > editar (lápiz) > Nueva versión"
 * para que los cambios queden en la misma URL.
 */

const PIN_PREDETERMINADO = '2026';
const MAX_INTENTOS_FALLIDOS = 10;
const MINUTOS_BLOQUEO = 15;
const HORAS_SESION = 24;
const MAX_SESIONES = 20;
const TIPOS_COMANDO = ['iniciar-sorteo', 'entregar-premio'];
const TIPOS_ESTADO = ['latido', 'sorteo-iniciado', 'sorteo-terminado', 'premio-entregado'];

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const config = parseOrNull_(props.getProperty('config'));
  if (config) delete config.panelPin; // configuraciones viejas lo traían adentro
  const data = {
    config: config,
    comando: parseOrNull_(props.getProperty('comando')),
    estado: parseOrNull_(props.getProperty('estado')),
  };
  return responderJSON_(data);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    migrarPin_(props);
    const body = JSON.parse(e.postData.contents);

    if (body.accion === 'login') return responderJSON_(login_(props, body.pin));
    if (body.accion === 'cambiar-pin') return responderJSON_(cambiarPin_(props, body.sesion, body.nuevoPin));

    const campo = body.campo;
    let valor;
    if (campo === 'estado') {
      valor = limpiarEstado_(body.valor);
      if (!valor) return responderJSON_({ ok: false, error: 'estado inválido' });
    } else if (campo === 'config' || campo === 'comando') {
      if (!sesionValida_(props, body.sesion)) return responderJSON_({ ok: false, error: 'sesion-invalida' });
      valor = body.valor || {};
      if (campo === 'config') delete valor.panelPin;
      if (campo === 'comando' && TIPOS_COMANDO.indexOf(valor.tipo) === -1) {
        return responderJSON_({ ok: false, error: 'comando inválido' });
      }
    } else {
      return responderJSON_({ ok: false, error: 'campo inválido' });
    }
    valor._rev = Date.now();
    props.setProperty(campo, JSON.stringify(valor));
    return responderJSON_({ ok: true, rev: valor._rev });
  } catch (err) {
    return responderJSON_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Antes el PIN se guardaba dentro de "config" (y se entregaba a cualquiera
// en doGet). La primera vez que corre esta versión lo mueve a su propia
// propiedad, conservando el PIN que ya estuviera configurado.
function migrarPin_(props) {
  if (props.getProperty('pin')) return;
  const config = parseOrNull_(props.getProperty('config'));
  const pinViejo = config && config.panelPin ? String(config.panelPin) : PIN_PREDETERMINADO;
  props.setProperty('pin', pinViejo);
  if (config && config.panelPin !== undefined) {
    delete config.panelPin;
    props.setProperty('config', JSON.stringify(config));
  }
}

function login_(props, pin) {
  const ahora = Date.now();
  const bloqueadoHasta = Number(props.getProperty('bloqueadoHasta')) || 0;
  if (ahora < bloqueadoHasta) return { ok: false, error: 'bloqueado', bloqueadoHasta: bloqueadoHasta };

  if (String(pin || '') !== props.getProperty('pin')) {
    const intentos = (Number(props.getProperty('intentosFallidos')) || 0) + 1;
    if (intentos >= MAX_INTENTOS_FALLIDOS) {
      const hasta = ahora + MINUTOS_BLOQUEO * 60 * 1000;
      props.setProperty('bloqueadoHasta', String(hasta));
      props.setProperty('intentosFallidos', '0');
      return { ok: false, error: 'bloqueado', bloqueadoHasta: hasta };
    }
    props.setProperty('intentosFallidos', String(intentos));
    return { ok: false, error: 'pin-incorrecto' };
  }

  props.setProperty('intentosFallidos', '0');
  return { ok: true, sesion: crearSesion_(props) };
}

function cambiarPin_(props, sesion, nuevoPin) {
  if (!sesionValida_(props, sesion)) return { ok: false, error: 'sesion-invalida' };
  if (!/^[0-9]{4}$/.test(String(nuevoPin || ''))) return { ok: false, error: 'pin-formato' };
  props.setProperty('pin', String(nuevoPin));
  // Cierra todas las demás sesiones: los otros dispositivos tendrán que
  // entrar con el PIN nuevo. Quien lo cambió conserva la suya.
  const sesiones = {};
  sesiones[sesion] = leerSesiones_(props)[sesion];
  props.setProperty('sesiones', JSON.stringify(sesiones));
  return { ok: true };
}

function crearSesion_(props) {
  const ahora = Date.now();
  const sesiones = leerSesiones_(props);
  Object.keys(sesiones).forEach(function (k) { if (sesiones[k] < ahora) delete sesiones[k]; });
  const claves = Object.keys(sesiones).sort(function (a, b) { return sesiones[a] - sesiones[b]; });
  while (claves.length >= MAX_SESIONES) delete sesiones[claves.shift()];
  const token = Utilities.getUuid() + Utilities.getUuid();
  sesiones[token] = ahora + HORAS_SESION * 60 * 60 * 1000;
  props.setProperty('sesiones', JSON.stringify(sesiones));
  return token;
}

function sesionValida_(props, sesion) {
  if (!sesion) return false;
  const vence = leerSesiones_(props)[sesion];
  return !!vence && vence > Date.now();
}

function leerSesiones_(props) {
  return parseOrNull_(props.getProperty('sesiones')) || {};
}

// La Pantalla de Sorteo escribe sin sesión, así que solo guardamos los
// campos que el panel realmente usa, y cortos.
function limpiarEstado_(valor) {
  if (!valor || TIPOS_ESTADO.indexOf(valor.tipo) === -1) return null;
  const limpio = { tipo: valor.tipo };
  ['estado', 'mesa', 'ganador'].forEach(function (k) {
    if (valor[k] !== undefined && valor[k] !== null) limpio[k] = String(valor[k]).slice(0, 100);
  });
  if (valor._ts) limpio._ts = Number(valor._ts) || 0;
  return limpio;
}

function parseOrNull_(texto) {
  if (!texto) return null;
  try {
    return JSON.parse(texto);
  } catch (e) {
    return null;
  }
}

function responderJSON_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
