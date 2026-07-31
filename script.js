(function(){
  'use strict';

  /* ===== Meta Pixel + Conversions API (Lead) ===== */
  function getCookie(name){
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : '';
  }
  function generateEventId(){
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }
  function trackLead(leadAnswers){
    var eventId = generateEventId();
    try {
      if (typeof fbq === 'function') fbq('track', 'Lead', {}, { eventID: eventId });
    } catch (e) {}
    try {
      fetch('/api/capi-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: eventId,
          eventSourceUrl: window.location.href,
          email: leadAnswers.courriel,
          phone: leadAnswers.telephone,
          firstName: leadAnswers.prenom,
          lastName: leadAnswers.nom,
          zip: leadAnswers.ville,
          fbp: getCookie('_fbp'),
          fbc: getCookie('_fbc')
        })
      }).catch(function(){});
    } catch (e) {}
  }

  /* ===== Sticky header + floating CTA ===== */
  var header = document.getElementById('site-header');
  var floatCta = document.querySelector('[data-float-cta]');
  function onScroll(){
    var y = window.scrollY || 0;
    header.classList.toggle('scrolled', y > 30);
    floatCta.classList.toggle('show', y > 700);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ===== Mobile menu ===== */
  var mobileMenu = document.querySelector('[data-mobile-menu]');
  var mobileOverlay = document.querySelector('[data-mobile-overlay]');
  function openMobile(){ mobileMenu.classList.add('open'); mobileOverlay.classList.add('open'); }
  function closeMobile(){ mobileMenu.classList.remove('open'); mobileOverlay.classList.remove('open'); }
  document.querySelector('[data-mobile-toggle]').addEventListener('click', openMobile);
  mobileOverlay.addEventListener('click', closeMobile);
  document.querySelectorAll('[data-mobile-close]').forEach(function(el){ el.addEventListener('click', closeMobile); });

  /* ===== Before / After slider ===== */
  var baSlider = document.querySelector('[data-ba-slider]');
  var baBefore = document.querySelector('[data-ba-before-clip]');
  var baLine = document.querySelector('[data-ba-line]');
  var baHandle = document.querySelector('[data-ba-handle]');
  var baRange = document.querySelector('[data-ba-range]');
  function setBaPos(pos){
    pos = Math.max(0, Math.min(100, pos));
    baBefore.style.clipPath = 'inset(0 ' + (100 - pos) + '% 0 0)';
    baLine.style.left = pos + '%';
    baHandle.style.left = pos + '%';
    baRange.value = pos;
  }
  baRange.addEventListener('input', function(e){ setBaPos(+e.target.value); });

  /* ===== Materials tech data toggles ===== */
  document.querySelectorAll('[data-tech-toggle]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var key = btn.getAttribute('data-tech-toggle');
      var panel = document.querySelector('[data-tech-panel="' + key + '"]');
      var open = panel.classList.toggle('open');
      btn.querySelector('.tech-icon').textContent = open ? '−' : '+';
    });
  });

  /* ===== FAQ ===== */
  var faqData = [
    { q: "Est-ce que le matériau est inclus dans la soumission?", a: "Oui. Le projet est évalué comme un service complet qui comprend le matériau recommandé et son installation. Les détails exacts seront indiqués dans la soumission." },
    { q: "Dois-je acheter la pellicule moi-même?", a: "Non. Nous pouvons recommander et fournir le matériau adapté au projet, puis réaliser l'installation sur mesure." },
    { q: "Dois-je savoir quelle teinte choisir?", a: "Non. Vous pouvez simplement nous expliquer le résultat recherché. Nous pourrons ensuite vous recommander une option selon vos fenêtres et vos priorités." },
    { q: "Quelle est la différence entre les options 15 % et 35 %?", a: "La pellicule 15 % offre généralement un résultat plus foncé et davantage d'intimité pendant la journée. La pellicule 35 % conserve davantage de lumière naturelle tout en réduisant les reflets et en améliorant le confort." },
    { q: "Peut-on voir à travers une pellicule 15 %?", a: "Oui. Une pellicule 15 % est foncée, mais elle n'est pas opaque. La visibilité varie selon l'éclairage à l'intérieur et à l'extérieur." },
    { q: "L'intimité fonctionne-t-elle le soir?", a: "L'effet d'intimité est généralement plus important du côté où la lumière est la plus forte. Lorsque l'intérieur est éclairé et que l'extérieur est sombre, il peut être possible de voir vers l'intérieur. Des stores ou rideaux peuvent donc rester nécessaires." },
    { q: "Pouvez-vous trouver une pellicule grise, miroir ou givrée?", a: "Vous pouvez nous envoyer une demande personnalisée. Nous vérifierons ensuite les options disponibles auprès de nos fournisseurs ainsi que leur compatibilité avec vos fenêtres." },
    { q: "Les matériaux personnalisés sont-ils toujours disponibles?", a: "Non. La disponibilité dépend du type de matériau, du fournisseur, de la quantité requise et de la compatibilité avec le vitrage. Nous devons vérifier chaque demande avant de confirmer le produit, le prix et le délai." },
    { q: "Faites-vous du résidentiel et du commercial?", a: "Oui. Nous réalisons des projets pour les maisons, condos, bureaux, commerces, vitrines et autres espaces professionnels." },
    { q: "La pellicule peut-elle être installée sur toutes les fenêtres?", a: "La compatibilité doit être vérifiée selon le verre, la composition du vitrage et le matériau envisagé. Nous analysons le projet avant de confirmer la solution." },
    { q: "Combien de temps prend une installation?", a: "La durée dépend du nombre de fenêtres, de leurs dimensions et de leur accessibilité. Une estimation plus précise pourra être fournie après l'analyse du projet." },
    { q: "La demande de soumission est-elle gratuite?", a: "Oui. La demande est gratuite et sans obligation. Elle nous permet de comprendre le projet et de vous proposer les prochaines étapes." }
  ];
  var faqList = document.querySelector('[data-faq-list]');
  faqData.forEach(function(f){
    var item = document.createElement('div');
    item.className = 'faq-item';
    var qBtn = document.createElement('button');
    qBtn.className = 'faq-q';
    qBtn.innerHTML = '<span></span><span class="faq-icon">+</span>';
    qBtn.querySelector('span').textContent = f.q;
    var aP = document.createElement('p');
    aP.className = 'faq-a';
    aP.textContent = f.a;
    item.appendChild(qBtn);
    item.appendChild(aP);
    faqList.appendChild(item);
    qBtn.addEventListener('click', function(){
      var isOpen = item.classList.contains('open');
      faqList.querySelectorAll('.faq-item').forEach(function(other){
        other.classList.remove('open');
        other.querySelector('.faq-icon').textContent = '+';
      });
      if (!isOpen) {
        item.classList.add('open');
        qBtn.querySelector('.faq-icon').textContent = '−';
      }
    });
  });

  /* ===== Quote wizard ===== */
  var STORAGE_KEY = 'dvteinte_quote_v1';
  var CUSTOM_PREFS = ['Effet gris', 'Effet miroir ou réfléchissant', 'Effet givré', 'Effet décoratif', 'Autre résultat personnalisé'];
  var STEP_TITLES = { type: 'Type de projet', preference: 'Préférence', custom: 'Projet personnalisé', quantite: 'Quantité', photos: 'Photos', coordonnees: 'Coordonnées', infos: 'Informations' };

  var answers = {
    type: '', category: '', preference: '', customText: '', customTypes: [],
    quantite: '', dimensions: '', prenom: '', nom: '', telephone: '', courriel: '',
    ville: '', rappel: '', infos: '', hp: ''
  };
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { var parsed = JSON.parse(saved); for (var k in parsed) answers[k] = parsed[k]; }
  } catch (e) {}

  var photos = []; // {name, url}
  var stepIdx = 0;
  var showErr = false;

  var overlay = document.querySelector('[data-wizard-overlay]');
  var formEl = document.querySelector('[data-wizard-form]');
  var confirmEl = document.querySelector('[data-wizard-confirm]');
  var progressFill = document.querySelector('[data-progress-fill]');
  var stepNumEl = document.querySelector('[data-step-num]');
  var stepTitleEl = document.querySelector('[data-step-title]');
  var prevBtn = document.querySelector('[data-wizard-prev]');
  var nextBtn = document.querySelector('[data-wizard-next]');
  var submitBtn = document.querySelector('[data-wizard-submit]');
  var errorMsg = document.querySelector('[data-error-msg]');
  var submitError = document.querySelector('[data-submit-error]');
  var photoGrid = document.querySelector('[data-photo-grid]');
  var confirmTitle = document.querySelector('[data-confirm-title]');
  var confirmText = document.querySelector('[data-confirm-text]');

  function persist(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(answers)); } catch (e) {} }

  function stepKeys(){
    var custom = CUSTOM_PREFS.indexOf(answers.preference) !== -1;
    var keys = ['type', 'preference'];
    if (custom) keys.push('custom');
    keys.push('quantite', 'coordonnees', 'infos');
    return keys;
  }

  function fillFieldsFromAnswers(){
    formEl.querySelectorAll('[data-field]').forEach(function(el){
      var f = el.getAttribute('data-field');
      if (typeof answers[f] === 'string') el.value = answers[f];
    });
    // chip selections
    formEl.querySelectorAll('[data-single-group]').forEach(function(group){
      var field = group.getAttribute('data-single-group');
      group.querySelectorAll('.chip-btn').forEach(function(btn){
        btn.classList.toggle('selected', btn.getAttribute('data-value') === answers[field]);
      });
    });
    formEl.querySelectorAll('[data-multi-group]').forEach(function(group){
      var field = group.getAttribute('data-multi-group');
      var arr = answers[field] || [];
      group.querySelectorAll('.chip-btn').forEach(function(btn){
        btn.classList.toggle('selected', arr.indexOf(btn.getAttribute('data-value')) !== -1);
      });
    });
    // mirror chip-driven answers into hidden inputs so the real POST includes them
    formEl.querySelectorAll('[data-hidden-field]').forEach(function(el){
      var f = el.getAttribute('data-hidden-field');
      var val = answers[f];
      el.value = Array.isArray(val) ? val.join(', ') : (val || '');
    });
  }

  function renderPhotos(){
    photoGrid.innerHTML = '';
    photos.forEach(function(ph, i){
      var thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      var img = document.createElement('img');
      img.src = ph.url; img.alt = 'Aperçu';
      var rm = document.createElement('button');
      rm.className = 'photo-remove'; rm.setAttribute('aria-label', 'Retirer'); rm.textContent = '×';
      rm.addEventListener('click', function(){ photos.splice(i, 1); renderPhotos(); });
      thumb.appendChild(img); thumb.appendChild(rm);
      photoGrid.appendChild(thumb);
    });
  }

  function renderStep(){
    var keys = stepKeys();
    var idx = Math.min(stepIdx, keys.length - 1);
    var cur = keys[idx];

    formEl.querySelectorAll('.wizard-step').forEach(function(s){
      s.classList.toggle('active', s.getAttribute('data-step') === cur);
    });

    stepNumEl.textContent = 'Étape ' + (idx + 1) + ' sur ' + keys.length;
    stepTitleEl.textContent = STEP_TITLES[cur] || '';
    progressFill.style.width = Math.round(((idx + 1) / keys.length) * 100) + '%';

    prevBtn.style.visibility = idx > 0 ? 'visible' : 'hidden';
    var isLast = cur === 'infos';
    nextBtn.style.display = isLast ? 'none' : 'inline-flex';
    submitBtn.style.display = isLast ? 'inline-flex' : 'none';

    fillFieldsFromAnswers();
    errorMsg.classList.toggle('show', showErr && cur === 'coordonnees' && hasValidationError());
  }

  function hasValidationError(){
    return !(answers.prenom.trim() && answers.telephone.trim() && answers.courriel.trim() && answers.ville.trim());
  }

  function openWizard(prefill){
    if (prefill === 'residential') { answers.category = 'Résidentiel'; answers.type = 'Maison'; }
    else if (prefill === 'commercial') { answers.category = 'Commercial'; answers.type = 'Commerce'; }
    else if (prefill === 'fonce') { answers.preference = 'Résultat plus foncé et plus intime'; }
    else if (prefill === 'leger') { answers.preference = 'Résultat léger qui conserve davantage de lumière'; }
    else if (prefill === 'custom') { answers.preference = 'Autre résultat personnalisé'; }
    else if (prefill === 'recommandation') { answers.preference = 'Je souhaite une recommandation'; }
    persist();
    stepIdx = 0; showErr = false;
    overlay.classList.add('open');
    formEl.style.display = '';
    confirmEl.classList.remove('show');
    document.body.style.overflow = 'hidden';
    renderStep();
  }
  function closeWizard(){
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-open-wizard]').forEach(function(btn){
    btn.addEventListener('click', function(){ openWizard(btn.getAttribute('data-prefill')); });
  });
  document.querySelectorAll('[data-wizard-close]').forEach(function(btn){ btn.addEventListener('click', closeWizard); });
  overlay.addEventListener('click', function(e){ if (e.target === overlay) closeWizard(); });
  document.querySelector('[data-wizard-modal]').addEventListener('click', function(e){ e.stopPropagation(); });

  nextBtn.addEventListener('click', function(){
    var keys = stepKeys();
    stepIdx = Math.min(stepIdx + 1, keys.length - 1);
    renderStep();
  });
  prevBtn.addEventListener('click', function(){
    stepIdx = Math.max(stepIdx - 1, 0);
    renderStep();
  });

  submitBtn.addEventListener('click', function(){
    if (answers.hp) { showConfirm(); return; }
    if (hasValidationError()) {
      showErr = true;
      var keys = stepKeys();
      stepIdx = keys.indexOf('coordonnees');
      renderStep();
      return;
    }
    sendToFormSubmit();
  });

  function sendToFormSubmit(){
    submitError.classList.remove('show');
    submitBtn.disabled = true;
    var originalLabel = submitBtn.textContent;
    submitBtn.textContent = 'Envoi en cours…';

    var data = new FormData(formEl);
    photos.forEach(function(ph, i){
      if (ph.file) data.append('photo_' + (i + 1), ph.file, ph.name);
    });

    var ajaxUrl = formEl.getAttribute('action').replace('https://formsubmit.co/', 'https://formsubmit.co/ajax/');
    fetch(ajaxUrl, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: data
    }).then(function(res){
      return res.text().then(function(text){
        var parsed = null;
        try { parsed = JSON.parse(text); } catch (e) {}
        window.__lastFormSubmitResponse = { status: res.status, ok: res.ok, raw: text };
        var success = parsed && (parsed.success === true || parsed.success === 'true');
        if (!res.ok || !success) throw new Error(parsed && parsed.message ? parsed.message : 'bad response');
        trackLead(answers);
        showConfirm();
      });
    }).catch(function(err){
      window.__lastFormSubmitError = String(err);
      submitError.classList.add('show');
    }).finally(function(){
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    });
  }

  function showConfirm(){
    var isCustom = CUSTOM_PREFS.indexOf(answers.preference) !== -1;
    confirmTitle.textContent = isCustom ? 'Votre demande personnalisée a bien été envoyée.' : 'Votre demande a bien été envoyée.';
    confirmText.textContent = isCustom
      ? "Nous examinerons le résultat recherché et vérifierons les matériaux qui pourraient convenir auprès de nos fournisseurs. Nous communiquerons ensuite avec vous pour confirmer les possibilités."
      : "Nous examinerons votre projet et communiquerons avec vous pour discuter de la solution, du matériau et de l'installation.";
    formEl.style.display = 'none';
    confirmEl.classList.add('show');
  }

  /* field inputs */
  formEl.querySelectorAll('[data-field]').forEach(function(el){
    el.addEventListener('input', function(){
      var f = el.getAttribute('data-field');
      answers[f] = el.value;
      persist();
      if (f === 'prenom' || f === 'telephone' || f === 'courriel' || f === 'ville') {
        el.classList.toggle('error', showErr && !el.value.trim());
        errorMsg.classList.toggle('show', showErr && hasValidationError());
      }
    });
  });

  /* single-select chip groups */
  formEl.querySelectorAll('[data-single-group]').forEach(function(group){
    var field = group.getAttribute('data-single-group');
    group.querySelectorAll('.chip-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        answers[field] = btn.getAttribute('data-value');
        if (field === 'type') {
          var catMap = { 'Maison': 'Résidentiel', 'Condo ou appartement': 'Résidentiel', 'Bureau': 'Commercial', 'Commerce': 'Commercial', 'Immeuble': 'À confirmer', 'Autre': 'À confirmer' };
          answers.category = catMap[answers.type] || '';
        }
        persist();
        fillFieldsFromAnswers();
      });
    });
  });

  /* multi-select chip groups */
  formEl.querySelectorAll('[data-multi-group]').forEach(function(group){
    var field = group.getAttribute('data-multi-group');
    group.querySelectorAll('.chip-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var val = btn.getAttribute('data-value');
        var arr = answers[field] || [];
        var i = arr.indexOf(val);
        if (i === -1) arr.push(val); else arr.splice(i, 1);
        answers[field] = arr;
        persist();
        fillFieldsFromAnswers();
      });
    });
  });

  /* photo upload */
  var photoInput = document.querySelector('[data-photo-input]');
  if (photoInput) {
    photoInput.addEventListener('change', function(e){
      var files = Array.prototype.slice.call(e.target.files || []);
      files.filter(function(f){ return f.type.indexOf('image/') === 0; }).forEach(function(f){
        photos.push({ name: f.name, url: URL.createObjectURL(f), file: f });
      });
      renderPhotos();
      e.target.value = '';
    });
  }

  /* keyboard: close wizard on Escape */
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeWizard();
  });

})();
