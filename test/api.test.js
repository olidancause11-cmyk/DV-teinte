// Tests des routes API : node --test test/
// (Node 18 ou plus récent ; aucune dépendance à installer.)
const test = require('node:test');
const assert = require('node:assert/strict');

const lead = require('../api/capi-lead');
const qualified = require('../api/capi-qualified-lead');

// ───── outils ─────
let ipCounter = 0;
const newIp = () => '10.0.' + Math.floor(++ipCounter / 250) + '.' + (ipCounter % 250);
function makeRes() {
  const res = { code: null, json: null, headers: {} };
  res.status = (c) => { res.code = c; return res; };
  res.json = (j) => { res.json = j; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return res;
}
async function call(handler, { method = 'POST', headers = {}, body, ip } = {}) {
  const res = makeRes();
  const req = { method, headers: Object.assign({ 'content-type': 'application/json', 'x-forwarded-for': ip || newIp(), 'user-agent': 'test' }, headers), body, socket: {} };
  await handler(req, res);
  return res;
}
let metaCalls = [];
let metaFails = false;
function mockEnv(env) {
  process.env.META_PIXEL_ID = env && 'pixel' in env ? env.pixel : '1234567890';
  process.env.META_CONVERSIONS_API_TOKEN = env && 'token' in env ? env.token : 'TOKEN_SECRET_VALUE';
  if (env && 'secret' in env) { if (env.secret === undefined) delete process.env.QUALIFIED_LEAD_SECRET; else process.env.QUALIFIED_LEAD_SECRET = env.secret; }
  metaCalls = []; metaFails = false;
  global.fetch = async (url, opts) => {
    metaCalls.push({ url: String(url), body: JSON.parse(opts.body) });
    if (metaFails) return { ok: false, json: async () => ({ error: { code: 190, message: 'jeton secret invalide TOKEN_SECRET_VALUE', fbtrace_id: 'abc' } }) };
    return { ok: true, json: async () => ({ events_received: 1, fbtrace_id: 'xyz' }) };
  };
}
const good = () => ({
  phone: '450 802-9892', email: 'Marie@Example.com', firstName: 'Marie', lastName: 'Tremblay',
  eventId: '123e4567-e89b-12d3-a456-426614174000', eventSourceUrl: 'https://dvteinte.com/?fbclid=x',
  contentName: 'Estimation résidentielle', answers: { type_projet: 'Résidentiel' }
});
const SECRET = 'un-secret-assez-long-123456';

// ───── /api/capi-lead ─────
test('lead : GET refusé avec 405 et en-tête Allow', async () => {
  mockEnv();
  const r = await call(lead, { method: 'GET' });
  assert.equal(r.code, 405); assert.equal(r.headers.Allow, 'POST'); assert.deepEqual(r.json, { success: false });
});

test('lead : origine étrangère refusée (403), nos origines acceptées', async () => {
  mockEnv();
  assert.equal((await call(lead, { headers: { origin: 'https://evil.example' }, body: good() })).code, 403);
  assert.equal((await call(lead, { headers: { referer: 'https://evil.example/page' }, body: good() })).code, 403);
  assert.equal((await call(lead, { headers: { origin: 'https://dvteinte.com.evil.example' }, body: good() })).code, 403);
  for (const o of ['https://dvteinte.com', 'https://www.dvteinte.com', 'https://dv-teinte-git-x-team.vercel.app']) {
    assert.equal((await call(lead, { headers: { origin: o }, body: good() })).code, 200, o);
  }
  assert.equal((await call(lead, { headers: { referer: 'https://dvteinte.com/page' }, body: good() })).code, 200);
});

test('lead : seulement du JSON (415 pour text/plain et formulaires)', async () => {
  mockEnv();
  assert.equal((await call(lead, { headers: { 'content-type': 'text/plain' }, body: JSON.stringify(good()) })).code, 415);
  assert.equal((await call(lead, { headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=b' })).code, 415);
});

test('lead : données invalides refusées (400) et rien n\'est envoyé à Meta', async () => {
  mockEnv();
  const bad = [
    {}, [], 'pas du json', null,
    { firstName: 'x' },                                   // ni téléphone ni courriel
    { phone: '450802989' },                               // 9 chiffres
    { phone: '1450802989' },                              // 10 chiffres avec 1 au début
    { phone: '45080298921' },                             // 11 chiffres sans 1 au début
    { phone: 'abc' }, { phone: { $gt: '' } }, { phone: ['4508029892'] },
    { email: 'pas-un-courriel' }, { email: '=cmd|x@a.co ' + 'x'.repeat(300) }
  ];
  for (const b of bad) {
    const r = await call(lead, { body: b });
    assert.equal(r.code, 400, JSON.stringify(b));
  }
  assert.equal(metaCalls.length, 0);
});

test('lead : événement valide, données hachées, champs filtrés', async () => {
  mockEnv();
  const b = good();
  b.firstName = 'Ma\u0000rie\n'; b.fbp = 'pas-un-fbp'; b.fbc = 'fb.1.1700000000000.AbC_d-1';
  b.answers = { type_projet: 'Pirate', probleme: 'chaleur', champ_inconnu: 'x', delai: 12 };
  const r = await call(lead, { headers: { origin: 'https://dvteinte.com' }, body: b });
  assert.equal(r.code, 200); assert.deepEqual(r.json, { success: true });
  assert.equal(metaCalls.length, 1);
  const sent = metaCalls[0].body, ev = sent.data[0], raw = JSON.stringify(sent);
  assert.equal(ev.event_name, 'Lead'); assert.equal(ev.event_id, '123e4567-e89b-12d3-a456-426614174000');
  assert.ok(!raw.includes('4508029892') && !raw.includes('Marie@') && !raw.includes('marie@'), 'aucune donnée personnelle en clair');
  assert.equal(ev.user_data.em[0].length, 64); assert.equal(ev.user_data.ph[0].length, 64);
  assert.equal(ev.user_data.fbp, undefined); assert.equal(ev.user_data.fbc, 'fb.1.1700000000000.AbC_d-1');
  assert.deepEqual(Object.keys(ev.custom_data).sort(), ['content_name', 'delai', 'form_version', 'probleme']);
});

test('lead : identifiant et URL de source douteux ignorés', async () => {
  mockEnv();
  const b = good(); b.eventId = '../../x'; b.eventSourceUrl = 'https://evil.example/';
  await call(lead, { body: b });
  const ev = metaCalls[0].body.data[0];
  assert.equal(ev.event_id, undefined); assert.equal(ev.event_source_url, undefined);
});

test('lead : 429 après 15 appels depuis la même adresse', async () => {
  mockEnv();
  const ip = newIp(); let last;
  for (let i = 0; i < 16; i++) last = await call(lead, { ip, body: good() });
  assert.equal(last.code, 429); assert.ok(last.headers['Retry-After']);
});

test('lead : aucune information interne dans les réponses', async () => {
  mockEnv(); metaFails = true;
  const r = await call(lead, { body: good() });
  assert.deepEqual(Object.keys(r.json), ['success']); assert.equal(r.json.success, false);
  assert.ok(!JSON.stringify(r.json).includes('TOKEN_SECRET_VALUE'));
  mockEnv({ pixel: '' });
  const r2 = await call(lead, { body: good() });
  assert.equal(r2.code, 503); assert.deepEqual(r2.json, { success: false });
});

// ───── /api/capi-qualified-lead (route privée) ─────
test('qualified : fermée sans secret valide (503)', async () => {
  mockEnv({ secret: undefined });
  assert.equal((await call(qualified, { headers: { 'x-api-key': 'x' }, body: good() })).code, 503);
  mockEnv({ secret: 'court' });
  assert.equal((await call(qualified, { headers: { 'x-api-key': 'court' }, body: good() })).code, 503);
});

test('qualified : accès non authentifié refusé (401), secret dans le corps ignoré', async () => {
  mockEnv({ secret: SECRET });
  assert.equal((await call(qualified, { body: good() })).code, 401);
  assert.equal((await call(qualified, { headers: { 'x-api-key': 'mauvais' }, body: good() })).code, 401);
  assert.equal((await call(qualified, { body: Object.assign(good(), { secret: SECRET }) })).code, 401);
  assert.equal((await call(qualified, { headers: { 'x-api-key': SECRET.slice(0, -1) }, body: good() })).code, 401);
  assert.equal(metaCalls.length, 0);
});

test('qualified : bonne clé acceptée, code de test validé', async () => {
  mockEnv({ secret: SECRET });
  const ok = await call(qualified, { headers: { 'x-api-key': SECRET }, body: Object.assign(good(), { testEventCode: 'TEST123' }) });
  assert.equal(ok.code, 200); assert.deepEqual(ok.json, { success: true });
  assert.equal(metaCalls[0].body.data[0].event_name, 'QualifiedLead');
  assert.equal(metaCalls[0].body.test_event_code, 'TEST123');
  await call(qualified, { headers: { 'x-api-key': SECRET }, body: Object.assign(good(), { testEventCode: 'x"; drop' }) });
  assert.equal(metaCalls[1].body.test_event_code, undefined);
});

test('qualified : entrées invalides (400, 415) et 405', async () => {
  mockEnv({ secret: SECRET });
  const h = { 'x-api-key': SECRET };
  assert.equal((await call(qualified, { headers: h, body: { firstName: 'x' } })).code, 400);
  assert.equal((await call(qualified, { headers: h, body: { phone: '123' } })).code, 400);
  assert.equal((await call(qualified, { headers: Object.assign({ 'content-type': 'text/plain' }, h), body: '{}' })).code, 415);
  const g = await call(qualified, { method: 'GET', headers: h });
  assert.equal(g.code, 405); assert.equal(g.headers.Allow, 'POST');
});

test('qualified : 429 après 10 essais, sans fuite d\'information', async () => {
  mockEnv({ secret: SECRET }); metaFails = true;
  const ip = newIp(); let last;
  for (let i = 0; i < 11; i++) last = await call(qualified, { ip, headers: { 'x-api-key': 'faux' }, body: good() });
  assert.equal(last.code, 429);
  const r = await call(qualified, { headers: { 'x-api-key': SECRET }, body: good() });
  assert.equal(r.code, 502); assert.deepEqual(Object.keys(r.json), ['success']);
  assert.ok(!JSON.stringify(r.json).includes('TOKEN_SECRET_VALUE'));
});
