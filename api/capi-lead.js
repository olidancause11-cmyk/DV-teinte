const { buildUserData, parseBody, sendEvent } = require('./_meta');

// Événement « Lead » envoyé par le serveur, avec le même event_id que le pixel du navigateur
// (Meta dédoublonne). Le navigateur ne l'appelle qu'après un envoi réussi du formulaire.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  var pixelId = process.env.META_PIXEL_ID;
  var token = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !token) {
    res.status(200).json({ success: false, error: 'not_configured' });
    return;
  }

  try {
    var body = parseBody(req);

    var forwardedFor = req.headers['x-forwarded-for'] || '';
    var clientIp = (forwardedFor.split(',')[0] || '').trim() || (req.socket && req.socket.remoteAddress) || '';
    var userAgent = req.headers['user-agent'] || '';

    var userData = buildUserData(body);
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
    ['probleme', 'delai', 'nombre_fenetres'].forEach(function (k) {
      if (answers[k]) custom[k] = String(answers[k]).slice(0, 100);
    });
    custom.form_version = 'v5';
    event.custom_data = custom;

    if (body.eventId) event.event_id = String(body.eventId).slice(0, 100);
    if (body.eventSourceUrl) event.event_source_url = body.eventSourceUrl;

    var result = await sendEvent(pixelId, token, event);
    if (!result.ok) console.error('Meta CAPI error', result.json);
    res.status(200).json({ success: result.ok, meta: result.json });
  } catch (err) {
    console.error('CAPI lead handler error', err);
    res.status(200).json({ success: false, error: String(err) });
  }
};
