/**
 * Backend remoto para Mesas Millonarias (Google Apps Script).
 *
 * Permite sincronizar el Panel de Control (ej. desde una tablet) con la
 * Pantalla de Sorteo (ej. en un computador) a través de internet, sin
 * necesidad de que ambos dispositivos estén en el mismo navegador.
 *
 * Guarda tres cosas en las Propiedades del script:
 *   - "config":  la configuración completa (mesas, colores, monto, temas, etc.)
 *   - "comando": la última orden enviada desde el panel (iniciar sorteo, entregar premio)
 *   - "estado":  el último estado reportado por la pantalla de sorteo (latido, resultado)
 *
 * Cada valor guardado lleva un campo _rev (timestamp) para que quien
 * consulta (doGet) pueda detectar si cambió desde la última vez que miró,
 * sin tener que comparar el contenido completo.
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

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const data = {
    config: parseOrNull_(props.getProperty('config')),
    comando: parseOrNull_(props.getProperty('comando')),
    estado: parseOrNull_(props.getProperty('estado')),
  };
  return responderJSON_(data);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    const campo = body.campo;
    if (['config', 'comando', 'estado'].indexOf(campo) === -1) {
      return responderJSON_({ ok: false, error: 'campo inválido' });
    }
    const valor = body.valor || {};
    valor._rev = Date.now();
    PropertiesService.getScriptProperties().setProperty(campo, JSON.stringify(valor));
    return responderJSON_({ ok: true, rev: valor._rev });
  } catch (err) {
    return responderJSON_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
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
