#!/usr/bin/env node
/**
 * ADF XHR Traffic Interceptor — Capture all network requests while navigating
 * the TEE e-Adeies Oracle ADF portal.
 *
 * Uses Playwright to log in, then navigates through portal pages while
 * intercepting every XHR/fetch/document request. This reveals internal API
 * calls that ADF makes (PPR partial page renders, REST calls, data fetches).
 *
 * Usage:
 *   node backend/scripts/intercept-adf-xhr.mjs <username> <password> [--headed]
 *
 * Options:
 *   --headed  Run with visible browser window (useful for manual exploration)
 *
 * Environment:
 *   TEE_API_BASE  — override base URL (default: https://services.tee.gr)
 *   CHROMIUM_EXECUTABLE_PATH — path to Chromium binary
 */

import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const [username, password] = args.filter(a => !a.startsWith('--'));

if (!username || !password) {
  console.error('Usage: node backend/scripts/intercept-adf-xhr.mjs <username> <password> [--headed]');
  process.exit(1);
}

const BASE_URL = process.env.TEE_API_BASE || 'https://services.tee.gr';
const UA       = 'OpenAdeia/discover (openadeia.org)';

// ── Import Playwright ─────────────────────────────────────────────────
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error('Playwright not available. Run: npm install playwright-core');
  process.exit(1);
}

// ── Captured traffic ──────────────────────────────────────────────────
const capturedRequests = [];
const capturedResponses = [];
const discoveredEndpoints = new Map(); // url -> { method, status, contentType, responseSize }

function categorize(url) {
  if (url.includes('/rest/'))      return 'REST';
  if (url.includes('/ws/'))        return 'WebService';
  if (url.includes('/services/'))  return 'SOAP';
  if (url.includes('/api/'))       return 'API';
  if (url.includes('_adf'))        return 'ADF-PPR';
  if (url.match(/\.json|\.xml/))   return 'Data';
  if (url.includes('/faces/'))     return 'JSF';
  return 'Other';
}

// ── Main ──────────────────────────────────────────────────────────────
console.log('Launching browser...');
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
    : {}),
  headless: !headed,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

try {
  const context = await browser.newContext({ userAgent: UA, locale: 'el-GR' });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  // ── Intercept all requests ────────────────────────────────────────
  page.on('request', (req) => {
    const url = req.url();
    const method = req.method();
    const type = req.resourceType();

    // Skip static assets
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) return;

    const entry = {
      method,
      url,
      type,
      category: categorize(url),
      headers: req.headers(),
      postData: req.postData()?.slice(0, 1000) || null,
      timestamp: new Date().toISOString(),
    };
    capturedRequests.push(entry);

    // Log interesting requests live
    if (entry.category !== 'Other' || type === 'xhr' || type === 'fetch') {
      console.log(`  → [${method}] ${entry.category} ${url.slice(0, 120)}`);
      if (entry.postData) {
        console.log(`    POST data: ${entry.postData.slice(0, 200)}`);
      }
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    const status = res.status();
    const ct = res.headers()['content-type'] || '';
    const req = res.request();
    const type = req.resourceType();

    if (['image', 'stylesheet', 'font', 'media'].includes(type)) return;

    let bodySnippet = '';
    if ((ct.includes('json') || ct.includes('xml')) && !ct.includes('html')) {
      try {
        const body = await res.text();
        bodySnippet = body.slice(0, 500);
      } catch { /* response may be opaque */ }
    }

    const entry = {
      url, status, contentType: ct,
      method: req.method(),
      category: categorize(url),
      bodySnippet,
      timestamp: new Date().toISOString(),
    };
    capturedResponses.push(entry);

    // Track unique endpoints
    const key = `${req.method()} ${new URL(url).pathname}`;
    if (!discoveredEndpoints.has(key)) {
      discoveredEndpoints.set(key, { method: req.method(), url, status, contentType: ct });
    }

    // Highlight data responses
    if (ct.includes('json') || (ct.includes('xml') && !ct.includes('html'))) {
      console.log(`  ★ [${status}] ${ct} ← ${url.slice(0, 120)}`);
      if (bodySnippet) console.log(`    body: ${bodySnippet.slice(0, 200)}`);
    }
  });

  // ── Step 1: Login ─────────────────────────────────────────────────
  console.log('\n=== Step 1: Logging in via OAM SSO ===\n');
  await page.goto(`${BASE_URL}/adeia/faces/main`, { waitUntil: 'domcontentloaded' });

  if (page.url().includes('sso.tee.gr')) {
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await Promise.all([
      page.waitForURL(url => !url.includes('sso.tee.gr'), { timeout: 25_000 }).catch(() => null),
      page.press('input[name="password"]', 'Enter'),
    ]);

    if (page.url().includes('sso.tee.gr')) {
      console.error('Login failed — wrong credentials.');
      process.exit(1);
    }
  }

  console.log('Logged in. Waiting for ADF to render...\n');
  await page.waitForLoadState('networkidle', { timeout: 35_000 });
  console.log(`Current URL: ${page.url()}\n`);

  // ── Step 2: Navigate through portal pages ─────────────────────────
  console.log('=== Step 2: Navigating portal pages to capture XHR traffic ===\n');

  // Extract all clickable navigation elements
  const navLinks = await page.evaluate(() => {
    const links = [];
    // ADF navigation: menu items, tabs, toolbar buttons
    const selectors = [
      'a[href*="faces"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '.af_navigationPane_tab',
      '.af_commandLink',
      '.af_commandButton',
      'a.af_link',
      'nav a', '.menu a', '.nav a',
      '[id*="nav" i] a',
      '[id*="menu" i] a',
    ];
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) {
        const text = (el.innerText || '').trim().slice(0, 50);
        const href = el.getAttribute('href') || '';
        const id = el.id || '';
        if (text || href || id) {
          links.push({ text, href, id, tag: el.tagName });
        }
      }
    }
    return links;
  });

  console.log(`Found ${navLinks.length} navigation elements:\n`);
  for (const link of navLinks.slice(0, 30)) {
    console.log(`  [${link.tag}] "${link.text}" href="${link.href}" id="${link.id}"`);
  }

  // Click through navigation items to trigger ADF PPR/XHR calls
  console.log('\n=== Step 3: Clicking navigation items to trigger XHR ===\n');

  const clickedPages = new Set();
  for (const link of navLinks.slice(0, 15)) {
    const key = link.text || link.href || link.id;
    if (clickedPages.has(key) || !key) continue;
    clickedPages.add(key);

    console.log(`\n--- Clicking: "${key}" ---`);
    try {
      let selector;
      if (link.id) selector = `#${CSS.escape(link.id)}`;
      else if (link.text) selector = `${link.tag.toLowerCase()}:has-text("${link.text}")`;
      else continue;

      const el = await page.$(selector);
      if (!el || !await el.isVisible()) continue;

      const requestsBefore = capturedRequests.length;
      await el.click();
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

      const newRequests = capturedRequests.length - requestsBefore;
      console.log(`  → ${newRequests} new network requests captured`);
    } catch (e) {
      console.log(`  → Click failed: ${e.message.slice(0, 100)}`);
    }
  }

  // ── Step 4: Try direct REST probes from authenticated browser ─────
  console.log('\n=== Step 4: Probing REST endpoints from authenticated browser ===\n');

  const restProbes = [
    '/adeia/rest/',
    '/adeia/rest/v1/',
    '/adeia/rest/v1/describe',
    '/adeia/rest/v1/Aitiseis',
    '/adeia/rest/describe',
    '/adeia/rest/latest/',
    '/adeia/resources/',
    '/adeia/resources/application.wadl',
    '/adeia/api/',
    '/adeia/services/',
  ];

  for (const path of restProbes) {
    try {
      const response = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url, {
            credentials: 'include',
            headers: { 'Accept': 'application/json,application/xml,*/*' },
          });
          const ct = res.headers.get('content-type') || '';
          const body = await res.text();
          return { status: res.status, contentType: ct, body: body.slice(0, 500), url: res.url };
        } catch (e) {
          return { status: 'ERR', error: e.message, url };
        }
      }, `${BASE_URL}${path}`);

      const icon = response.status === 200 ? '✓' : response.status === 403 ? '⚠' : '·';
      console.log(`  ${icon} [${response.status}] ${path} (${response.contentType || 'n/a'})`);
      if (response.status === 200 && response.body) {
        console.log(`    body: ${response.body.slice(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ✗ ${path} — ${e.message.slice(0, 100)}`);
    }
  }

  // ── If headed mode, pause for manual exploration ───────────────────
  if (headed) {
    console.log('\n=== HEADED MODE: Browser is open for manual exploration ===');
    console.log('Navigate the portal manually. All XHR traffic is being captured.');
    console.log('Press Ctrl+C to stop and see the report.\n');

    // Keep alive until Ctrl+C
    await new Promise((resolve) => {
      process.on('SIGINT', resolve);
    });
  }

  // ── Report ────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('INTERCEPTOR REPORT');
  console.log('═'.repeat(60));

  console.log(`\nTotal requests captured: ${capturedRequests.length}`);
  console.log(`Total responses captured: ${capturedResponses.length}`);
  console.log(`Unique endpoints: ${discoveredEndpoints.size}`);

  // Group by category
  const byCategory = {};
  for (const req of capturedRequests) {
    byCategory[req.category] = (byCategory[req.category] || 0) + 1;
  }
  console.log('\nRequests by category:');
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Highlight data endpoints (JSON/XML)
  const dataEndpoints = capturedResponses.filter(r =>
    (r.contentType?.includes('json') || (r.contentType?.includes('xml') && !r.contentType?.includes('html')))
  );
  if (dataEndpoints.length > 0) {
    console.log('\n★ DATA ENDPOINTS (JSON/XML responses):');
    const seen = new Set();
    for (const ep of dataEndpoints) {
      const key = `${ep.method} ${new URL(ep.url).pathname}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  [${ep.status}] ${ep.method} ${ep.url}`);
      console.log(`    content-type: ${ep.contentType}`);
      if (ep.bodySnippet) console.log(`    body: ${ep.bodySnippet.slice(0, 300)}`);
    }
  }

  // XHR requests with POST data (form submissions, API calls)
  const postRequests = capturedRequests.filter(r => r.method === 'POST' && r.postData);
  if (postRequests.length > 0) {
    console.log('\n★ POST REQUESTS WITH DATA:');
    const seen = new Set();
    for (const req of postRequests) {
      const key = new URL(req.url).pathname;
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(`  POST ${req.url.slice(0, 120)}`);
      console.log(`    data: ${req.postData.slice(0, 300)}`);
    }
  }

  // All unique endpoints
  console.log('\n★ ALL UNIQUE ENDPOINTS:');
  for (const [key, info] of [...discoveredEndpoints.entries()].sort()) {
    console.log(`  [${info.status}] ${key} (${info.contentType || 'n/a'})`);
  }

  // Save full report to JSON
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalRequests: capturedRequests.length,
    totalResponses: capturedResponses.length,
    uniqueEndpoints: Object.fromEntries(discoveredEndpoints),
    dataEndpoints: dataEndpoints.map(e => ({
      url: e.url, method: e.method, status: e.status,
      contentType: e.contentType, body: e.bodySnippet,
    })),
    postRequests: postRequests.map(r => ({
      url: r.url, postData: r.postData, category: r.category,
    })),
    allRequests: capturedRequests,
  };

  const reportPath = `tee-discovery-report-${Date.now()}.json`;
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report saved to: ${reportPath}`);

} finally {
  await browser.close();
}

console.log('\nDone.');
