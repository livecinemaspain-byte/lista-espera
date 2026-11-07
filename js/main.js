/* Live Cinema Spain · comportamiento común (sin dependencias) */
(function () {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, s) { try { return (s ? sessionStorage : localStorage).getItem(k); } catch (e) { return null; } },
    set(k, v, s) { try { (s ? sessionStorage : localStorage).setItem(k, v); } catch (e) {} }
  };

  /* ---------------------------------------------------------
     Navegación interna sin recargar la página.
     El navegador de TikTok (y el de Instagram) bloquea abrir una página
     distinta a la del enlace de la biografía. Para que no haya bloqueo,
     los enlaces internos descargan la otra página con fetch, cambian el
     contenido y actualizan la dirección con history.pushState: para el
     navegador no hay navegación nueva. Si algo falla, se navega normal.
     --------------------------------------------------------- */
  // Rutas del <head> (icono, estilos) a absolutas: el <head> no se sustituye al cambiar de página
  $$('head link[href]').forEach(l => l.setAttribute('href', l.href));

  let cleanups = [];
  let busy = false;
  const canSwap = 'fetch' in window && 'pushState' in history && 'DOMParser' in window;

  // Misma página aunque cambie la forma de escribirla: /, /index.html, /legal/cookies, /legal/cookies.html
  const norm = path => path.replace(/\/index(\.html)?$/, '/').replace(/\.html$/, '');
  let current = norm(location.pathname) + location.search;

  // Enlace a otra página de esta web (no ancla, no externo, no descarga)
  function internalUrl(a) {
    if (!a || !a.getAttribute('href') || a.hasAttribute('download')) return null;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
    if (!/(\.html|\/|\/[^./]+)$/.test(url.pathname)) return null;  // también rutas limpias (/legal/cookies)
    if (/^\/(comprar|mis-entradas|panel|api)(\/|$)/.test(url.pathname)) return null;  // la venta es otra aplicación: carga completa
    return url;
  }

  function scrollToHash(hash) {
    const el = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = el ? el.getBoundingClientRect().top + window.scrollY - pad : 0;
    window.scrollTo({ top, behavior: 'instant' });
  }

  async function go(url, mode) {
    if (busy) return;
    busy = true;
    try {
      const res = await fetch(url.pathname + url.search, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      if (!doc.body || !doc.querySelector('main')) throw new Error('sin contenido');
      const final = new URL(res.url || url.href); final.hash = url.hash;  // Cloudflare redirige .html a la ruta limpia
      if (mode === 'push') history.pushState({ lcs: 1 }, '', final.href);
      else if (mode === 'replace') history.replaceState({ lcs: 1 }, '', final.href);
      current = norm(location.pathname) + location.search;
      cleanups.forEach(fn => fn()); cleanups = [];
      document.documentElement.classList.remove('menu-open');
      document.title = doc.title;
      const desc = $('meta[name="description"]'), newDesc = $('meta[name="description"]', doc);
      if (desc && newDesc) desc.setAttribute('content', newDesc.getAttribute('content'));
      document.body.className = doc.body.className;
      document.body.dataset.page = doc.body.dataset.page || '';
      document.body.dataset.estado = doc.body.dataset.estado || '';
      document.body.dataset.hasta = doc.body.dataset.hasta || '';
      document.body.dataset.ahora = doc.body.dataset.ahora || '';
      if (doc.documentElement.dataset.turnstile) document.documentElement.dataset.turnstile = doc.documentElement.dataset.turnstile;
      document.body.innerHTML = doc.body.innerHTML;  // los <script> insertados así no se ejecutan
      init();
      scrollToHash(url.hash);
      const main = $('#main');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
    } catch (err) {
      location.href = url.href;
    } finally {
      busy = false;
    }
  }

  if (canSwap) {
    history.replaceState({ lcs: 1 }, '', location.href);
    document.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest('a');
      const url = internalUrl(a);
      if (!url) return;
      e.preventDefault();
      if (norm(url.pathname) + url.search === current) {
        // Misma página: solo se desplaza, nunca recarga
        if (url.hash !== location.hash) history.pushState({ lcs: 1 }, '', url.hash || location.pathname + location.search);
        if (url.hash && url.hash.length > 1) {
          const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
          if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        }
        return;
      }
      go(url, 'push');
    });
    window.addEventListener('popstate', () => {
      const url = new URL(location.href);
      if (norm(url.pathname) + url.search === current) scrollToHash(url.hash);
      else go(url, 'none');
    });
  }

  // Enlaces antiguos de la landing (#privacidad, #lista...) → páginas o secciones nuevas
  if (document.body.dataset.page === 'home') {
    const legal = { '#aviso-legal': 'legal/aviso-legal.html', '#aviso': 'legal/aviso-legal.html',
      '#privacidad': 'legal/privacidad.html', '#cookies': 'legal/cookies.html' };
    const toNewsletter = ['#lista', '#espectaculo', '#estado', '#preguntas'];
    if (legal[location.hash]) {
      const url = new URL(legal[location.hash] + location.search, location.href);
      if (canSwap) go(url, 'replace'); else location.replace(url.href);
    } else if (toNewsletter.includes(location.hash)) {
      history.replaceState({ lcs: 1 }, '', location.pathname + location.search + '#lista-espera');
    }
  }

  // Escape cierra el menú (se registra una sola vez)
  document.addEventListener('keydown', e => {
    const btn = $('.menu-btn');
    if (e.key === 'Escape' && btn && btn.getAttribute('aria-expanded') === 'true') { btn.click(); btn.focus(); }
  });
  window.matchMedia('(min-width: 900px)').addEventListener('change', e => {
    const btn = $('.menu-btn');
    if (e.matches && btn && btn.getAttribute('aria-expanded') === 'true') btn.click();
  });

  // El aviso se recuerda 6 meses; pasados, se borra y se vuelve a enseñar
  const SEIS_MESES = 182 * 24 * 3600 * 1000;
  let cookieDismissed = Date.now() - Number(store.get('lcs_cookie_notice')) < SEIS_MESES;
  if (!cookieDismissed) { try { localStorage.removeItem('lcs_cookie_notice'); } catch (e) {} }

  /* Todo lo que depende del contenido de la página: se ejecuta al cargar y tras cada cambio */
  function init() {
    $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

    // Cabecera: sólida al hacer scroll
    const header = $('.site-header');
    if (header && document.body.classList.contains('has-overlay-header')) {
      const onScroll = () => header.classList.toggle('is-solid', window.scrollY > 24);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      cleanups.push(() => window.removeEventListener('scroll', onScroll));
    }

    // Menú móvil
    const menuBtn = $('.menu-btn'), mobileNav = $('#mobile-nav');
    if (menuBtn && mobileNav) {
      const setMenu = open => {
        document.documentElement.classList.toggle('menu-open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
        mobileNav.toggleAttribute('inert', !open);
        if (open) { const first = $('a', mobileNav); first && first.focus(); }
      };
      mobileNav.setAttribute('inert', '');
      menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
      $$('a', mobileNav).forEach(a => a.addEventListener('click', () => setMenu(false)));
    }

    // Vídeo de portada opcional
    const heroMedia = $('[data-hero-video]');
    if (heroMedia && typeof CONFIG !== 'undefined' && CONFIG.HERO_VIDEO && !reduceMotion) {
      const v = document.createElement('video');
      Object.assign(v, { muted: true, loop: true, autoplay: true, playsInline: true, preload: 'metadata' });
      v.setAttribute('aria-hidden', 'true');
      v.poster = $('img', heroMedia).getAttribute('src');
      v.src = CONFIG.HERO_VIDEO;
      v.addEventListener('canplay', () => { heroMedia.replaceChildren(v); v.play().catch(() => {}); }, { once: true });
      v.load();
    }

    // Animaciones de entrada
    const reveals = $$('.reveal');
    if (reveals.length && 'IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
      reveals.forEach(el => io.observe(el));
      cleanups.push(() => io.disconnect());
    } else {
      reveals.forEach(el => el.classList.add('is-in'));
    }

    initLista();
    initCambio();

    // Botón fijo en móvil de la ficha: aparece al pasar el hero y se oculta sobre el formulario
    const sticky = $('.sticky-cta'), heroCta = $('[data-hero-cta]'), formBox = $('#lista');
    if (sticky && heroCta && formBox && 'IntersectionObserver' in window) {
      let heroVisible = true, formVisible = false;
      const update = () => {
        const show = !heroVisible && !formVisible;
        sticky.classList.toggle('is-in', show);
        sticky.toggleAttribute('inert', !show);
      };
      const a = new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; update(); });
      const b = new IntersectionObserver(([en]) => { formVisible = en.isIntersecting; update(); });
      a.observe(heroCta); b.observe(formBox);
      cleanups.push(() => { a.disconnect(); b.disconnect(); });
      update();
    }

    // Aviso de cookies (informativo: la web no instala cookies)
    const cookie = $('#cookie');
    if (cookie && !cookieDismissed) {
      // Se muestra al empezar a bajar, para no tapar la primera pantalla
      const show = () => {
        if (cookieDismissed || !cookie.isConnected) return;
        window.removeEventListener('scroll', onFirstScroll);
        cookie.hidden = false;
        document.documentElement.style.setProperty('--cookie-h', cookie.offsetHeight + 'px');
        requestAnimationFrame(() => requestAnimationFrame(() => cookie.classList.add('is-in')));
      };
      const onFirstScroll = () => { if (window.scrollY > 200) show(); };
      window.addEventListener('scroll', onFirstScroll, { passive: true });
      cleanups.push(() => window.removeEventListener('scroll', onFirstScroll));
      onFirstScroll();
      $('button', cookie).addEventListener('click', () => {
        cookieDismissed = true;
        store.set('lcs_cookie_notice', String(Date.now()));
        cookie.classList.remove('is-in');
        setTimeout(() => { cookie.hidden = true; }, reduceMotion ? 0 : 400);
      });
    }
  }

  // Hora del servidor (data-ahora) frente a la del dispositivo: un reloj mal puesto no adelanta ni retrasa el cambio
  const desfase = () => { const s = Number(document.body.dataset.ahora); return s ? s - Date.now() : 0; };
  const llegoLaHora = () => { const h = Number(document.body.dataset.hasta); return h > 0 && Date.now() + desfase() >= h; };
  // Recarga para pasar al estado siguiente. En la vista previa con ?ahora= simulado, se recarga ya en la hora del cambio
  const recargar = () => {
    const u = new URL(location.href);
    if (u.searchParams.has('ahora')) { u.searchParams.set('ahora', document.body.dataset.hasta); location.replace(u.href); } else location.reload();
  };

  // Página abierta desde antes de la preventa o de la venta general: cambia sola a la hora de Madrid (la del servidor).
  // Repartido en 20 s para que no recarguen todas a la vez; si la ventana de la lista está abierta, espera a que se cierre.
  function initCambio() {
    const hasta = Number(document.body.dataset.hasta);
    if (!hasta || document.body.dataset.page !== 'home') return;
    const falta = hasta - (Date.now() + desfase());
    if (falta > 2 ** 31 - 1) return;
    const t = setTimeout(() => {
      const d = $('#lista-espera');
      if (d && d.open) d.addEventListener('close', recargar, { once: true }); else recargar();
    }, Math.max(0, falta) + Math.random() * 20000);
    cleanups.push(() => clearTimeout(t));
  }

  // Ventana de la lista de espera. El estado del botón lo pinta el servidor (worker/portada.js)
  function initLista() {
    const dialogo = $('#lista-espera'), form = $('#form-lista-espera');
    if (!dialogo || !form) return;
    const msg = $('#lista-msg'), hecho = $('#lista-hecho'), email = $('#lista-email');
    const comercial = $('#lista-comercial'), comercialSi = $('#lista-comercial-si'), comercialMsg = $('#lista-comercial-msg');
    const CLAVE = document.documentElement.dataset.turnstile || '';
    let widget = null, token = null, apuntado = '';
    const aviso = text => { msg.textContent = text; msg.className = text ? 'msg err' : 'msg'; };
    const dibujar = () => { widget = window.turnstile.render('#lista-turnstile', { sitekey: CLAVE, callback: t => { token = t; }, 'expired-callback': () => { token = null; } }); };
    const abrir = correo => {
      if (correo) email.value = correo;
      dialogo.showModal();
      if (!CLAVE || widget !== null) return;
      if (window.turnstile) return dibujar();
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.onload = dibujar;
      document.head.appendChild(s);
    };
    const alPulsar = e => {
      const a = e.target.closest && e.target.closest('.js-compra');
      if (!a || document.body.dataset.estado !== 'lista') return;
      e.preventDefault();
      e.stopPropagation();
      // Página abierta desde antes de la hora: se recarga para llevar a la preventa
      if (llegoLaHora()) { recargar(); return; }
      abrir();
    };
    document.addEventListener('click', alPulsar, true);
    cleanups.push(() => document.removeEventListener('click', alPulsar, true));
    $('.lista-cerrar').addEventListener('click', () => dialogo.close());

    // Enlaces antiguos y de las páginas legales: llegan con #lista-espera
    if (location.hash === '#lista-espera' && document.body.dataset.estado === 'lista') abrir();

    // Segundo clic, opcional y aparte del alta: el consentimiento comercial no es condición para entrar en la lista
    comercialSi.addEventListener('click', async () => {
      comercialSi.disabled = true; comercialMsg.textContent = ''; comercialMsg.className = 'msg';
      try {
        const r = await window.altaEspejo({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: apuntado, comercial: true, website: form.elements.website.value }) });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d || d.ok !== true) throw new Error(d?.message || 'No hemos podido guardarlo. Inténtalo de nuevo en un momento.');
        comercialSi.hidden = true; $('#lista-comercial-nota').hidden = true;
        comercialMsg.textContent = 'Hecho. Te avisaremos de futuros espectáculos.';
      } catch (err) {
        comercialMsg.textContent = err instanceof TypeError ? 'No se ha podido enviar. Comprueba tu conexión e inténtalo de nuevo.' : err.message;
        comercialMsg.className = 'msg err';
      } finally { comercialSi.disabled = false; }
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const correo = email.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) { aviso('Ese correo no parece válido. Revísalo y vuelve a intentarlo.'); email.setAttribute('aria-invalid', 'true'); email.focus(); return; }
      email.removeAttribute('aria-invalid');
      if (!form.elements.privacidad.checked) { aviso('Para apuntarte tienes que aceptar la política de privacidad.'); form.elements.privacidad.focus(); return; }
      if (CLAVE && !token) { aviso('Estamos comprobando que no eres un robot. Espera un momento y vuelve a intentarlo.'); return; }
      const boton = $('button[type=submit]', form), texto = boton.textContent;
      boton.disabled = true; boton.textContent = 'Enviando…'; aviso('');
      try {
        const r = await window.altaEspejo({ method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'x-turnstile': token } : {}) }, body: JSON.stringify({ email: correo, privacidad: true, website: form.elements.website.value }) });
        const d = await r.json().catch(() => null);
        // Solo se da por hecho si el servidor confirma que lo ha guardado
        if (!r.ok || !d || d.ok !== true) throw new Error(d?.message || 'No hemos podido guardar tu correo. Inténtalo de nuevo en un momento.');
        $('.lista-form').hidden = true; hecho.hidden = false; hecho.focus();
        apuntado = correo; comercial.hidden = false;
      } catch (err) {
        aviso(err instanceof TypeError ? 'No se ha podido enviar. Comprueba tu conexión e inténtalo de nuevo.' : err.message);
        if (window.turnstile && widget !== null) { window.turnstile.reset(widget); token = null; }
      } finally { boton.disabled = false; boton.textContent = texto; }
    });
  }

  init();
})();
