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
  /* ===== Suivi des clics sur les boutons d'action : seulement l'emplacement du bouton, aucune donnée personnelle ===== */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-cta]') : null;
    if (!a) return;
    var loc = a.getAttribute('data-cta');
    try {
      if (typeof window.fbq === 'function') window.fbq('trackCustom', 'CTAClick', { cta_location: loc });
      (window.dataLayer = window.dataLayer || []).push({ event: 'dv_cta_click', cta_location: loc });
    } catch (err) {}
  });
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function newEventId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  /* ===== Vidéo explicative : test A/B (avec / sans vidéo) =====
     VSL_SHARE = part des visiteurs qui voient la vidéo (0.5 = 50 %, 1 = tout le monde, 0 = personne).
     Le choix est gardé dans le navigateur du visiteur. ?vsl=on / ?vsl=off force la variante (pour tester). */
  var VSL_SHARE = 1;
  function pickVslVariant() {
    var forced = '';
    try { forced = (new URLSearchParams(location.search).get('vsl') || '').toLowerCase(); } catch (e) {}
    if (forced === 'on' || forced === 'off') return forced;
    if (VSL_SHARE >= 1) return 'on'; // tout le monde voit la vidéo (ignore un ancien choix « off » gardé dans le navigateur)
    try { var saved = localStorage.getItem('dv_vsl'); if (saved === 'on' || saved === 'off') return saved; } catch (e) {}
    var v = Math.random() < VSL_SHARE ? 'on' : 'off';
    try { localStorage.setItem('dv_vsl', v); } catch (e) {}
    return v;
  }
  var vslVariant = pickVslVariant();
  function trackCustom(name, params) {
    var p = Object.assign({ vsl_variant: vslVariant }, params || {});
    try {
      if (typeof window.fbq === 'function') window.fbq('trackCustom', name, p);
      (window.dataLayer = window.dataLayer || []).push(Object.assign({ event: 'dv_' + name.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase() }, p));
    } catch (e) {}
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
      // le bouton sous les onglets suit le besoin choisi (même destination : le formulaire)
      var soluCta = $('[data-solu-cta]');
      var ctaText = btn.getAttribute('data-cta-text');
      if (soluCta && ctaText && soluCta.firstChild) soluCta.firstChild.textContent = ctaText;
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
    add('.demo-title, .svc-title, .solu-title, .rev-head .h2, .trust-title, .proc-title, .est-sec .h2, .faq-in .h2, .final-title');
    add('.demo-head, .demo-tabs, .demo-captions, .demo-cta');
    add('.demo-frame', true);
    add('.solu-head, .solu-tabs, .solu-panels, .solu-cta');
    add('.rev-head, .rev-track, .rev-ctrl');
    add('.trust-sub, .trust-item, .trust-cta');
    add('.proc-sub, .proc-step, .proc-cta');
    add('.est-sec .stack-22 > *, .est-card');
    add('.svc-sub, .svc-card');
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
    a: { prenom: '', nom: '', nomcomplet: '', telephone: '', courriel: '', message: '' }
  };
  // Données personnelles : le brouillon (nom, téléphone, courriel, message) n'est gardé que 24 h sur l'appareil, puis effacé
  var DRAFT_TTL = 24 * 3600 * 1000;
  try {
    var saved = localStorage.getItem(KEY);
    if (saved) {
      var d = JSON.parse(saved);
      if (d && d.t && d.a && Date.now() - d.t < DRAFT_TTL) est.a = Object.assign(est.a, d.a);
      else localStorage.removeItem(KEY);
    }
  } catch (e) {}

  var hpInput = $('[data-hp]', form);
  var submitBtn = $('[data-est-submit]', form);
  var card = $('#formulaire');
  var persist = function () { try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), a: est.a })); } catch (e) {} };
  var digits = function (v) { return (v || '').replace(/\D/g, ''); };
  var isCommercial = function () { return est.projet === 'Commercial'; };

  // nouveau formulaire : un seul champ « Nom complet » (le prénom est le premier mot) et courriel facultatif
  var fullName = form.hasAttribute('data-fullname');
  var emailOptional = form.hasAttribute('data-email-optional');
  function syncName() {
    if (!fullName) return;
    var n = (est.a.nomcomplet || '').trim().replace(/\s+/g, ' ');
    var i = n.indexOf(' ');
    est.a.prenom = i < 0 ? n : n.slice(0, i);
    est.a.nom = i < 0 ? '' : n.slice(i + 1);
  }
  function chosenGoal() { var g = $('[data-objectif]', form); return g ? g.value : ''; }
  function goalPrefix() { var g = chosenGoal(); return g ? '[Problème principal : ' + g + '] ' : ''; }
  var ERR_MSG = { nomcomplet: 'Entrez votre nom.', telephone: 'Entrez un numéro de téléphone valide (10 chiffres).', courriel: 'Entrez un courriel valide.' };
  function errors() {
    var a = est.a, e = {};
    syncName();
    if (fullName) { if (!(a.nomcomplet || '').trim()) e.nomcomplet = true; }
    else {
      if (!a.prenom.trim()) e.prenom = true;
      if (!a.nom.trim()) e.nom = true;
    }
    var d = digits(a.telephone);
    // numéro nord-américain : 10 chiffres, ou 11 chiffres s’il commence par l’indicatif 1 (jamais 10 chiffres avec un 1 au début)
    if (!((d.length === 10 && d[0] !== '1') || (d.length === 11 && d[0] === '1'))) e.telephone = true;
    if (!(emailOptional && !a.courriel.trim()) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.courriel.trim())) e.courriel = true;
    return e;
  }

  function render() {
    var label = $('[data-est-label]', form);
    if (label) label.textContent = isCommercial() ? 'Soumission commerciale' : 'Demande d’estimation gratuite';
    var hid = $('[data-hidden="projet"]', form);
    if (hid) hid.value = est.projet;
    submitBtn.disabled = est.sending;
    var btnLabel = $('[data-btn-label]', submitBtn) || submitBtn;
    btnLabel.textContent = est.sending ? 'Envoi…' : 'Obtenir mon estimation gratuite';
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
      if (inp.setCustomValidity) inp.setCustomValidity('');
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

  /* ----- Attribution publicitaire : campagne / ad set / pub, lus dans l’adresse de la pub Meta ----- */
  // Adresse de pub courte : https://dvteinte.com/?c=intimite&s=winners&a=rideaux_v1  (c = campagne, s = ad set, a = pub)
  // Les anciens noms longs SQF_CAMPAIGN / SQF_ADSET / SQF_AD restent acceptés.
  var ATTR_KEY = 'dvteinte_attr_v1';
  var ATTR_PARAMS = { campaign: ['C', 'SQF_CAMPAIGN'], adset: ['S', 'SQF_ADSET'], ad: ['A', 'SQF_AD'] };
  var ATTR_NAMES = [].concat(ATTR_PARAMS.campaign, ATTR_PARAMS.adset, ATTR_PARAMS.ad);
  var ATTR_TTL = 30 * 24 * 3600 * 1000;                // on garde la dernière pub cliquée pendant 30 jours
  var attrMem = null;
  // Sécurité : une valeur venue de l’adresse est du texte, jamais une formule ni du HTML (lettres, chiffres, espaces et signes courants seulement)
  function cleanAttr(v) {
    v = String(v || '');
    try { v = v.replace(/[^\p{L}\p{N} _\-\/.$%:,()&#]/gu, ''); } catch (e) { v = v.replace(/[^A-Za-z0-9 _\-\/.$%:,()&#]/g, ''); }
    return v.replace(/^[\s=+\-@]+/, '').replace(/\s+$/, '').slice(0, 100);
  }
  (function captureAttr() {
    var found = {}, any = false, q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    Object.keys(ATTR_PARAMS).forEach(function (k) {
      var v = '';
      q.forEach(function (val, name) { if (ATTR_PARAMS[k].indexOf(name.toUpperCase()) > -1 && val.trim()) v = val; });
      v = cleanAttr(v);
      if (v) { found[k] = v; any = true; }
    });
    if (!any) return;
    found.t = Date.now();
    attrMem = found;
    try { localStorage.setItem(ATTR_KEY, JSON.stringify(found)); } catch (e) {}
    // adresse propre : on retire les paramètres c / s / a de la barre d’adresse (déjà mémorisés ci-dessus), le reste (#ancre, fbclid…) est conservé
    try {
      var clean = new URLSearchParams(location.search);
      Array.from(clean.keys()).forEach(function (name) { if (ATTR_NAMES.indexOf(name.toUpperCase()) > -1) clean.delete(name); });
      var qs = clean.toString();
      history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (e) {}
  })();
  function currentAttr() {
    var o = attrMem;
    if (!o) { try { o = JSON.parse(localStorage.getItem(ATTR_KEY) || 'null'); } catch (e) { o = null; } }
    if (!o || !o.t || Date.now() - o.t > ATTR_TTL) return { campaign: '', adset: '', ad: '' };
    return { campaign: cleanAttr(o.campaign), adset: cleanAttr(o.adset), ad: cleanAttr(o.ad) };
  }
  function fillAttr() {
    var at = currentAttr();
    $$('[data-attr]', form).forEach(function (inp) { inp.value = at[inp.getAttribute('data-attr')] || ''; });
    return at;
  }
  fillAttr();

  /* ----- Canal direct vers la feuille (Google Apps Script) : la demande est enregistrée même si les services de courriel sont en panne ----- */
  var SHEET_URL = 'https://script.google.com/macros/s/AKfycbxeuyRaBoC6KFYjYLYAl8fIDSJIW1YC8jB4fOK5TwLjGXSh2c7fEyqS7rPKbztZ1aGh/exec';     // adresse de l'application web Apps Script (vide = canal désactivé)
  var SHEET_TOKEN = '061af63686ab8a97f58449939a631ce2f149c872f39f5b41';   // jeton partagé : il filtre le bruit, la vraie validation se fait côté Apps Script
  var OUTBOX_KEY = 'dvteinte_outbox_v1';
  function sheetPayload(a, eventId, at) {
    return {
      token: SHEET_TOKEN, hp: '', eventId: eventId,
      prenom: a.prenom.trim(), nom: a.nom.trim(), telephone: a.telephone.trim(), courriel: a.courriel.trim(),
      message: (goalPrefix() + a.message.trim()).trim().slice(0, 1500), projet: est.projet,
      campaign: at.campaign, adset: at.adset, ad: at.ad
    };
  }
  // Succès seulement si Apps Script répond {"ok":true} (demande validée ET enregistrée).
  function saveToSheet(payload) {
    if (!SHEET_URL) return Promise.reject(new Error('inactif'));
    return withTimeout(12000, function (signal) {
      return fetch(SHEET_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: signal })
        .then(function (res) { return res.json(); })
        .then(function (j) { if (!j || j.ok !== true) throw new Error('refusé'); });
    });
  }
  // Reprise : si tous les envois échouent, la demande est gardée 24 h sur l'appareil et renvoyée au prochain chargement de la page.
  function outboxSave(p) { try { localStorage.setItem(OUTBOX_KEY, JSON.stringify({ t: Date.now(), p: p })); } catch (e) {} }
  function outboxRetry() {
    try {
      var o = JSON.parse(localStorage.getItem(OUTBOX_KEY) || 'null');
      if (!o || !o.p) return;
      if (Date.now() - o.t > 24 * 3600 * 1000) { localStorage.removeItem(OUTBOX_KEY); return; }
      saveToSheet(o.p).then(function () { localStorage.removeItem(OUTBOX_KEY); }).catch(function () {});
    } catch (e) {}
  }
  outboxRetry();
  window.addEventListener('online', outboxRetry);
  // Résout dès qu'un des envois réussit ; rejette seulement si tous échouent.
  function firstSuccess(list) {
    return new Promise(function (resolve, reject) {
      var failed = 0;
      list.forEach(function (p) {
        p.then(resolve, function () { failed++; if (failed === list.length) reject(new Error('échec')); });
      });
    });
  }

  /* ----- Envoi : Web3Forms (courriel) + Meta Pixel et API Conversions (Lead) ----- */
  function showSendError(on) { $('[data-send-err]', form).hidden = !on; }

  function submit() {
    if (est.sending || est.submitted) return;          // jamais deux envois (ni deux Lead)
    if (hpInput.value) { finish(); return; }          // robot : on fait semblant sans rien envoyer
    if (Object.keys(errors()).length) {
      est.showErr = true; render();
      var first = $('[aria-invalid="true"]', form);
      if (first) {
        first.focus();
        var k = first.getAttribute('data-field');
        if (!$('[data-err="' + k + '"]', form) && ERR_MSG[k] && first.setCustomValidity) { first.setCustomValidity(ERR_MSG[k]); first.reportValidity(); }
      }
      return;
    }
    var a = est.a;
    var eventId = est.eventId || (est.eventId = newEventId());   // même identifiant si le visiteur réessaie : jamais de doublon
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
    var at = fillAttr();                                // campagne / ad set / pub (vides si le visiteur ne vient pas d’une pub)
    data.set('CAMPAIGN', at.campaign); data.set('ADSET', at.adset); data.set('AD', at.ad);
    var fbp = getCookie('_fbp'), fbc = getCookie('_fbc');
    if (fbp) data.set('fbp', fbp);
    if (fbc) data.set('fbc', fbc);

    // Deux chemins indépendants en parallèle : le courriel (Web3Forms, puis FormSubmit en secours) et le canal direct vers la feuille.
    // La demande est réussie dès qu'un des deux répond ; elle n'est « perdue » que si les deux échouent (elle est alors gardée pour reprise).
    var payload = sheetPayload(a, eventId, at);
    firstSuccess([deliver(data), saveToSheet(payload)])
      .then(function () {
        trackLead(a, eventId, fbp, fbc);                // Lead : seulement après un envoi réussi
        try { localStorage.removeItem(KEY); localStorage.removeItem(OUTBOX_KEY); } catch (e) {}
        finish();
      })
      .catch(function () {
        if (SHEET_URL) outboxSave(payload);
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
    // Web3Forms d'abord (FormSubmit a déjà livré des courriels vides), FormSubmit en secours
    return viaWeb3Forms(data).catch(function () { return viaFormSubmit(data); });
  }

  function trackLead(a, eventId, fbp, fbc) {
    var commercial = isCommercial();
    var contentName = commercial ? 'Estimation commerciale' : 'Estimation résidentielle';
    var answers = { type_projet: est.projet };
    // même eventId côté navigateur et côté serveur : Meta dédoublonne (le message du client n'est jamais envoyé à Meta)
    track('Lead', Object.assign({ content_name: contentName, form_version: 'v7', vsl_variant: vslVariant, objectif: chosenGoal() }, answers), { eventID: eventId });
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

  /* ===== Vidéo (VSL) dans l'encadré du hero =====
     Rien n'est téléchargé avant le clic (preload=none, source ajoutée au clic). La lecture démarre seulement quand le visiteur clique « Regarder la vidéo ». */
  (function initVsl() {
    var box = $('[data-vsl-inline]');
    var video = box && $('[data-vsl-video]', box);
    var playBtn = box && $('[data-vsl-play]', box);
    var thumb = box && $('[data-vsl-thumb]', box);
    if (!box || !video || !playBtn) return;
    trackCustom('VslAssigned');
    var sent = {}, maxPct = 0, played = false, pausedSent = false;

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); trackCustom('VideoSectionView'); }
      }, { threshold: 0.5 });
      io.observe(box);
    }
    playBtn.addEventListener('click', function () {
      video.src = video.getAttribute('data-src');
      video.hidden = false;
      playBtn.hidden = true;
      if (thumb) thumb.hidden = true;
      var pr = video.play();
      if (pr && pr.catch) pr.catch(function () {});
    });
    video.addEventListener('play', function () {
      pausedSent = false;
      if (played) return; played = true;
      trackCustom('VideoPlay');
    });
    video.addEventListener('timeupdate', function () {
      if (!video.duration) return;
      var pct = Math.floor(video.currentTime / video.duration * 100);
      if (pct > maxPct) maxPct = pct;
      [25, 50, 75].forEach(function (m) {
        if (pct >= m && !sent[m]) { sent[m] = true; trackCustom('VideoProgress', { percent: m }); }
      });
    });
    video.addEventListener('ended', function () {
      maxPct = 100;
      if (!sent[100]) { sent[100] = true; trackCustom('VideoProgress', { percent: 100 }); }
    });
    function closeEvent() {
      if (!played || pausedSent) return;
      pausedSent = true;
      trackCustom('VideoClose', { percent_max: maxPct, seconds: Math.round(video.currentTime || 0) });
    }
    video.addEventListener('pause', function () { if (!video.ended) closeEvent(); });
    window.addEventListener('pagehide', function () { if (!video.paused) closeEvent(); });
  })();

  /* ===== Mur d'avis (colonnes selon la largeur, 6 avis puis tous) ===== */
  (function initReviews() {
    var colsBox = $('[data-wall-cols]');
    if (!colsBox) return;
    var toggle = $('[data-reviews-toggle]'), label = $('[data-reviews-label]'), chev = $('[data-reviews-chevron]');
    var P = 'assets/v6/';
    var REVIEWS = [
      { name: 'Derek Bureau', text: 'Super belle expérience du début à la fin! L’équipe était vraiment sympathique, dynamique et professionnelle. La communication a été facile et agréable tout au long du processus.\n\nIls ont respecté l’heure d’arrivée prévue ainsi que tout ce qui avait été convenu au contrat. Le travail a été fait avec professionnalisme et le résultat est à la hauteur de nos attentes.\n\nUne entreprise fiable et agréable avec qui faire affaire. Je les recommande sans hésitation!', photos: ['avis-bureau.webp'] },
      { name: 'Emmanuel Sierra', text: 'Excellent travail! Service professionnel, installation impeccable et résultat à la hauteur de nos attentes. L’intimité est garantie à 100 % et les pellicules installées sur nos demi-lune filtrent considérablement la lumière. Nous sommes très satisfaits du résultat et recommandons leurs services sans hésitation!', photos: ['avis-sierra-2.webp', 'avis-sierra-1.webp'] },
      { name: 'adam', text: 'J’ai utilisé le service de soumission en ligne pour obtenir un estimé pour ma maison. En seulement quelques heures, j’ai obtenu un rendez-vous dans la même semaine. Le travail que nous proposent ces entrepreneurs est irréprochable. Je recommande à tous ⭐⭐⭐⭐⭐', photos: [] },
      { name: 'Johanne Brunet', text: 'Excellent service! Un grand merci à cette équipe de deux jeunes entrepreneurs pour leur professionnalisme et leur respect. Le travail est soigné, les délais ont été respectés et tout a été nettoyé avant leur départ. Je ferai de nouveau appel à eux sans hésiter!', photos: ['avis-brunet.webp'] },
      { name: 'Abhii Kanagaratnam', text: 'Derek and his team did an amazing job tinting our windows! Their work was very clean and professional. Highly recommend!', photos: ['avis-kanagaratnam.webp'] },
      { name: 'Cassandre Salvi', text: 'Service A1 du début à la fin! Je recommande fortement. Le résultat est parfait.', photos: ['avis-salvi.webp'] },
      { name: 'Nancy Morin', text: 'Très professionnels, sympathique et travaillant !!\nJe recommande à 100%', photos: [] },
      { name: 'Marc Olivier Farmer', text: 'ceci est une super de compagnie . je recommande fortement!!!', photos: [] },
      { name: 'alain vaillancourt', text: 'Travail impeccable rapide je le recommande', photos: [] },
      { name: 'Patrick Demers', text: 'Bon prix', photos: ['avis-demers.webp'] }
    ];
    var all = false, cols = 0;
    function n() { var w = window.innerWidth; return w < 560 ? 1 : w < 1000 ? 2 : 3; }
    function make(tag, css, text) {
      var e = document.createElement(tag);
      if (css) e.setAttribute('style', css);
      if (text != null) e.textContent = text;
      return e;
    }
    function photo(src) {
      var d = make('div', 'width:100%;aspect-ratio:3/4;border-radius:6px;background-color:#E9E9E6;overflow:hidden');
      var i = make('img', 'width:100%;height:100%;object-fit:cover;display:block');
      i.src = P + src; i.alt = 'Photo de l’installation partagée par le client'; i.loading = 'lazy'; i.decoding = 'async';
      d.appendChild(i);
      return d;
    }
    function card(r) {
      var a = make('article', 'background:#FFFFFF;border:1px solid #E4E4E0;border-radius:10px;padding:clamp(18px,2vw,24px);display:flex;flex-direction:column;gap:12px');
      a.appendChild(make('span', 'letter-spacing:2px;font-size:15px;line-height:1;color:#FBBC04', '★★★★★'));
      a.appendChild(make('p', 'margin:0;font-size:16px;line-height:1.55;color:#080808;white-space:pre-line', r.text));
      if (r.photos.length === 2) {
        var g = make('div', 'display:grid;grid-template-columns:1fr 1fr;gap:8px');
        r.photos.forEach(function (s) { g.appendChild(photo(s)); });
        a.appendChild(g);
      } else if (r.photos.length === 1) {
        a.appendChild(photo(r.photos[0]));
      }
      var f = make('div', 'display:flex;align-items:baseline;justify-content:space-between;gap:12px');
      f.appendChild(make('span', 'font-size:15px;font-weight:700;color:#132A4A', r.name));
      f.appendChild(make('span', 'font-size:12px;color:#8A8A8A', 'Avis Google'));
      a.appendChild(f);
      return a;
    }
    function paint() {
      cols = n();
      colsBox.textContent = '';
      var columns = [];
      for (var c = 0; c < cols; c++) {
        columns.push(colsBox.appendChild(make('div', 'flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:clamp(12px,1.4vw,16px)')));
      }
      (all ? REVIEWS : REVIEWS.slice(0, cols === 1 ? 4 : 6)).forEach(function (r, i) { columns[i % cols].appendChild(card(r)); });
      if (toggle) toggle.setAttribute('aria-expanded', String(all));
      if (label) label.textContent = all ? 'Voir moins' : 'Voir plus d’avis';
      if (chev) chev.style.transform = all ? 'rotate(180deg)' : 'none';
    }
    if (toggle) toggle.addEventListener('click', function () { all = !all; paint(); });
    window.addEventListener('resize', function () { if (n() !== cols) paint(); });
    paint();
  })();

  /* ===== FAQ : une seule réponse ouverte à la fois (toutes fermées au départ, comme dans le design) ===== */
  (function initFaq() {
    var btns = $$('[data-faq-btn]');
    if (!btns.length) return;
    function set(b, open) {
      var i = b.getAttribute('data-faq-btn');
      b.setAttribute('aria-expanded', String(open));
      var panel = $('[data-faq-panel="' + i + '"]');
      if (panel) panel.hidden = !open;
      var ch = $('[data-faq-chevron="' + i + '"]');
      if (ch) ch.style.transform = open ? 'rotate(180deg)' : 'none';
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        var wasOpen = b.getAttribute('aria-expanded') === 'true';
        btns.forEach(function (o) { set(o, false); });
        if (!wasOpen) set(b, true);
      });
    });
  })();

  /* ===== Formulaire : « Problème principal » (un seul choix, on peut le retirer) ===== */
  (function initGoal() {
    var chips = $$('[data-chip]');
    var hid = $('[data-objectif]');
    if (!chips.length || !hid) return;
    var cur = -1;
    function paint() {
      chips.forEach(function (c, i) {
        var on = i === cur;
        c.setAttribute('aria-pressed', String(on));
        c.style.background = on ? '#132A4A' : '#FFFFFF';
        c.style.color = on ? '#FFFFFF' : '#080808';
        c.style.borderColor = on ? '#132A4A' : '#CFCFCF';
      });
      hid.value = cur < 0 ? '' : chips[cur].textContent.trim();
    }
    chips.forEach(function (c, i) { c.addEventListener('click', function () { cur = cur === i ? -1 : i; paint(); }); });
  })();

  render();
})();
