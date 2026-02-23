/**
 * Debug script for TEE OAM SSO login flow.
 * Runs step-by-step and dumps every HTTP response so we can see exactly
 * what Oracle OAM returns.
 *
 * Usage:
 *   node backend/scripts/debug-tee-login.mjs <username> <password>
 */

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: node backend/scripts/debug-tee-login.mjs <username> <password>');
  process.exit(1);
}

const BASE_URL = 'https://services.tee.gr';
const SSO_URL  = 'https://sso.tee.gr';
const UA       = 'OpenAdeia/debug (openadeia.org)';

let cookies = {};

function parseCookies(headers) {
  const out = {};
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') || ''];
  for (const h of raw) {
    const [pair] = h.split(';');
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return out;
}

function cookieHeader() {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

function reqHeaders(extra = {}) {
  const h = {
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8',
    ...extra,
  };
  if (Object.keys(cookies).length) h.Cookie = cookieHeader();
  return h;
}

function dumpResponse(label, res, body) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[${label}]`);
  console.log(`  Status : ${res.status} ${res.statusText}`);
  console.log(`  URL    : ${res.url}`);
  const setCookie = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie') || ''];
  if (setCookie.filter(Boolean).length) {
    console.log(`  Cookies: ${setCookie.join(' | ')}`);
  }
  if (body) {
    const snippet = body.slice(0, 600).replace(/\s+/g, ' ');
    console.log(`  Body   : ${snippet}`);
  }
}

// ── Step 1: GET engineer portal (expect 302 to SSO) ────────────────
console.log('\n=== Step 1: GET services.tee.gr/adeia/faces/main (redirect:manual) ===');
const step1 = await fetch(`${BASE_URL}/adeia/faces/main`, {
  redirect: 'manual',
  headers: reqHeaders(),
});
Object.assign(cookies, parseCookies(step1.headers));
dumpResponse('Step 1', step1, null);

const ssoRedirectUrl = step1.headers.get('location');
console.log(`\n  → SSO redirect URL: ${ssoRedirectUrl}`);

if (!ssoRedirectUrl) {
  console.error('\nERROR: No Location header — portal did not redirect to SSO.');
  console.log('  This means either the portal is down, or it no longer uses OAM SSO.');
  process.exit(1);
}

// ── Step 2: GET SSO login page ─────────────────────────────────────
console.log('\n=== Step 2: GET SSO login page ===');
const step2 = await fetch(ssoRedirectUrl, {
  redirect: 'follow',
  headers: reqHeaders({ Referer: `${BASE_URL}/adeia/faces/main` }),
});
Object.assign(cookies, parseCookies(step2.headers));
const ssoHtml = await step2.text();
dumpResponse('Step 2', step2, ssoHtml);

// Extract request_id
const match = ssoHtml.match(/name=['"]request_id['"]\s+value=['"]([^'"]+)['"]/);
if (!match) {
  console.error('\nERROR: Could not find request_id in SSO form.');
  console.log('  Full HTML (first 2000 chars):');
  console.log(ssoHtml.slice(0, 2000));
  process.exit(1);
}
const rawRequestId = match[1];
// Decode HTML entities (OAM encodes e.g. - as &#45;)
const requestId = rawRequestId
  .replace(/&#(\d+);/g,    (_, n) => String.fromCharCode(parseInt(n, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
console.log(`\n  → request_id (raw)    : ${rawRequestId}`);
console.log(`  → request_id (decoded): ${requestId}`);

// ── Step 3a: POST credentials — DON'T follow redirects ─────────────
console.log('\n=== Step 3a: POST credentials (redirect:manual) ===');
const step3a = await fetch(`${SSO_URL}/oam/server/auth_cred_submit`, {
  method: 'POST',
  redirect: 'manual',
  headers: reqHeaders({
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: `${SSO_URL}/oam/server/obrareq.cgi`,
    Origin: SSO_URL,
  }),
  body: new URLSearchParams({ username, password, request_id: requestId }).toString(),
});
Object.assign(cookies, parseCookies(step3a.headers));
const body3a = await step3a.text();
const location3a = step3a.headers.get('location');
dumpResponse('Step 3a', step3a, body3a);
console.log(`  → Location header: ${location3a}`);

// ── Step 3b: follow the redirect manually ──────────────────────────
if (location3a) {
  console.log('\n=== Step 3b: Follow redirect from Step 3a ===');
  const step3b = await fetch(location3a, {
    redirect: 'manual',
    headers: reqHeaders({ Referer: `${SSO_URL}/oam/server/auth_cred_submit` }),
  });
  Object.assign(cookies, parseCookies(step3b.headers));
  const body3b = await step3b.text();
  const location3b = step3b.headers.get('location');
  dumpResponse('Step 3b', step3b, body3b);
  console.log(`  → Location header: ${location3b}`);

  if (location3b) {
    console.log('\n=== Step 3c: Follow second redirect ===');
    const step3c = await fetch(location3b, {
      redirect: 'manual',
      headers: reqHeaders({ Referer: location3a }),
    });
    Object.assign(cookies, parseCookies(step3c.headers));
    const body3c = await step3c.text();
    const location3c = step3c.headers.get('location');
    dumpResponse('Step 3c', step3c, body3c);
    console.log(`  → Location header: ${location3c}`);
  }
}

// ── Analysis ───────────────────────────────────────────────────────
console.log('\n=== Analysis ===');
console.log(`  Step 3a status    : ${step3a.status}`);
console.log(`  Step 3a location  : ${location3a}`);
if (location3a?.includes('services.tee.gr')) {
  console.log('\n✓ LOGIN SUCCESS — OAM issued 302 redirect to services.tee.gr');
} else if (body3a.includes('services.tee.gr')) {
  console.log('\n✓ LOGIN SUCCESS — FORM POST binding, services.tee.gr in body');
} else {
  console.log('\n✗ LOGIN FAILED — OAM did not redirect to services.tee.gr');
  console.log('  Cookies now set:', Object.keys(cookies).join(', '));
}
