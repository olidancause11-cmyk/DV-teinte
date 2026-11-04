const crypto = require('crypto');
const { sha256, normPhone, buildUserData, parseBody } = require('./_meta');

// Événement « QualifiedLead » : à envoyer MANUELLEMENT (ou depuis un CRM) quand le vendeur a qualifié
// le lead. Il n'est jamais déclenché par le site : aucune réponse du formulaire (ex. « Dès que possible »)
// ne qualifie un lead automatiquement.
//
// Protégé par la variable d'environnement QUALIFIED_LEAD_SECRET (à créer dans Vercel).
// Exemple d'appel :
//   curl -X POST https://dvteinte.com/api/capi-qualified-lead \
//     -H "Content-Type: application/json" -H "x-api-key: <secret>" \
//     -d '{"phone":"450 555-0123","email":"client@exemple.com","firstName":"Marie","lastName":"Tremblay",
//          "zip":"J4K 1A1","leadEventId":"<lead_event_id reçu dans le courriel>","fbc":"...","fbp":"..."}'
// Ajouter "testEventCode":"TEST123" pour voir l'événement dans « Tester les événements » sans l'enregistrer.

function safeEqual(a, b) {
  var ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  var pixelId = process.env.META_PIXEL_ID;
  var token = process.env.META_CONVERSIONS_API_TOKEN;
  var secret = process.env.QUALIFIED_LEAD_SECRET;
  if (!pixelId || !token || !secret) {
    res.status(503).json({ success: false, error: 'not_configured' });
    return;
  }

  var body = parseBody(req);
  var provided = req.headers['x-api-key'] || body.secret || '';
  if (!provided || !safeEqual(provided, secret)) {
    res.status(401).json({ success: false, error: 'unauthorized' });
    return;
  }

  try {
    var userData = buildUserData(body);
    if (!userData.em && !userData.ph) {
      res.status(400).json({ success: false, error: 'phone_or_email_required' });
      return;
    }

    // event_id stable : le même lead ne peut pas être qualifié deux fois (Meta dédoublonne).
    var key = body.leadEventId || sha256(normPhone(body.phone) || String(body.email || '').trim().toLowerCase());
    var event = {
      event_name: 'QualifiedLead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: 'qualified_' + String(key).slice(0, 64),
      action_source: 'system_generated',
      user_data: userData,
      custom_data: { lead_event_id: body.leadEventId || undefined, qualified_by: 'vendeur' }
    };

    var payload = { data: [event], access_token: token };
    if (body.testEventCode) payload.test_event_code = String(body.testEventCode);

    var metaRes = await fetch('https://graph.facebook.com/v20.0/' + pixelId + '/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var metaJson = await metaRes.json().catch(function () { return {}; });
    if (!metaRes.ok) console.error('Meta CAPI QualifiedLead error', metaJson);
    res.status(metaRes.ok ? 200 : 502).json({ success: metaRes.ok, meta: metaJson });
  } catch (err) {
    console.error('CAPI qualified lead handler error', err);
    res.status(500).json({ success: false, error: String(err) });
  }
};
