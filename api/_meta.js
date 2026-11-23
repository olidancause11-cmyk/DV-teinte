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

// ── Sécurité : seules les pages de dvteinte.com (et les aperçus Vercel de ce projet) peuvent appeler l'API depuis un navigateur ──
function hostAllowed(url) {
  try {
    var h = new URL(url).hostname.toLowerCase();
    return h === 'dvteinte.com' || h === 'www.dvteinte.com' || h === 'localhost' ||
      /^dv-teinte[a-z0-9-]*\.vercel\.app$/.test(h);
  } catch (e) { return false; }
}
// Un navigateur envoie toujours Origin ou Referer : s'il y en a un et qu'il n'est pas le nôtre, on refuse.
// (Un appel sans navigateur n'a pas d'en-tête : il n'est pas bloqué ici, la limite de fréquence s'applique.)
function originAllowed(req) {
  var src = req.headers.origin || req.headers.referer || '';
  return !src || hostAllowed(src);
}

// Limite de fréquence simple par adresse IP (mémoire de l'instance : un frein, pas une garantie).
var hits = {};
function rateLimited(req, max, windowMs) {
  var ip = ((req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() || 'inconnu';
  var now = Date.now();
  var list = (hits[ip] || []).filter(function (t) { return now - t < windowMs; });
  list.push(now);
  hits[ip] = list;
  var keys = Object.keys(hits);
  if (keys.length > 500) keys.forEach(function (k) { if (!hits[k].some(function (t) { return now - t < windowMs; })) delete hits[k]; });
  return list.length > max;
}

module.exports = { sha256, normPhone, buildUserData, parseBody, sendEvent, hostAllowed, originAllowed, rateLimited };
