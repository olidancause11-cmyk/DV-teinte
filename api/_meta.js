// Utilitaires partagés pour l'API Conversions de Meta (le préfixe « _ » évite d'en faire une route).
// Règle : on ne fait JAMAIS confiance au navigateur. Tout ce qui arrive est revalidé ici, côté serveur.
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

// ───────────────────────── Validation stricte des entrées ─────────────────────────
var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
var FBP_RE = /^fb\.[0-2]\.\d{10,13}\.\d{1,20}$/;
var FBC_RE = /^fb\.[0-2]\.\d{10,13}\.[A-Za-z0-9_-]{1,300}$/;
var EVENT_ID_RE = /^[A-Za-z0-9_-]{8,100}$/;
var TEST_CODE_RE = /^[A-Za-z0-9]{3,40}$/;
var PROJETS = ['Résidentiel', 'Commercial'];

// Texte simple : pas de caractères de contrôle, taille limitée.
function clean(v, max) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}
// Numéro nord-américain : 10 chiffres (sans 1 au début), ou 11 chiffres commençant par 1. Retourne 10 chiffres, sinon ''.
function validPhone(v) {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  var s = String(v);
  if (s.length > 40) return '';
  var d = s.replace(/\D/g, '');
  if (d.length === 10 && d[0] !== '1') return d;
  if (d.length === 11 && d[0] === '1') return d.slice(1);
  return '';
}
function validEmail(v) {
  var e = clean(v, 254).toLowerCase();
  return EMAIL_RE.test(e) ? e : '';
}
// Identité du lead : au moins un courriel OU un téléphone valide, sinon null (la route répond 400).
function validateIdentity(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  var email = validEmail(body.email);
  var phone = validPhone(body.phone);
  if (!email && !phone) return null;
  var fbp = typeof body.fbp === 'string' && FBP_RE.test(body.fbp) ? body.fbp : '';
  var fbc = typeof body.fbc === 'string' && FBC_RE.test(body.fbc) ? body.fbc : '';
  return {
    email: email, phone: phone,
    firstName: clean(body.firstName, 60), lastName: clean(body.lastName, 60),
    zip: clean(body.zip, 10), fbp: fbp, fbc: fbc
  };
}
function validEventId(v) { return typeof v === 'string' && EVENT_ID_RE.test(v) ? v : ''; }
function validTestCode(v) { return typeof v === 'string' && TEST_CODE_RE.test(v) ? v : ''; }
// Réponses du formulaire : liste blanche de clés, valeurs courtes.
function validAnswers(a) {
  var out = {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) return out;
  if (PROJETS.indexOf(a.type_projet) > -1) out.type_projet = a.type_projet;
  ['type_lieu', 'probleme', 'delai', 'nombre_fenetres'].forEach(function (k) {
    var v = clean(typeof a[k] === 'number' ? String(a[k]) : a[k], 100);
    if (v) out[k] = v;
  });
  return out;
}

// Données client normalisées puis hachées (SHA-256), comme l'exige Meta. À appeler avec validateIdentity().
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

// Corps de la requête : objet JSON de taille raisonnable, sinon {}.
function parseBody(req) {
  var body = req.body;
  if (typeof body === 'string') {
    if (body.length > 20000) return {};
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  try { if (JSON.stringify(body).length > 20000) return {}; } catch (e) { return {}; }
  return body;
}
// Les routes n'acceptent que du JSON : un formulaire envoyé d'un autre site (text/plain, form-data) est refusé.
function isJson(req) {
  return String(req.headers['content-type'] || '').toLowerCase().indexOf('application/json') === 0;
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

// ───────────────────────── Accès : origine, limite de fréquence ─────────────────────────
// Seules les pages de dvteinte.com (et les aperçus Vercel de ce projet) peuvent appeler l'API depuis un navigateur.
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

// Limite de fréquence par adresse IP et par « seau » (mémoire de l'instance : un frein, pas une garantie absolue).
var hits = {};
function rateLimited(req, max, windowMs, bucket) {
  var ip = ((req.headers['x-forwarded-for'] || '').split(',')[0] || '').trim() || 'inconnu';
  var id = (bucket || 'defaut') + '|' + ip;
  var now = Date.now();
  var list = (hits[id] || []).filter(function (t) { return now - t < windowMs; });
  list.push(now);
  hits[id] = list;
  var keys = Object.keys(hits);
  if (keys.length > 1000) keys.forEach(function (k) { if (!hits[k].some(function (t) { return now - t < windowMs; })) delete hits[k]; });
  return list.length > max;
}

module.exports = {
  sha256, normPhone, buildUserData, parseBody, sendEvent, hostAllowed, originAllowed, rateLimited,
  clean, validPhone, validEmail, validateIdentity, validEventId, validTestCode, validAnswers, isJson
};
