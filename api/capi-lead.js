const { buildUserData, parseBody, sendEvent, hostAllowed, originAllowed, rateLimited } = require('./_meta');

// Événement « Lead » envoyé par le serveur, avec le même event_id que le pixel du navigateur
// (Meta dédoublonne). Le navigateur ne l'appelle qu'après un envoi réussi du formulaire.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  // Sécurité : origine du navigateur + limite de fréquence (15 appels / 10 min / adresse IP)
  if (!originAllowed(req)) {
    res.status(403).json({ success: false });
    return;
  }
  if (rateLimited(req, 15, 10 * 60 * 1000)) {
    res.status(429).json({ success: false });
    return;
  }

  var pixelId = process.env.META_PIXEL_ID;
  var token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !token) {
    res.status(200).json({ success: false });
    return;
  }

  try {
    var body = parseBody(req);

    var forwardedFor = req.headers['x-forwarded-for'] || '';
    var clientIp = (forwardedFor.split(',')[0] || '').trim() || (req.socket && req.socket.remoteAddress) || '';
    var userAgent = req.headers['user-agent'] || '';

    var userData = buildUserData(body);
    // Sécurité : un vrai lead a toujours un téléphone ou un courriel
    if (!userData.em && !userData.ph) {
      res.status(400).json({ success: false });
      return;
    }
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;

    var event = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: userData
    };

    // Réponses du formulaire, enregistrées avec le lead
    var custom = {};
    if (body.contentName) custom.content_name = String(body.contentName).slice(0, 100);
    var answers = body.answers && typeof body.answers === 'object' ? body.answers : {};
    ['type_projet', 'type_lieu', 'probleme', 'delai', 'nombre_fenetres'].forEach(function (k) {
      if (answers[k]) custom[k] = String(answers[k]).slice(0, 100);
    });
    custom.form_version = 'v6';
    event.custom_data = custom;

    if (body.eventId && /^[A-Za-z0-9_-]{8,100}$/.test(String(body.eventId))) event.event_id = String(body.eventId);
    if (body.eventSourceUrl && hostAllowed(String(body.eventSourceUrl))) event.event_source_url = String(body.eventSourceUrl).slice(0, 500);

    var result = await sendEvent(pixelId, token, event);
    if (!result.ok) console.error('Meta CAPI error', result.json && result.json.error ? { code: result.json.error.code, message: result.json.error.message, trace: result.json.error.fbtrace_id } : 'sans détail');
    // Sécurité : aucun détail interne dans la réponse (le détail reste dans les journaux Vercel)
    res.status(200).json({ success: result.ok });
  } catch (err) {
    console.error('CAPI lead handler error', err && err.message ? err.message : 'erreur');
    res.status(200).json({ success: false });
  }
};
