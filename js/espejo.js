// Espejo de la lista de espera de livecinemaes.com, fuera de Cloudflare: sirve cuando los bloqueos de LaLiga dejan sin acceso
// a la web principal. El alta va primero a nuestra API; si no responde en 4 s o falla, a la hoja de Google (mismos campos).
(function () {
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
