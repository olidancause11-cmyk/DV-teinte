const {
  buildUserData, parseBody, sendEvent, hostAllowed, originAllowed, rateLimited,
  validateIdentity, validEventId, validAnswers, clean, isJson
} = require('./_meta');

// Événement « Lead » envoyé par le serveur, avec le même event_id que le pixel du navigateur
// (Meta dédoublonne). Le navigateur ne l'appelle qu'après un envoi réussi du formulaire.
//
// Route publique (aucune donnée privée n'en sort), donc protégée ainsi :
//   405 mauvaise méthode · 403 origine étrangère · 429 trop d'appels · 415 pas du JSON
//   400 données invalides · 503 non configurée · 200 traité (jamais de détail interne dans la réponse)
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ success: false });
    return;
  }

  if (!originAllowed(req)) {
    res.status(403).json({ success: false });
    return;
  }
  if (rateLimited(req, 15, 10 * 60 * 1000, 'lead')) {
    res.setHeader('Retry-After', '600');
    res.status(429).json({ success: false });
    return;
  }
  if (!isJson(req)) {
    res.status(415).json({ success: false });
    return;
  }

  var pixelId = process.env.META_PIXEL_ID;
  var token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !token || !/^\d{5,20}$/.test(pixelId)) {
    res.status(503).json({ success: false });
    return;
  }

  try {
    var body = parseBody(req);

    // Tout ce qui vient du navigateur est revalidé : courriel ou téléphone valide obligatoire.
    var identity = validateIdentity(body);
    if (!identity) {
      res.status(400).json({ success: false });
      return;
    }

    var forwardedFor = req.headers['x-forwarded-for'] || '';
    var clientIp = (forwardedFor.split(',')[0] || '').trim() || (req.socket && req.socket.remoteAddress) || '';
    var userAgent = clean(req.headers['user-agent'] || '', 400);

    var userData = buildUserData(identity);
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;

    var event = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: userData
    };

    // Réponses du formulaire (liste blanche), enregistrées avec le lead
    var custom = validAnswers(body.answers);
    var contentName = clean(body.contentName, 100);
    if (contentName) custom.content_name = contentName;
    custom.form_version = 'v6';
    event.custom_data = custom;

    var eventId = validEventId(body.eventId);
    if (eventId) event.event_id = eventId;
    if (typeof body.eventSourceUrl === 'string' && hostAllowed(body.eventSourceUrl)) {
      event.event_source_url = body.eventSourceUrl.slice(0, 500);
    }

    var result = await sendEvent(pixelId, token, event);
    if (!result.ok) {
      console.error('Meta CAPI error', result.json && result.json.error
        ? { code: result.json.error.code, message: result.json.error.message, trace: result.json.error.fbtrace_id }
        : 'sans détail');
    }
    // Aucun détail interne dans la réponse : le détail reste dans les journaux Vercel.
    res.status(200).json({ success: result.ok });
  } catch (err) {
    console.error('CAPI lead handler error', err && err.message ? err.message : 'erreur');
    res.status(200).json({ success: false });
  }
};
