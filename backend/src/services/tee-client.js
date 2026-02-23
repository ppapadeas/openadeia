/**
 * TEE e-Adeies portal client
 *
 * Authentication flow (Oracle OAM SSO):
 *   1. GET https://services.tee.gr/adeia/faces/main
 *      -> 302 to https://sso.tee.gr/oam/server/obrareq.cgi?encquery=...
 *      -> collects OAMAuthnHintCookie + OAMRequestContext cookies
 *   2. GET that SSO URL -> 200 HTML with login form, hidden input request_id
 *   3. POST sso.tee.gr/oam/server/auth_cred_submit  { username, password, request_id }
 *      -> success: 302 redirect back to services.tee.gr (finalUrl check)
 *      -> failure: stays on sso.tee.gr (finalUrl still contains sso.tee.gr)
 */

const BASE_URL   = process.env.TEE_API_BASE || 'https://services.tee.gr';
const SSO_URL    = process.env.TEE_SSO_BASE || 'https://sso.tee.gr';
const USER_AGENT = 'OpenAdeia/1.2 (openadeia.org)';

// ── Cookie helpers ─────────────────────────────────────────────────

function parseCookies(headers) {
  const cookies = {};
  // Node 18+ fetch: headers.getSetCookie() returns an array
  const raw = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') || ''];

  for (const header of raw) {
    const [pair] = header.split(';');
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name  = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── TeeClient ─────────────────────────────────────────────────────

export class TeeClient {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.cookies  = {};
  }

  _reqHeaders(extra = {}) {
    const h = {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8',
      ...extra,
    };
    if (Object.keys(this.cookies).length) {
      h.Cookie = cookieHeader(this.cookies);
    }
    return h;
  }

  _storeCookies(res) {
    Object.assign(this.cookies, parseCookies(res.headers));
  }

  // Step 1+2: request engineer portal -> follow SSO redirect -> extract request_id
  async _getSsoRequestId() {
    // Don't follow the redirect automatically — we need the Location URL
    const init = await fetch(`${BASE_URL}/adeia/faces/main`, {
      redirect: 'manual',
      headers: this._reqHeaders(),
    });
    this._storeCookies(init);

    const ssoRedirectUrl = init.headers.get('location');
    if (!ssoRedirectUrl) {
      throw new Error('Αναμενόταν SSO redirect αλλά δεν ελήφθη. Δοκιμάστε ξανά.');
    }

    // Follow the SSO redirect to get the login form
    const ssoPage = await fetch(ssoRedirectUrl, {
      redirect: 'follow',
      headers: this._reqHeaders({ Referer: `${BASE_URL}/adeia/faces/main` }),
    });
    this._storeCookies(ssoPage);

    const html = await ssoPage.text();

    // Extract the hidden request_id field value
    const match = html.match(/name=['"]request_id['"]\s+value=['"]([^'"]+)['"]/);
    if (!match) {
      // Save partial HTML for debugging
      const preview = html.slice(0, 500).replace(/\s+/g, ' ');
      throw new Error(`Δεν βρέθηκε request_id στη φόρμα SSO. Απόκριση: ${preview}`);
    }

    // OAM HTML-encodes the value (e.g. &#45; → -). Decode before use.
    return match[1]
      .replace(/&#(\d+);/g,    (_, n) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  }

  // Step 3: submit credentials to SSO auth endpoint
  async login() {
    let requestId;
    try {
      requestId = await this._getSsoRequestId();
    } catch (err) {
      throw new Error(`Δεν ήταν δυνατή η επικοινωνία με το ΤΕΕ: ${err.message}`);
    }

    // Use redirect:manual so we can carry our managed cookies through each hop.
    // With redirect:follow, Node fetch doesn't send our Cookie headers on the
    // intermediate requests, so the session cookie set by obrar.cgi gets lost.
    const authRes = await fetch(`${SSO_URL}/oam/server/auth_cred_submit`, {
      method: 'POST',
      redirect: 'manual',
      headers: this._reqHeaders({
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${SSO_URL}/oam/server/obrareq.cgi`,
        Origin: SSO_URL,
      }),
      body: new URLSearchParams({
        username:   this.username,
        password:   this.password,
        request_id: requestId,
      }).toString(),
    });
    this._storeCookies(authRes);

    // OAM success: 302 → services.tee.gr/obrar.cgi?encreply=...
    // OAM failure: 200 → login page with error message (wrong credentials)
    const obarLocation = authRes.headers.get('location') || '';
    if (!obarLocation.includes('services.tee.gr')) {
      const body = await authRes.text();
      const snippet = body.slice(0, 400).replace(/\s+/g, ' ');
      const err = new Error('Αδυναμία σύνδεσης στο ΤΕΕ e-Adeies. Ελέγξτε username και κωδικό.');
      err.teeDebug = { status: authRes.status, location: obarLocation, bodySnippet: snippet };
      throw err;
    }

    // Follow obrar.cgi manually — it sets the services.tee.gr session cookie.
    // We don't need to follow further; we now hold the authenticated session.
    const obarRes = await fetch(obarLocation, {
      redirect: 'manual',
      headers: this._reqHeaders({ Referer: `${SSO_URL}/oam/server/auth_cred_submit` }),
    });
    this._storeCookies(obarRes);
  }

  // Fetch list of engineer's applications from the TEE e-Adeies portal.
  //
  // The portal (services.tee.gr/adeia) is an Oracle ADF 12c JSF application that
  // renders all permit data via JavaScript (ADF PPR/XHR). There is no REST API.
  // We use a headless Chromium browser (via playwright-core) to:
  //   1. Navigate to the portal (OAM SSO redirects to login page)
  //   2. Fill credentials and submit
  //   3. Wait for ADF to finish loading the permit table
  //   4. Extract rows from the fully-rendered DOM
  //
  // Throws err.credentialError = true when credentials are rejected by OAM.
  async fetchMyApplications() {
    let chromium;
    try {
      ({ chromium } = await import('playwright-core'));
    } catch {
      throw new Error('Playwright δεν είναι διαθέσιμο στον server. Επικοινωνήστε με τη διαχείριση.');
    }

    const executablePath =
      process.env.CHROMIUM_EXECUTABLE_PATH ||
      '/usr/bin/chromium-browser';

    let browser;
    try {
      browser = await chromium.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    } catch (e) {
      throw new Error(`Αδυναμία εκκίνησης headless browser: ${e.message}`);
    }

    try {
      const context = await browser.newContext({ userAgent: USER_AGENT, locale: 'el-GR' });
      const page    = await context.newPage();
      page.setDefaultTimeout(30_000);

      // Navigate to the ADF portal — OAM SSO will redirect to the login page
      await page.goto(`${BASE_URL}/adeia/faces/main`, { waitUntil: 'domcontentloaded' });

      // If we landed on the SSO login page, authenticate
      if (page.url().includes('sso.tee.gr')) {
        await page.fill('input[name="username"]', this.username);
        await page.fill('input[name="password"]', this.password);
        await Promise.all([
          page.waitForURL(url => !url.includes('sso.tee.gr'), { timeout: 25_000 })
            .catch(() => null), // resolve even if we time out; we check url below
          page.press('input[name="password"]', 'Enter'),
        ]);

        // Still on SSO page → wrong credentials
        if (page.url().includes('sso.tee.gr')) {
          const err = new Error('Αδυναμία σύνδεσης στο ΤΕΕ e-Adeies. Ελέγξτε username και κωδικό.');
          err.credentialError = true;
          throw err;
        }
      }

      // Wait for the ADF application to fully render (all XHR complete)
      await page.waitForLoadState('networkidle', { timeout: 35_000 });

      // Extract permit rows from the rendered table DOM
      const isPermitCode = (c) => /^\d{4}\/\d+$/.test(c) || /^\d{6,}$/.test(c);

      const rows = await page.evaluate(() => {
        /* global document -- this callback runs inside the browser, not Node.js */
        function isPermitCode(c) {
          return /^\d{4}\/\d+$/.test(c) || /^\d{6,}$/.test(c);
        }
        const results = [];
        for (const tr of document.querySelectorAll('tr')) {
          const cells = [...tr.querySelectorAll('td')]
            .map(td => (td.innerText || '').trim())
            .filter(Boolean);
          if (cells.length < 2) continue;
          if (!cells.some(isPermitCode)) continue;
          results.push(cells);
        }
        return results;
      });

      if (rows.length === 0) {
        throw new Error(
          'Η σύνδεση στο ΤΕΕ e-Adeies ήταν επιτυχής, αλλά δεν βρέθηκαν αιτήσεις. ' +
          'Εάν έχετε καταχωρημένες άδειες, επικοινωνήστε μαζί μας.'
        );
      }

      return rows.map(cells => {
        const code = cells.find(isPermitCode);
        return {
          tee_permit_code: code,
          title: cells.find(c => c !== code && c.length > 5) || `Αδεια ΤΕΕ ${code}`,
          aitisi_type_code: null,
          yd_id: null, dimos_aa: null,
          address: '', city: '', kaek: '',
          tee_status: cells.find(c => /εκδ|εγκρ|ελεγχ|υποβολ|υπογρ/i.test(c)) || '',
          tee_status_code: '',
          tee_submission_date: null,
          is_continuation: false,
          _raw: cells,
        };
      });
    } finally {
      await browser.close();
    }
  }

  async fetchApplicationDetails(teeCode) {
    const candidates = [
      `${BASE_URL}/adeia/rest/v1/Aitiseis/${teeCode}`,
      `${BASE_URL}/adeia/rest/Aitiseis/${teeCode}`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: this._reqHeaders({ Accept: 'application/json' }),
          redirect: 'manual',
          signal: AbortSignal.timeout(12_000),
        });
        if (res.ok && (res.headers.get('content-type') || '').includes('json')) {
          return normalizeApplication(await res.json());
        }
      } catch { continue; }
    }
    return null;
  }
}

// ── Normalize TEE API responses to our schema ─────────────────────

function normalizeApplicationList(data) {
  const items = Array.isArray(data) ? data
    : (data.items || data.content || data.data || data.aitiseis || []);
  return items.map(normalizeApplication);
}

function normalizeApplication(item) {
  return {
    tee_permit_code: String(
      item.codeAdeias || item.code_adeias || item.permitCode || item.aitisiCode ||
      item.code || item.id || ''
    ),
    title:
      item.titleAdeias || item.title || item.perigrafi || item.descr ||
      `Αδεια ΤΕΕ ${item.codeAdeias || item.id || ''}`,
    aitisi_type_code: Number(item.aitisiType || item.aitisi_type || item.typeCode || 0) || null,
    yd_id:    Number(item.ydId    || item.yd_id    || 0) || null,
    dimos_aa: Number(item.dimosAa || item.dimos_aa || 0) || null,
    address:  item.address || item.addr || item.dieuthinsi || '',
    city:     item.city    || item.poli || item.dimos      || '',
    kaek:     item.kaek    || item.KAEK || '',
    tee_status:          item.status     || item.katastasi     || '',
    tee_status_code:     item.statusCode || item.katastasiCode || '',
    tee_submission_date: item.submissionDate || item.dateSubmit || item.hmerominia || null,
    is_continuation: Boolean(
      item.prevPraxis || item.prev_praxis || item.isContinuation ||
      (item.aitisiType && [2, 3, 4].includes(Number(item.aitisiType)))
    ),
    _raw: item,
  };
}

// ── Map TEE status -> our workflow stage ──────────────────────────
export function teeStatusToStage(teeStatus, teeStatusCode) {
  // Use normalised (NFD) comparison to handle accented Greek correctly
  const norm = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const s = norm(teeStatus);
  const c = String(teeStatusCode || '');
  if (s.includes('εγκρ') || s.includes('εκδο') || c === '5') return 'approved';
  if (s.includes('ελεγχ')                       || c === '4') return 'review';
  if (s.includes('υποβολ') || s.includes('submit') || c === '3') return 'submission';
  if (s.includes('υπογραφ')                     || c === '2') return 'signatures';
  if (s.includes('μελετ')                       || c === '1') return 'studies';
  return 'data_collection';
}

// ── Map TEE aitisi_type_code -> our permit type ───────────────────
export function teeTypeCodeToPermitType(aitisiTypeCode, isContinuation) {
  if (isContinuation) {
    const code = Number(aitisiTypeCode);
    if (code === 3) return 'file_update';
    if (code === 4) return 'revision_ext';
    return 'revision';
  }
  const code = Number(aitisiTypeCode);
  if (code === 1)               return 'new_building';
  if (code === 5 || code === 6) return 'minor_cat1';
  if (code === 7 || code === 8) return 'minor_cat2';
  if (code === 9)               return 'vod';
  if (code === 10)              return 'preapproval';
  return 'new_building';
}
