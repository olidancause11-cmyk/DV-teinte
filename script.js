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

  /* ===== Hero : profondeur (souris sur ordinateur) et défilement (partout) ===== */
  var heroEl = $('.hero');
  var motionOk = window.matchMedia('(prefers-reduced-motion:no-preference)').matches;
  if (heroEl && motionOk) {
    var pImg = $('.hero-media img', heroEl), pPanes = $$('.fx-pane', heroEl);
    var canMouse = window.matchMedia('(hover:hover) and (pointer:fine) and (min-width:1080px)').matches;
    var tx = 0, ty = 0, cx = 0, cy = 0, sp = 0, pRaf = 0;
    var pFrame = function () {
      pRaf = 0;
      cx += (tx - cx) * 0.07; cy += (ty - cy) * 0.07;
      // l'image bouge moins vite que la page (profondeur) et suit légèrement la souris
      pImg.style.translate = (-cx * 10) + 'px ' + (-cy * 6 + sp * 70) + 'px';
      if (pPanes[0]) pPanes[0].style.translate = (cx * 22) + 'px ' + (cy * 10) + 'px';
      if (pPanes[1]) pPanes[1].style.translate = (cx * 38) + 'px ' + (cy * 16) + 'px';
      heroEl.style.setProperty('--sp', sp.toFixed(3));
      if (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) pRaf = requestAnimationFrame(pFrame);
    };
    var pKick = function () { if (!pRaf) pRaf = requestAnimationFrame(pFrame); };
    var onHeroScroll = function () {
      var h = heroEl.offsetHeight || 1;
      sp = Math.max(0, Math.min(1, (window.scrollY || 0) / h));
      pKick();
    };
    window.addEventListener('scroll', onHeroScroll, { passive: true });
    onHeroScroll();
    if (canMouse) {
      heroEl.addEventListener('mousemove', function (e) {
        var r = heroEl.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        pKick();
      }, { passive: true });
      heroEl.addEventListener('mouseleave', function () { tx = 0; ty = 0; pKick(); });
    }
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
    var showDemo = function (btn, focus) {
      var key = btn.getAttribute('data-demo');
      demoBtns.forEach(function (b) {
        var on = b === btn, k = b.getAttribute('data-demo');
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        var view = $('#demo-view-' + k);
        view.classList.toggle('is-on', on);
        view.setAttribute('aria-hidden', String(!on));
        $('[data-caption="' + k + '"]').classList.toggle('is-on', on);
      });
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

  /* ===== Formulaire d’estimation (résidentiel 5 étapes, commercial 6 étapes) ===== */
  var form = $('[data-est-form]');
  var section = $('[data-est-section]');
  if (!form) return;

  var KEY = 'dvteinte_estimation_v6';
  var STEP_LABELS = {
    projet: 'Votre projet', lieu: 'Lieu', besoin: 'Votre besoin', 'besoin-c': 'Votre besoin',
    delai: 'Délai', fenetres: 'Fenêtres', 'fenetres-c': 'Fenêtres', contact: 'Coordonnées'
  };
  var FLOWS = {
    'Résidentiel': ['projet', 'besoin', 'delai', 'fenetres', 'contact'],
    'Commercial': ['projet', 'lieu', 'besoin-c', 'delai', 'fenetres-c', 'contact']
  };
  var est = {
    idx: 0, showErr: false, sending: false, submitted: false,
    a: { projet: '', lieu: '', probleme: '', delai: '', fenetres: '', nomComplet: '', telephone: '', courriel: '', codePostal: '' }
  };
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) est.a = Object.assign(est.a, JSON.parse(saved));
  } catch (e) {}

  var stepEls = {};
  $$('[data-est-step]', form).forEach(function (el) { stepEls[el.getAttribute('data-est-step')] = el; });
  var hpInput = $('[data-hp]', form);
  var submitBtn = $('[data-est-submit]', form);
  var card = $('#formulaire');
  var persist = function () { try { localStorage.setItem(KEY, JSON.stringify(est.a)); } catch (e) {} };
  var digits = function (v) { return (v || '').replace(/\D/g, ''); };
  var flow = function () { return FLOWS[est.a.projet] || FLOWS['Résidentiel']; };
  var isCommercial = function () { return est.a.projet === 'Commercial'; };

  function errors() {
    var a = est.a, e = {};
    if (a.nomComplet.trim().length < 2) e.nomComplet = true;
    var d = digits(a.telephone);
    if (!(d.length === 10 || (d.length === 11 && d[0] === '1'))) e.telephone = true;
    if (!/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(a.codePostal.trim())) e.codePostal = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.courriel.trim())) e.courriel = true;
    return e;
  }
  function formatPostal(v) { return v.toUpperCase().replace(/\s|-/g, '').replace(/^(...)/, '$1 '); }
  function splitName(full) {
    var parts = full.trim().split(/\s+/);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') };
  }

  var shownIdx = -1;
  function render() {
    var f = flow(), cur = f[est.idx];
    // étape visible, avec transition douce quand elle change
    Object.keys(stepEls).forEach(function (n) { stepEls[n].hidden = n !== cur; });
    if (shownIdx !== est.idx) {
      if (shownIdx !== -1) {
        var el = stepEls[cur];
        el.classList.remove('step-in', 'step-in-back');
        void el.offsetWidth; // relance l’animation
        el.classList.add(est.idx < shownIdx ? 'step-in-back' : 'step-in');
        if (card.getBoundingClientRect().top < 72) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      shownIdx = est.idx;
    }
    $('[data-est-stepnum]', form).textContent = 'Étape ' + (est.idx + 1) + ' sur ' + f.length;
    $('[data-est-stepname]', form).textContent = STEP_LABELS[cur];
    var pct = Math.round((est.idx + 1) / f.length * 100);
    $('[data-est-barfill]', form).style.width = pct + '%';
    $('[data-est-bar]', form).setAttribute('aria-valuenow', String(pct));
    // choix
    $$('fieldset[data-key]', form).forEach(function (fs) {
      var key = fs.getAttribute('data-key');
      $$('.opt', fs).forEach(function (b) { b.setAttribute('aria-pressed', String(est.a[key] === b.getAttribute('data-value'))); });
    });
    // champs cachés envoyés avec la demande
    $$('[data-hidden]', form).forEach(function (h) {
      var k = h.getAttribute('data-hidden');
      h.value = (k === 'lieu' && !isCommercial()) ? '' : (est.a[k] || '');
    });
    // pied de formulaire
    var last = cur === 'contact';
    $('[data-est-back]', form).hidden = est.idx === 0;
    $('[data-est-free]', form).hidden = est.idx !== 0;
    submitBtn.hidden = !last;
    $('[data-est-note]', form).hidden = !last;
    submitBtn.disabled = est.sending;
    submitBtn.textContent = est.sending ? 'Envoi…' : 'Demander mon estimation gratuite';
    // erreurs de champs
    var errs = est.showErr ? errors() : {};
    $$('[data-field]', form).forEach(function (inp) {
      var k = inp.getAttribute('data-field');
      inp.setAttribute('aria-invalid', String(!!errs[k]));
      var msg = $('[data-err="' + k + '"]', form);
      if (msg) msg.hidden = !errs[k];
    });
  }

  // valeurs initiales des champs texte
  $$('[data-field]', form).forEach(function (inp) {
    inp.value = est.a[inp.getAttribute('data-field')] || '';
    inp.addEventListener('input', function () {
      est.a[inp.getAttribute('data-field')] = inp.value;
      persist();
      if (est.showErr) render();
    });
  });

  // changer de type de projet efface les réponses qui dépendent du type (leurs choix diffèrent)
  function setProjet(val) {
    if (est.a.projet && est.a.projet !== val) { est.a.lieu = ''; est.a.probleme = ''; est.a.fenetres = ''; }
    est.a.projet = val;
  }

  // un choix fait passer à l’étape suivante
  var pickTimer;
  $$('.opt', form).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.closest('fieldset[data-key]').getAttribute('data-key');
      var val = btn.getAttribute('data-value');
      if (key === 'projet') setProjet(val); else est.a[key] = val;
      persist();
      render();
      clearTimeout(pickTimer);
      pickTimer = setTimeout(function () { est.idx = Math.min(est.idx + 1, flow().length - 1); render(); }, 220);
    });
  });
  $('[data-est-back]', form).addEventListener('click', function () {
    clearTimeout(pickTimer);
    est.idx = Math.max(0, est.idx - 1);
    render();
  });
  // boutons du site qui pré-sélectionnent le type (ex. « Demander une soumission commerciale »)
  $$('[data-pick-projet]').forEach(function (a) {
    a.addEventListener('click', function () {
      clearTimeout(pickTimer);
      setProjet(a.getAttribute('data-pick-projet'));
      persist();
      est.idx = Math.min(1, flow().length - 1);
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
    var postal = formatPostal(a.codePostal);
    var eventId = newEventId();
    est.sending = true; showSendError(false); render();

    var data = new FormData(form);
    data.set('nom_complet', a.nomComplet.trim());
    data.set('code_postal', postal);
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
        trackLead(a, postal, eventId, fbp, fbc);        // Lead : seulement après un envoi réussi
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
    if (payload.nom_complet) payload.name = payload.nom_complet;
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

  function trackLead(a, postal, eventId, fbp, fbc) {
    var commercial = a.projet === 'Commercial';
    var contentName = commercial ? 'Estimation commerciale' : 'Estimation résidentielle';
    var answers = { type_projet: a.projet, probleme: a.probleme, delai: a.delai, nombre_fenetres: a.fenetres };
    if (commercial) answers.type_lieu = a.lieu;
    // même eventId côté navigateur et côté serveur : Meta dédoublonne
    track('Lead', Object.assign({ content_name: contentName, form_version: 'v6' }, answers), { eventID: eventId });
    var name = splitName(a.nomComplet);
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
          firstName: name.first,
          lastName: name.last,
          zip: postal,
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
