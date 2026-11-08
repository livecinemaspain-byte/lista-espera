// Espejo de la lista de espera de livecinemaes.com, fuera de Cloudflare: sirve cuando los bloqueos de LaLiga dejan sin acceso
// a la web principal. El alta va primero a nuestra API; si no responde en 4 s o falla, a la hoja de Google (mismos campos).
(function () {
  // Cierre de la lista para la preventa (hora de este dispositivo): los textos de después, los mismos que la portada
  var CIERRE = {"hora":1794351599000,"boton":"Avísame de la venta general","titulo":"Avísame de la venta general","texto":"La preventa está cerrada. Apúntate y te avisamos cuando empiece la venta general, el jueves 12 a las 12:00.","hecho":"Ya estás apuntado. Te avisaremos el jueves 12 a las 11:00, antes de que empiece la venta general a las 12:00."};
  function cerrar() {
    if (Date.now() < CIERRE.hora) return;
    var html = function (t) { var d = document.createElement('textarea'); d.innerHTML = t; return d.value; };
    document.querySelectorAll('.js-compra').forEach(function (b) { if (b.classList.contains('btn')) b.textContent = html(CIERRE.boton); });
    var t = document.getElementById('lista-titulo'); if (t) { t.textContent = html(CIERRE.titulo); t.classList.remove('sr-only'); }
    var x = document.getElementById('lista-texto'); if (x) x.textContent = html(CIERRE.texto);
    var h = document.getElementById('lista-hecho'); if (h) h.textContent = html(CIERRE.hecho);
    var p = document.querySelector('.lista-pasos'); if (p) p.remove();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cerrar); else cerrar();
  var falta = CIERRE.hora - Date.now();
  if (falta > 0 && falta < 7 * 864e5) setTimeout(cerrar, falta + 500);
  var API = 'https://livecinemaes.com/api/lista-espera';
  var HOJA = 'https://script.google.com/macros/s/AKfycbweH-u8w_-gcd7bsd4-wzSF4QHB8P5gO64vhpc34qfuaMdrnEzDkDDZ28PrxVexuoAMGg/exec';
  function plazo(ms) { var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal; }
  function respuesta(o) { return new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } }); }
  window.altaEspejo = async function (opciones) {
    var cuerpo = {};
    try { cuerpo = JSON.parse(opciones.body); } catch (e) { /* vacío */ }
    try {
      var r = await fetch(API, Object.assign({}, opciones, { signal: plazo(4000) }));
      var d = await r.clone().json().catch(function () { return null; });
      if (r.ok && d && d.ok === true) return r;
    } catch (e) { /* bloqueada, lenta o sin permiso desde aquí: a la hoja */ }
    if (cuerpo.website) return respuesta({ ok: true }); // trampa para robots: no se guarda
    var datos = new URLSearchParams({ email: cuerpo.email || '', ciudad: '', personas: '', website: '', utm_source: 'espejo', utm_campaign: cuerpo.comercial ? 'comercial: sí' : '', ref: location.host, consent: '1' });
    var h = await fetch(HOJA, { method: 'POST', body: datos, signal: plazo(15000) });
    var j = await h.json().catch(function () { return null; });
    return respuesta(j && j.ok === true ? { ok: true } : { ok: false, message: 'No hemos podido guardar tu correo. Inténtalo de nuevo en un momento.' });
  };
})();
