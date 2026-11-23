const crypto = require('crypto');
const {
  sha256, normPhone, buildUserData, parseBody, rateLimited, validateIdentity, validEventId, validTestCode, isJson
} = require('./_meta');

// Événement « QualifiedLead » : à envoyer MANUELLEMENT (ou depuis un CRM) quand le vendeur a qualifié
// le lead. Il n'est jamais déclenché par le site : aucune réponse du formulaire (ex. « Dès que possible »)
// ne qualifie un lead automatiquement.
//
// Route PRIVÉE : exige l'en-tête x-api-key égal à la variable d'environnement QUALIFIED_LEAD_SECRET
// (à créer dans Vercel, 16 caractères minimum). Sans secret valide configuré, la route reste fermée (503).
// Exemple d'appel :
//   curl -X POST https://dvteinte.com/api/capi-qualified-lead \
//     -H "Content-Type: application/json" -H "x-api-key: <secret>" \
//     -d '{"phone":"450 555-0123","email":"client@exemple.com","firstName":"Marie","lastName":"Tremblay",
//          "zip":"J4K 1A1","leadEventId":"<lead_event_id reçu dans le courriel>","fbc":"...","fbp":"..."}'
// Ajouter "testEventCode":"TEST123" pour voir l'événement dans « Tester les événements » sans l'enregistrer.
//
// Codes : 405 méthode · 503 fermée · 429 trop de tentatives · 401 secret absent/faux · 415 pas du JSON
//         400 données invalides · 200/502/500 résultat (jamais de détail interne dans la réponse)

// Comparaison à temps constant, sans révéler la longueur du secret (on compare deux empreintes de même taille).
function safeEqual(a, b) {
  var ha = crypto.createHash('sha256').update(String(a)).digest();
  var hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false });
    return;
  }

  var pixelId = process.env.META_PIXEL_ID;
  var token = process.env.META_CONVERSIONS_API_TOKEN;
  var secret = process.env.QUALIFIED_LEAD_SECRET;
  if (!pixelId || !token || !secret || secret.length < 16 || !/^\d{5,20}$/.test(pixelId)) {
    res.status(503).json({ success: false });
    return;
  }

  // Frein contre les essais de secret : 10 appels par 15 minutes par adresse IP
  if (rateLimited(req, 10, 15 * 60 * 1000, 'qualified')) {
    res.setHeader('Retry-After', '900');
    res.status(429).json({ success: false });
    return;
  }

  // Le secret ne passe que par l'en-tête (jamais dans le corps, qui peut se retrouver dans des journaux)
  var provided = req.headers['x-api-key'] || '';
  if (!provided || !safeEqual(provided, secret)) {
    res.status(401).json({ success: false });
    return;
  }
  if (!isJson(req)) {
    res.status(415).json({ success: false });
    return;
  }

  try {
    var body = parseBody(req);
    var identity = validateIdentity(body);
    if (!identity) {
      res.status(400).json({ success: false });
      return;
    }
    var userData = buildUserData(identity);

    // event_id stable : le même lead ne peut pas être qualifié deux fois (Meta dédoublonne).
    var leadEventId = validEventId(body.leadEventId);
    var key = leadEventId || sha256(normPhone(identity.phone) || identity.email);
    var event = {
      event_name: 'QualifiedLead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: 'qualified_' + String(key).slice(0, 64),
      action_source: 'system_generated',
      user_data: userData,
      custom_data: { lead_event_id: leadEventId || undefined, qualified_by: 'vendeur' }
    };

    var payload = { data: [event], access_token: token };
    var testCode = validTestCode(body.testEventCode);
    if (testCode) payload.test_event_code = testCode;

    var metaRes = await fetch('https://graph.facebook.com/v20.0/' + pixelId + '/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var metaJson = await metaRes.json().catch(function () { return {}; });
    if (!metaRes.ok) {
      console.error('Meta CAPI QualifiedLead error', metaJson && metaJson.error
        ? { code: metaJson.error.code, message: metaJson.error.message, trace: metaJson.error.fbtrace_id }
        : 'sans détail');
    }
    res.status(metaRes.ok ? 200 : 502).json({ success: metaRes.ok });
  } catch (err) {
    console.error('CAPI qualified lead handler error', err && err.message ? err.message : 'erreur');
    res.status(500).json({ success: false });
  }
};
