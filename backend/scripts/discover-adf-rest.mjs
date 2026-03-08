#!/usr/bin/env node
/**
 * ADF REST Endpoint Discovery — Probe TEE e-Adeies for hidden REST APIs.
 *
 * Authenticates via OAM SSO, then probes ~50 common Oracle ADF REST URL
 * patterns. Reports every endpoint that returns non-redirect, non-404 responses.
 *
 * Usage:
 *   node backend/scripts/discover-adf-rest.mjs <username> <password>
 *
 * Environment:
 *   TEE_API_BASE  — override base URL (default: https://services.tee.gr)
 *   TEE_SSO_BASE  — override SSO URL  (default: https://sso.tee.gr)
 */

const [,, username, password] = process.argv;
if (!username || !password) {
  console.error('Usage: node backend/scripts/discover-adf-rest.mjs <username> <password>');
  process.exit(1);
}

const BASE_URL = process.env.TEE_API_BASE || 'https://services.tee.gr';
const SSO_URL  = process.env.TEE_SSO_BASE || 'https://sso.tee.gr';
const UA       = 'OpenAdeia/discover (openadeia.org)';

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
  const h = { 'User-Agent': UA, 'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8', ...extra };
  if (Object.keys(cookies).length) h.Cookie = cookieHeader();
  return h;
}

// ── Authenticate via OAM SSO ──────────────────────────────────────────
async function authenticate() {
  console.log('Authenticating with TEE OAM SSO...');

  // Step 1: GET portal → 302 to SSO
  const step1 = await fetch(`${BASE_URL}/adeia/faces/main`, {
    redirect: 'manual', headers: reqHeaders(),
  });
  Object.assign(cookies, parseCookies(step1.headers));

  const ssoUrl = step1.headers.get('location');
  if (!ssoUrl) throw new Error('No SSO redirect — portal may be down');

  // Step 2: GET SSO login page → extract request_id
  const step2 = await fetch(ssoUrl, {
    redirect: 'follow',
    headers: reqHeaders({ Referer: `${BASE_URL}/adeia/faces/main` }),
  });
  Object.assign(cookies, parseCookies(step2.headers));
  const html = await step2.text();

  const match = html.match(/name=['"]request_id['"]\s+value=['"]([^'"]+)['"]/);
  if (!match) throw new Error('Could not find request_id in SSO form');

  const requestId = match[1]
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

  // Step 3: POST credentials
  const step3 = await fetch(`${SSO_URL}/oam/server/auth_cred_submit`, {
    method: 'POST', redirect: 'manual',
    headers: reqHeaders({
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${SSO_URL}/oam/server/obrareq.cgi`,
      Origin: SSO_URL,
    }),
    body: new URLSearchParams({ username, password, request_id: requestId }).toString(),
  });
  Object.assign(cookies, parseCookies(step3.headers));

  const location = step3.headers.get('location') || '';
  if (!location.includes('services.tee.gr')) {
    throw new Error('Login failed — wrong credentials or OAM changed');
  }

  // Follow obrar.cgi redirect to get session cookie
  const step4 = await fetch(location, {
    redirect: 'manual',
    headers: reqHeaders({ Referer: `${SSO_URL}/oam/server/auth_cred_submit` }),
  });
  Object.assign(cookies, parseCookies(step4.headers));

  console.log('Authenticated successfully.\n');
}

// ── Probe a URL ───────────────────────────────────────────────────────
async function probe(url, accept = 'application/json,text/html,*/*;q=0.5') {
  try {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: reqHeaders({ Accept: accept }),
      signal: AbortSignal.timeout(10_000),
    });
    Object.assign(cookies, parseCookies(res.headers));
    const ct = res.headers.get('content-type') || '';
    const loc = res.headers.get('location') || '';
    let body = '';
    if (res.status !== 302 && res.status !== 301) {
      body = (await res.text()).slice(0, 500).replace(/\s+/g, ' ');
    }
    return { url, status: res.status, contentType: ct, location: loc, body };
  } catch (e) {
    return { url, status: 'ERR', error: e.message };
  }
}

// ── Main ──────────────────────────────────────────────────────────────
await authenticate();

// 1. First fetch the main page and extract any referenced URLs
console.log('=== Phase 1: Extracting URLs from main ADF page ===\n');
const mainRes = await fetch(`${BASE_URL}/adeia/faces/main`, {
  redirect: 'follow', headers: reqHeaders(),
});
Object.assign(cookies, parseCookies(mainRes.headers));
const mainHtml = await mainRes.text();

// Extract all referenced paths
const allPaths = [...new Set([
  ...mainHtml.matchAll(/['"]\/adeia\/([^'"?#\s]+)/g),
].map(m => m[1]))];
console.log(`Found ${allPaths.length} referenced paths in main page HTML.`);

const restPaths = allPaths.filter(p => /rest|api|data|service|resource|json|ws/i.test(p));
const facesPaths = allPaths.filter(p => p.startsWith('faces/') && p !== 'faces/main');
console.log(`  REST-like paths: ${restPaths.length}`);
console.log(`  Faces sub-pages: ${facesPaths.length}`);
if (restPaths.length) console.log(`  REST paths: ${restPaths.join(', ')}`);
if (facesPaths.length) console.log(`  Faces paths: ${facesPaths.slice(0, 15).join(', ')}`);

// 2. Probe common ADF REST framework patterns
console.log('\n=== Phase 2: Probing common Oracle ADF REST patterns ===\n');

// Oracle ADF REST resource catalog & common endpoints
const adfRestPaths = [
  // Resource catalogs (ADF 12c+ auto-publishes these)
  '/adeia/rest/',
  '/adeia/rest/v1/',
  '/adeia/rest/v1/describe',
  '/adeia/rest/latest/',
  '/adeia/rest/latest/describe',
  '/adeia/rest/12.1.3/',
  '/adeia/rest/describe',
  // Application-specific REST endpoints (Greek naming conventions)
  '/adeia/rest/v1/Aitiseis',
  '/adeia/rest/v1/Aitiseis/describe',
  '/adeia/rest/Aitiseis',
  '/adeia/rest/v1/Engineers',
  '/adeia/rest/v1/Mihanikos',
  '/adeia/rest/v1/Ekdoseis',
  '/adeia/rest/v1/Documents',
  '/adeia/rest/v1/Eggrafa',
  '/adeia/rest/v1/Properties',
  '/adeia/rest/v1/Akinhta',
  '/adeia/rest/v1/Adeies',
  '/adeia/rest/v1/Owners',
  '/adeia/rest/v1/Idiokthtes',
  '/adeia/rest/v1/Meletes',
  '/adeia/rest/v1/Approvals',
  '/adeia/rest/v1/Ypodomes',
  '/adeia/rest/v1/workflow',
  '/adeia/rest/v1/status',
  // WebLogic/Jersey paths
  '/adeia/resources/',
  '/adeia/resources/application.wadl',
  '/adeia/webservices/',
  '/adeia/ws/',
  '/adeia/api/',
  '/adeia/api/v1/',
  // ADF BC REST endpoints
  '/adeia/persistence/v1/',
  '/adeia/persistence/latest/',
  // SOAP/WSDL discovery
  '/adeia/services/',
  '/adeia/services?wsdl',
  // Oracle specific
  '/adeia/faces/restful/',
  '/adeia/AppModuleService',
  '/adeia/AppModuleService?wsdl',
  // XML upload/import endpoints
  '/adeia/rest/v1/import',
  '/adeia/rest/v1/upload',
  '/adeia/rest/v1/xml',
  '/adeia/rest/v1/xmlImport',
  '/adeia/rest/import',
  '/adeia/rest/upload',
  // Additional REST paths found in HTML
  ...restPaths.map(p => `/adeia/${p}`),
];

const discovered = [];

for (const path of adfRestPaths) {
  const url = `${BASE_URL}${path}`;
  const result = await probe(url);

  const icon = result.status === 200 ? '  ✓' :
               result.status === 403 ? '  ⚠' :
               result.status === 'ERR' ? '  ✗' : '  ·';

  const info = [`${icon} [${result.status}] ${path}`];
  if (result.contentType) info.push(`    content-type: ${result.contentType}`);
  if (result.location) info.push(`    redirect: ${result.location}`);
  if (result.status === 200 && result.body) {
    info.push(`    body: ${result.body.slice(0, 200)}`);
  }
  console.log(info.join('\n'));

  // Collect interesting responses (not 404, not SSO redirect)
  if (result.status !== 404 && result.status !== 'ERR' &&
      !result.location?.includes('sso.tee.gr')) {
    discovered.push(result);
  }
}

// 3. Probe faces sub-pages for data endpoints
console.log('\n=== Phase 3: Probing ADF faces sub-pages ===\n');

for (const path of facesPaths.slice(0, 20)) {
  const url = `${BASE_URL}/adeia/${path}`;
  const result = await probe(url, 'text/html,*/*;q=0.5');
  const icon = result.status === 200 ? '  ✓' : '  ·';
  console.log(`${icon} [${result.status}] /adeia/${path}`);
  if (result.status === 200) {
    discovered.push(result);
  }
}

// 4. Try JSON Accept header on main page (some ADF apps serve JSON when asked)
console.log('\n=== Phase 4: Content negotiation tests ===\n');

for (const accept of ['application/json', 'application/xml', 'application/vnd.oracle.adf.resourcecollection+json']) {
  const result = await probe(`${BASE_URL}/adeia/faces/main`, accept);
  console.log(`  Accept: ${accept}`);
  console.log(`    → [${result.status}] content-type: ${result.contentType}`);
  if (result.status === 200 && result.body) {
    console.log(`    → body: ${result.body.slice(0, 200)}`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('DISCOVERY SUMMARY');
console.log('═'.repeat(60));
console.log(`\nTotal endpoints probed: ${adfRestPaths.length + facesPaths.slice(0, 20).length + 3}`);
console.log(`Interesting responses (non-404): ${discovered.length}`);

if (discovered.length > 0) {
  console.log('\nEndpoints that responded:');
  for (const d of discovered) {
    console.log(`  [${d.status}] ${d.url}`);
    if (d.contentType?.includes('json')) {
      console.log(`    ★ JSON endpoint — potential REST API!`);
    }
    if (d.contentType?.includes('xml') && !d.contentType?.includes('html')) {
      console.log(`    ★ XML endpoint — potential SOAP/REST API!`);
    }
  }
} else {
  console.log('\nNo REST endpoints discovered. The portal likely has no exposed APIs.');
  console.log('Consider using the XHR interceptor script to capture runtime API calls.');
}

console.log('\nDone.');
