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

  /* ===== Curseur avant / après ===== */
  var ba = $('[data-ba]');
  if (ba) {
    var baClip = $('[data-ba-clip]', ba), baLine = $('[data-ba-line]', ba), baKnob = $('[data-ba-knob]', ba), baRange = $('[data-ba-range]', ba);
    var setBa = function (pos) {
      baClip.style.clipPath = 'inset(0 ' + (100 - pos) + '% 0 0)';
      baLine.style.left = pos + '%';
      baKnob.style.left = pos + '%';
    };
    baRange.addEventListener('input', function (e) { setBa(+e.target.value); });
    baRange.addEventListener('change', function (e) { setBa(+e.target.value); });
    setBa(+baRange.value);
  }

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

  /* ===== Formulaire d’estimation (4 étapes) ===== */
  var form = $('[data-est-form]');
  var section = $('[data-est-section]');
  if (!form) return;

  var KEY = 'dvteinte_estimation_v5';
  var STEP_NAMES = ['Votre besoin', 'Délai', 'Fenêtres', 'Coordonnées'];
  var LAST = STEP_NAMES.length - 1;
  var est = {
    step: 0, showErr: false, sending: false, submitted: false,
    a: { probleme: '', delai: '', fenetres: '', nomComplet: '', telephone: '', courriel: '', codePostal: '' }
  };
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) est.a = Object.assign(est.a, JSON.parse(saved));
  } catch (e) {}

  var steps = $$('[data-est-step]', form);
  var hpInput = $('[data-hp]', form);
  var submitBtn = $('[data-est-submit]', form);
  var card = $('#formulaire');
  var persist = function () { try { localStorage.setItem(KEY, JSON.stringify(est.a)); } catch (e) {} };
  var digits = function (v) { return (v || '').replace(/\D/g, ''); };

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

  var shownStep = -1;
  function render() {
    // étape visible, avec transition douce quand elle change
    steps.forEach(function (el, i) { el.hidden = i !== est.step; });
    if (shownStep !== est.step) {
      var cur = steps[est.step];
      if (shownStep !== -1) {
        cur.classList.remove('step-in', 'step-in-back');
        void cur.offsetWidth; // relance l’animation
        cur.classList.add(est.step < shownStep ? 'step-in-back' : 'step-in');
        var top = card.getBoundingClientRect().top;
        if (top < 72) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      shownStep = est.step;
    }
    $('[data-est-stepnum]', form).textContent = 'Étape ' + (est.step + 1) + ' sur ' + STEP_NAMES.length;
    $('[data-est-stepname]', form).textContent = STEP_NAMES[est.step];
    var pct = Math.round((est.step + 1) / STEP_NAMES.length * 100);
    $('[data-est-barfill]', form).style.width = pct + '%';
    $('[data-est-bar]', form).setAttribute('aria-valuenow', String(pct));
    // choix
    $$('fieldset[data-key]', form).forEach(function (fs) {
      var key = fs.getAttribute('data-key');
      $$('.opt', fs).forEach(function (b) { b.setAttribute('aria-pressed', String(est.a[key] === b.getAttribute('data-value'))); });
    });
    // champs cachés envoyés avec la demande
    $$('[data-hidden]', form).forEach(function (h) { h.value = est.a[h.getAttribute('data-hidden')] || ''; });
    // pied de formulaire
    $('[data-est-back]', form).hidden = est.step === 0;
    $('[data-est-free]', form).hidden = est.step !== 0;
    submitBtn.hidden = est.step !== LAST;
    $('[data-est-note]', form).hidden = est.step !== LAST;
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

  // un choix fait passer à l’étape suivante (la dernière étape de choix mène aux coordonnées)
  var pickTimer;
  $$('.opt', form).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.closest('fieldset[data-key]').getAttribute('data-key');
      est.a[key] = btn.getAttribute('data-value');
      persist();
      render();
      clearTimeout(pickTimer);
      pickTimer = setTimeout(function () { est.step = Math.min(est.step + 1, LAST); render(); }, 220);
    });
  });
  $('[data-est-back]', form).addEventListener('click', function () {
    clearTimeout(pickTimer);
    est.step = Math.max(0, est.step - 1);
    render();
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
    data.set('source', 'landing-residentiel');
    data.set('page', location.href);
    data.set('date', new Date().toISOString());
    // références Meta, utiles pour qualifier le lead plus tard
    data.set('lead_event_id', eventId);
    var fbp = getCookie('_fbp'), fbc = getCookie('_fbc');
    if (fbp) data.set('fbp', fbp);
    if (fbc) data.set('fbc', fbc);

    var url = form.getAttribute('action').replace('https://formsubmit.co/', 'https://formsubmit.co/ajax/');
    fetch(url, { method: 'POST', headers: { 'Accept': 'application/json' }, body: data })
      .then(function (res) {
        return res.text().then(function (text) {
          var json = null;
          try { json = JSON.parse(text); } catch (e) {}
          var ok = res.ok && json && (json.success === true || json.success === 'true');
          if (!ok) throw new Error(json && json.message ? json.message : 'bad response');
        });
      })
      .then(function () {
        trackLead(a, postal, eventId, fbp, fbc);        // Lead : seulement après un envoi réussi
        try { localStorage.removeItem(KEY); } catch (e) {}
        finish();
      })
      .catch(function () {
        est.sending = false; render(); showSendError(true);
      });
  }

  function trackLead(a, postal, eventId, fbp, fbc) {
    var answers = { probleme: a.probleme, delai: a.delai, nombre_fenetres: a.fenetres };
    // même eventId côté navigateur et côté serveur : Meta dédoublonne
    track('Lead', Object.assign({ content_name: 'Estimation résidentielle', form_version: 'v5' }, answers), { eventID: eventId });
    var name = splitName(a.nomComplet);
    try {
      fetch('/api/capi-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          eventId: eventId,
          eventSourceUrl: location.href,
          contentName: 'Estimation résidentielle',
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
