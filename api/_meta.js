// Utilitaires partagés pour l'API Conversions de Meta (le préfixe « _ » évite d'en faire une route).
const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function normEmail(v) { return v ? String(v).trim().toLowerCase() : ''; }
function normName(v) { return v ? String(v).trim().toLowerCase() : ''; }
function normZip(v) {
  if (!v) return '';
  return String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}
function normPhone(v) {
  if (!v) return '';
  var digits = String(v).replace(/\D/g, '');
  if (digits.length === 10) digits = '1' + digits;
  return digits;
}

// Données client normalisées puis hachées (SHA-256), comme l'exige Meta.
function buildUserData(body) {
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
  userData.country = [sha256('ca')];
  if (body.fbp) userData.fbp = body.fbp;
  if (body.fbc) userData.fbc = body.fbc;
  return userData;
}

function parseBody(req) {
  var body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  return body || {};
}

async function sendEvent(pixelId, token, event) {
  var metaRes = await fetch('https://graph.facebook.com/v20.0/' + pixelId + '/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: [event], access_token: token })
  });
  var metaJson = await metaRes.json().catch(function () { return {}; });
  return { ok: metaRes.ok, json: metaJson };
}

module.exports = { sha256, normPhone, buildUserData, parseBody, sendEvent };
