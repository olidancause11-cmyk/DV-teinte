(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ===== Suivi : Meta Pixel (navigateur) + dataLayer ===== */
  function track(ev, params, opts) {
    try {
      if (typeof window.fbq === 'function') window.fbq('track', ev, params || {}, opts || {});
      (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: 'dv_' + ev }, params || {}));
      window.dispatchEvent(new CustomEvent('dv:track', { detail: { event: ev, params: params || {} } }));
    } catch (e) {}
  }
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function newEventId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  /* ===== En-tête, menu mobile, barre collante ===== */
  var header = $('[data-header]');
  var menuBtn = $('[data-menu-toggle]');
  var mobileNav = $('[data-mobile-nav]');
  var sticky = $('[data-sticky]');
  var mq = window.matchMedia('(max-width:1079px)');
  var state = { scrolled: false, pastHero: false, menuOpen: false, formVisible: false };

  function paintChrome() {
    header.classList.toggle('is-solid', state.scrolled || state.menuOpen);
    header.classList.toggle('is-line', state.scrolled);
    var showSticky = mq.matches && state.pastHero && !state.formVisible;
    sticky.classList.toggle('is-on', showSticky);
  }
  function setMenu(open) {
    state.menuOpen = open && mq.matches;
    mobileNav.hidden = !state.menuOpen;
    menuBtn.setAttribute('aria-expanded', String(state.menuOpen));
    paintChrome();
  }
  function onScroll() {
    var y = window.scrollY || 0;
    state.scrolled = y > 24;
    state.pastHero = y > 560;
    paintChrome();
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  menuBtn.addEventListener('click', function () { setMenu(!state.menuOpen); });
  $$('[data-menu-close]').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.menuOpen) setMenu(false); });
  var onMq = function () { if (!mq.matches) setMenu(false); else paintChrome(); };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
  onScroll();

  /* ===== Défilement fluide et rapide vers les ancres (tous les boutons « estimation » compris) ===== */
  (function () {
    var root = document.documentElement;
    var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    var raf = 0;
    var pageTop = function (el) { var t = 0; while (el) { t += el.offsetTop; el = el.offsetParent; } return t; };
    var stop = function () { if (raf) { cancelAnimationFrame(raf); raf = 0; root.style.scrollBehavior = ''; } };
    ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(function (t) { window.addEventListener(t, stop, { passive: true }); });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.getElementById(id.slice(1));
      if (!target) return;
      e.preventDefault();
      var margin = parseFloat(window.getComputedStyle(target).scrollMarginTop) || 0;
      var max = Math.max(0, root.scrollHeight - window.innerHeight);
      var to = Math.max(0, Math.min(pageTop(target) - margin, max));
      try { history.pushState(null, '', id); } catch (err) {}
      stop();
      var from = window.scrollY || window.pageYOffset || 0, d = to - from;
      if (reduce) { window.scrollTo(0, to); return; }
      if (Math.abs(d) < 2) return;
      var dur = Math.min(900, Math.max(550, Math.abs(d) * 0.16));   // rapide, même sur une longue distance
      var t0 = null;
      root.style.scrollBehavior = 'auto';
      var step = function (ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / dur);
        var ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // accélère puis ralentit en douceur
        window.scrollTo(0, from + d * ease);
        if (k < 1) raf = requestAnimationFrame(step); else { raf = 0; root.style.scrollBehavior = ''; }
      };
      raf = requestAnimationFrame(step);
    });
  })();

  /* ===== Carrousel d’avis ===== */
  var track$ = $('[data-rev-track]');
  if (track$) {
    var dots = $$('[data-rev-dots] button');
    var cards = Array.prototype.slice.call(track$.children);
    var revIdx = 0;
    var paintDots = function () { dots.forEach(function (d, i) { d.classList.toggle('is-on', i === revIdx); }); };
    var revGo = function (i) {
      var k = Math.max(0, Math.min(cards.length - 1, i));
      var c = cards[k];
      if (c) track$.scrollTo({ left: c.offsetLeft - track$.offsetLeft, behavior: 'smooth' });
    };
    track$.addEventListener('scroll', function () {
      var c = cards[0];
      if (!c) return;
      var w = c.offsetWidth + 16;
      var i = track$.scrollLeft + track$.clientWidth >= track$.scrollWidth - 4 ? cards.length - 1 : Math.round(track$.scrollLeft / w);
      if (i !== revIdx) { revIdx = i; paintDots(); }
    }, { passive: true });
    dots.forEach(function (d, i) { d.addEventListener('click', function () { revGo(i); }); });
    $('[data-rev-prev]').addEventListener('click', function () { revGo(revIdx - 1); });
    $('[data-rev-next]').addEventListener('click', function () { revGo(revIdx + 1); });
    paintDots();
  }

  /* ===== Avis : « Lire la suite » sur mobile (les mots des clients ne sont pas modifiés) ===== */
  if (track$) {
    var revMq = window.matchMedia('(max-width:1079px)');
    var revItems = $$('.rev-card', track$).map(function (card) {
      var q = $('blockquote', card);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rev-more';
      btn.hidden = true;
      btn.textContent = 'Lire la suite';
      btn.setAttribute('aria-expanded', 'false');
      q.insertAdjacentElement('afterend', btn);
      var item = { q: q, btn: btn, open: false };
      btn.addEventListener('click', function () {
        item.open = !item.open;
        q.classList.toggle('is-clamped', !item.open);
        btn.textContent = item.open ? 'Réduire' : 'Lire la suite';
        btn.setAttribute('aria-expanded', String(item.open));
      });
      return item;
    });
    var measureRev = function () {
      revItems.forEach(function (it) {
        if (!revMq.matches) { it.q.classList.remove('is-clamped'); it.btn.hidden = true; return; }
        it.q.classList.toggle('is-clamped', !it.open);
        // le bouton n'apparaît que si le texte dépasse réellement la zone repliée
        var overflow = it.open || it.q.scrollHeight > it.q.clientHeight + 2;
        it.btn.hidden = !overflow;
      });
    };
    var revTimer;
    window.addEventListener('resize', function () { clearTimeout(revTimer); revTimer = setTimeout(measureRev, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureRev);
    measureRev();
  }

  /* ===== Hero : léger effet de profondeur à la souris (ordinateur seulement, aucun lien avec le défilement) ===== */
  var heroEl = $('.hero');
  var motionOk = window.matchMedia('(prefers-reduced-motion:no-preference)').matches;
  var canMouse = window.matchMedia('(hover:hover) and (pointer:fine) and (min-width:1080px)').matches;
  if (heroEl && motionOk && canMouse) {
    var pImg = $('.hero-media img', heroEl);
    var tx = 0, ty = 0, cx = 0, cy = 0, pRaf = 0;
    var pFrame = function () {
      pRaf = 0;
      cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
      pImg.style.translate = (-cx * 6) + 'px ' + (-cy * 4) + 'px';
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) pRaf = requestAnimationFrame(pFrame);
    };
    var pKick = function () { if (!pRaf) pRaf = requestAnimationFrame(pFrame); };
    heroEl.addEventListener('mousemove', function (e) {
      var r = heroEl.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      pKick();
    }, { passive: true });
    heroEl.addEventListener('mouseleave', function () { tx = 0; ty = 0; pKick(); });
  }

  /* ===== Trouvez la bonne solution : choix du problème ===== */
  var soluTabs = $('[data-solu-tabs]');
  if (soluTabs) {
    var soluBtns = $$('[data-solu]', soluTabs);
    var showSolu = function (btn, focus) {
      soluBtns.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        var panel = $('#solu-panel-' + b.getAttribute('data-solu'));
        panel.hidden = !on;
        panel.classList.remove('solu-in');
        if (on) { void panel.offsetWidth; panel.classList.add('solu-in'); }
      });
      if (focus) btn.focus();
    };
    soluBtns.forEach(function (b, i) {
      b.addEventListener('click', function () { if (b.getAttribute('aria-selected') !== 'true') showSolu(b); });
      b.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        showSolu(soluBtns[(i + d + soluBtns.length) % soluBtns.length], true);
      });
    });
  }

  /* ===== Démonstration : onglets extérieur / intérieur / avec ou sans ===== */
  var demoTabs = $('[data-demo-tabs]');
  if (demoTabs) {
    var demoBtns = $$('[data-demo]', demoTabs);
    var demoCur = 'ext', demoTimer;
    var demoOrder = demoBtns.map(function (b) { return b.getAttribute('data-demo'); });
    var showDemo = function (btn, focus) {
      var key = btn.getAttribute('data-demo');
      if (key !== demoCur) {
        var prev = $('#demo-view-' + demoCur), next = $('#demo-view-' + key);
        var back = demoOrder.indexOf(key) < demoOrder.indexOf(demoCur);
        demoBtns.forEach(function (b) {
          var on = b === btn, k = b.getAttribute('data-demo');
          b.setAttribute('aria-selected', String(on));
          b.tabIndex = on ? 0 : -1;
          var view = $('#demo-view-' + k);
          view.classList.remove('is-prev', 'is-reveal', 'is-back');
          if (!on) view.classList.remove('is-on');
          view.setAttribute('aria-hidden', String(!on));
          $('[data-caption="' + k + '"]').classList.toggle('is-on', on);
        });
        // la nouvelle photo se révèle par-dessus l'ancienne (rideau + image qui se stabilise)
        prev.classList.add('is-prev');
        next.classList.add('is-on');
        if (back) next.classList.add('is-back');
        void next.offsetWidth;
        next.classList.add('is-reveal');
        clearTimeout(demoTimer);
        demoTimer = setTimeout(function () { prev.classList.remove('is-prev'); next.classList.remove('is-reveal', 'is-back'); }, 950);
        demoCur = key;
      }
      if (focus) btn.focus();
      return key;
    };
    demoBtns.forEach(function (b, i) {
      b.addEventListener('click', function () { showDemo(b); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        showDemo(demoBtns[(i + d + demoBtns.length) % demoBtns.length], true);
      });
    });
    // l'ancien lien « Avant / après » du menu ouvre directement la comparaison avec / sans
    $$('a[href="#realisations"]').forEach(function (a) {
      a.addEventListener('click', function () { showDemo($('[data-demo="cmp"]', demoTabs)); });
    });
  }

  /* ===== Section commerciale : apparition élégante au défilement (sans bloquer) ===== */
  var proSec = $('.pro');
  if (proSec) {
    if (window.matchMedia('(prefers-reduced-motion:no-preference)').matches && 'IntersectionObserver' in window) {
      proSec.setAttribute('data-pro', '');
      var proIO = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { proSec.classList.add('is-in'); proIO.disconnect(); }
      }, { threshold: 0.25 });
      proIO.observe(proSec);
    }
  }

  /* ===== Apparitions douces : une seule fois, courtes, sans mouvement lié au défilement ===== */
  (function () {
    if (!window.matchMedia('(prefers-reduced-motion:no-preference)').matches || !('IntersectionObserver' in window)) return;
    var groups = new Map();
    var add = function (sel, photo) {
      $$(sel).forEach(function (el) {
        if (el.hasAttribute('data-sc')) return;
        el.setAttribute('data-sc', photo ? 'photo' : 'rise');
        // léger échelonnement entre éléments voisins (max. 4 pas de 60 ms)
        var list = groups.get(el.parentNode) || [];
        el.style.setProperty('--d', Math.min(list.length, 4));
        list.push(el); groups.set(el.parentNode, list);
      });
    };
    add('.demo-title, .solu-title, .rev-head .h2, .trust-title, .proc-title, .est-sec .h2, .faq-in .h2, .final-title');
    add('.demo-head, .demo-tabs, .demo-captions, .demo-cta');
    add('.demo-frame', true);
    add('.solu-head, .solu-tabs, .solu-panels, .solu-cta');
    add('.rev-head, .rev-track, .rev-ctrl');
    add('.trust-sub, .trust-item, .trust-cta');
    add('.proc-sub, .proc-step, .proc-cta');
    add('.est-sec .stack-22 > *, .est-card');
    add('.faq-item');
    add('.final-p, .final .btn-blue');
    var els = $$('[data-sc]');
    if (!els.length) return;
    document.documentElement.classList.add('sc-on');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('sc-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ===== FAQ ===== */
  var faq = $('[data-faq]');
  if (faq) {
    var items = $$('.faq-item', faq);
    var setFaq = function (item, open) {
      var btn = $('button', item), p = $('p', item), icon = $('button span', item);
      btn.setAttribute('aria-expanded', String(open));
      p.hidden = !open;
      icon.textContent = open ? '−' : '+';
    };
    items.forEach(function (item) {
      $('button', item).addEventListener('click', function () {
        var wasOpen = $('button', item).getAttribute('aria-expanded') === 'true';
        items.forEach(function (o) { setFaq(o, false); });
        if (!wasOpen) setFaq(item, true);
      });
    });
  }

  /* ===== Formulaire d’estimation : une seule étape (prénom, nom, téléphone, courriel, message) ===== */
  var form = $('[data-est-form]');
  var section = $('[data-est-section]');
  if (!form) return;

  var KEY = 'dvteinte_estimation_v7';
  var est = {
    showErr: false, sending: false, submitted: false,
    projet: 'Résidentiel',   // devient « Commercial » seulement via le bouton de la section commerciale
    a: { prenom: '', nom: '', telephone: '', courriel: '', message: '' }
  };
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) est.a = Object.assign(est.a, JSON.parse(saved));
  } catch (e) {}

  var hpInput = $('[data-hp]', form);
  var submitBtn = $('[data-est-submit]', form);
  var card = $('#formulaire');
  var persist = function () { try { localStorage.setItem(KEY, JSON.stringify(est.a)); } catch (e) {} };
  var digits = function (v) { return (v || '').replace(/\D/g, ''); };
  var isCommercial = function () { return est.projet === 'Commercial'; };

  function errors() {
    var a = est.a, e = {};
    if (!a.prenom.trim()) e.prenom = true;
    if (!a.nom.trim()) e.nom = true;
    var d = digits(a.telephone);
    if (!(d.length === 10 || (d.length === 11 && d[0] === '1'))) e.telephone = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.courriel.trim())) e.courriel = true;
    return e;
  }

  function render() {
    var label = $('[data-est-label]', form);
    if (label) label.textContent = isCommercial() ? 'Soumission commerciale' : 'Demande d’estimation gratuite';
    var hid = $('[data-hidden="projet"]', form);
    if (hid) hid.value = est.projet;
    submitBtn.disabled = est.sending;
    submitBtn.textContent = est.sending ? 'Envoi…' : 'Demander mon estimation gratuite';
    var errs = est.showErr ? errors() : {};
    $$('[data-field]', form).forEach(function (inp) {
      var k = inp.getAttribute('data-field');
      inp.setAttribute('aria-invalid', String(!!errs[k]));
      var msg = $('[data-err="' + k + '"]', form);
      if (msg) msg.hidden = !errs[k];
    });
  }

  $$('[data-field]', form).forEach(function (inp) {
    inp.value = est.a[inp.getAttribute('data-field')] || '';
    inp.addEventListener('input', function () {
      est.a[inp.getAttribute('data-field')] = inp.value;
      persist();
      if (est.showErr) render();
    });
  });

  // les boutons du site vers le formulaire choisissent le type de demande : commercial seulement via le bouton commercial
  $$('a[href="#formulaire"]').forEach(function (a) {
    a.addEventListener('click', function () {
      est.projet = a.getAttribute('data-pick-projet') === 'Commercial' ? 'Commercial' : 'Résidentiel';
      render();
    });
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });

  /* ----- Envoi : FormSubmit (courriel) + Meta Pixel et API Conversions (Lead) ----- */
  function showSendError(on) { $('[data-send-err]', form).hidden = !on; }

  function submit() {
    if (est.sending || est.submitted) return;          // jamais deux envois (ni deux Lead)
    if (hpInput.value) { finish(); return; }          // robot : on fait semblant sans rien envoyer
    if (Object.keys(errors()).length) {
      est.showErr = true; render();
      var first = $('[aria-invalid="true"]', form);
      if (first) first.focus();
      return;
    }
    var a = est.a;
    var eventId = newEventId();
    est.sending = true; showSendError(false); render();

    var data = new FormData(form);
    data.set('prenom', a.prenom.trim());
    data.set('nom', a.nom.trim());
    data.set('message', a.message.trim().slice(0, 1500));
    if (!a.message.trim()) data.delete('message');
    data.set('type_de_projet', est.projet);
    data.set('source', isCommercial() ? 'landing-commercial' : 'landing-residentiel');
    if (isCommercial()) data.set('_subject', 'Nouvelle demande d’estimation COMMERCIALE — DV Teinte');
    data.set('page', location.href);
    data.set('date', new Date().toISOString());
    // références Meta, utiles pour qualifier le lead plus tard
    data.set('lead_event_id', eventId);
    var fbp = getCookie('_fbp'), fbc = getCookie('_fbc');
    if (fbp) data.set('fbp', fbp);
    if (fbc) data.set('fbc', fbc);

    // Livraison du courriel : FormSubmit d'abord, puis Web3Forms en secours si FormSubmit est en panne.
    deliver(data)
      .then(function () {
        trackLead(a, eventId, fbp, fbc);                // Lead : seulement après un envoi réussi
        try { localStorage.removeItem(KEY); } catch (e) {}
        finish();
      })
      .catch(function () {
        est.sending = false; render(); showSendError(true);
      });
  }

  function withTimeout(ms, run) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return run(ctrl ? ctrl.signal : undefined).then(
      function (v) { clearTimeout(timer); return v; },
      function (e) { clearTimeout(timer); throw e; }
    );
  }
  function readJson(res) {
    return res.text().then(function (text) {
      var json = null;
      try { json = JSON.parse(text); } catch (e) {}
      var ok = res.ok && json && (json.success === true || json.success === 'true');
      if (!ok) throw new Error(json && json.message ? json.message : 'bad response');
    });
  }
  function viaFormSubmit(data) {
    var url = form.getAttribute('action').replace('https://formsubmit.co/', 'https://formsubmit.co/ajax/');
    return withTimeout(7000, function (signal) {
      return fetch(url, { method: 'POST', headers: { 'Accept': 'application/json' }, body: data, signal: signal }).then(readJson);
    });
  }
  // Clé d'accès Web3Forms : publique par conception (elle sert côté navigateur), liée à l'adresse de réception.
  var WEB3FORMS_KEY = '4db52b51-8dac-4cd9-9f70-117dba6fbf82';
  function viaWeb3Forms(data) {
    var payload = { access_key: WEB3FORMS_KEY, subject: data.get('_subject') || 'Nouvelle demande d’estimation — DV Teinte', from_name: 'Site DV Teinte', botcheck: '' };
    data.forEach(function (value, key) {
      if (key.charAt(0) === '_') return;               // champs de configuration FormSubmit
      payload[key] = value;
    });
    payload.name = ((payload.prenom || '') + ' ' + (payload.nom || '')).trim();
    return withTimeout(10000, function (signal) {
      return fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload), signal: signal
      }).then(readJson);
    });
  }
  function deliver(data) {
    return viaFormSubmit(data).catch(function () { return viaWeb3Forms(data); });
  }

  function trackLead(a, eventId, fbp, fbc) {
    var commercial = isCommercial();
    var contentName = commercial ? 'Estimation commerciale' : 'Estimation résidentielle';
    var answers = { type_projet: est.projet };
    // même eventId côté navigateur et côté serveur : Meta dédoublonne (le message du client n'est jamais envoyé à Meta)
    track('Lead', Object.assign({ content_name: contentName, form_version: 'v7' }, answers), { eventID: eventId });
    try {
      fetch('/api/capi-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventId: eventId,
          eventSourceUrl: location.href,
          contentName: contentName,
          answers: answers,
          email: a.courriel.trim(),
          phone: a.telephone,
          firstName: a.prenom.trim(),
          lastName: a.nom.trim(),
          fbp: fbp,
          fbc: fbc
        })
      }).catch(function () {});
    } catch (e) {}
  }

  function finish() {
    est.sending = false; est.submitted = true;
    form.hidden = true;
    var thanks = $('[data-est-thanks]');
    thanks.hidden = false;
    if (card.getBoundingClientRect().top < 72) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ----- Visibilité du formulaire : ViewContent + barre collante ----- */
  var viewSent = false;
  if ('IntersectionObserver' in window && section) {
    new IntersectionObserver(function (entries) {
      var en = entries[0];
      state.formVisible = en.isIntersecting;
      paintChrome();
      if (en.isIntersecting && !viewSent) { viewSent = true; track('ViewContent', { content_name: 'Formulaire estimation' }); }
    }, { threshold: 0.15 }).observe(section);
  }

  render();
})();
