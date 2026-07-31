const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function normEmail(v) { return v ? String(v).trim().toLowerCase() : ''; }
function normName(v) { return v ? String(v).trim().toLowerCase() : ''; }
function normZip(v) { return v ? String(v).trim().toLowerCase().replace(/\s+/g, '') : ''; }
function normPhone(v) {
  if (!v) return '';
  var digits = String(v).replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  return digits;
}

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
    var body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    var forwardedFor = req.headers['x-forwarded-for'] || '';
    var clientIp = (forwardedFor.split(',')[0] || '').trim() || (req.socket && req.socket.remoteAddress) || '';
    var userAgent = req.headers['user-agent'] || '';

    var userData = {};
    var email = normEmail(body.email);
    if (email) userData.em = [sha256(email)];
    var phone = normPhone(body.phone);
    if (phone) userData.ph = [sha256(phone)];
    var firstName = normName(body.firstName);
    if (firstName) userData.fn = [sha256(firstName)];
    var lastName = normName(body.lastName);
    if (lastName) userData.ln = [sha256(lastName)];
    var zip = normZip(body.zip);
    if (zip) userData.zp = [sha256(zip)];
    if (clientIp) userData.client_ip_address = clientIp;
    if (userAgent) userData.client_user_agent = userAgent;
    if (body.fbp) userData.fbp = body.fbp;
    if (body.fbc) userData.fbc = body.fbc;

    var event = {
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      user_data: userData
    };
    if (body.eventId) event.event_id = body.eventId;
    if (body.eventSourceUrl) event.event_source_url = body.eventSourceUrl;

    var metaRes = await fetch('https://graph.facebook.com/v20.0/' + pixelId + '/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: token })
    });
    var metaJson = await metaRes.json().catch(function () { return {}; });

    if (!metaRes.ok) console.error('Meta CAPI error', metaJson);
    res.status(200).json({ success: metaRes.ok, meta: metaJson });
  } catch (err) {
    console.error('CAPI lead handler error', err);
    res.status(200).json({ success: false, error: String(err) });
  }
};
