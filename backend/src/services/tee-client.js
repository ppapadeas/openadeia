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

  // Fetch list of engineer's applications (after login).
  // The TEE portal (services.tee.gr/adeia) is an Oracle ADF JSF application.
  // It does not expose a standard REST API — all guessed REST paths return 404.
  // The data is rendered via JavaScript (ADF PPR), so we scrape the authenticated
  // main page HTML and look for any server-side-rendered permit rows.
  async fetchMyApplications() {
    const TIMEOUT = 12_000; // 12 s per request — avoid indefinite hangs

    // ── Step 1: scrape the authenticated ADF main page ──────────────
    let mainHtml = '';
    try {
      const res = await fetch(`${BASE_URL}/adeia/faces/main`, {
        redirect: 'follow',
        headers: this._reqHeaders({ Accept: 'text/html,*/*' }),
        signal: AbortSignal.timeout(TIMEOUT),
      });
      this._storeCookies(res);
      if (res.ok) mainHtml = await res.text();
    } catch { /* timeout or network error — fall through to REST attempt */ }

    // ── Step 2: parse server-side rendered ADF table rows ──────────
    // Oracle ADF renders visible table rows as <tr> in the initial HTML.
    // Each row for a permit typically contains the permit code (αριθμός άδειας).
    if (mainHtml) {
      const rows = parseAdfPermitRows(mainHtml);
      if (rows.length > 0) return rows;
    }

    // ── Step 3: try any JSON REST endpoint that might exist ─────────
    const restCandidates = [
      `${BASE_URL}/adeia/rest/v1/Aitiseis`,
      `${BASE_URL}/adeia/rest/v2/Aitiseis`,
      `${BASE_URL}/adeia/rest/latest/Aitiseis`,
    ];
    for (const url of restCandidates) {
      try {
        const res = await fetch(url, {
          headers: this._reqHeaders({ Accept: 'application/json,*/*;q=0.5' }),
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT),
        });
        if (res.status >= 300) continue;
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          return normalizeApplicationList(await res.json());
        }
      } catch { continue; }
    }

    throw new Error(
      'Η σύνδεση στο ΤΕΕ e-Adeies ήταν επιτυχής, αλλά δεν ήταν δυνατή η αυτόματη ' +
      'ανάκτηση της λίστας αιτήσεων (το portal χρησιμοποιεί JavaScript για την ' +
      'φόρτωση δεδομένων). Εισάγετε τις άδειές σας χειροκίνητα ή επικοινωνήστε μαζί μας.'
    );
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

// ── Parse server-side rendered ADF table rows ─────────────────────
// Oracle ADF renders the first visible rows as <tr> elements even before JS runs.
// Rows for permits contain a numeric/alphanumeric permit code cell.
function parseAdfPermitRows(html) {
  const rows = [];
  // Match <tr> elements that contain what looks like a permit code (digits + slashes)
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  for (const rowMatch of html.matchAll(rowRe)) {
    const cells = [...rowMatch[1].matchAll(cellRe)].map(
      m => m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim()
    ).filter(Boolean);

    if (cells.length < 2) continue;
    // Heuristic: a permit row has a cell that looks like a TEE permit code
    // e.g. "2024/12345" or a long numeric string
    const codeCell = cells.find(c => /^\d{4}\/\d+$/.test(c) || /^\d{6,}$/.test(c));
    if (!codeCell) continue;

    rows.push({
      tee_permit_code: codeCell,
      title: cells.find(c => c !== codeCell && c.length > 5) || `Αδεια ΤΕΕ ${codeCell}`,
      aitisi_type_code: null,
      yd_id: null, dimos_aa: null,
      address: '', city: '', kaek: '',
      tee_status: cells.find(c => /εκδ|εγκρ|ελεγχ|υποβολ|υπογρ/i.test(c)) || '',
      tee_status_code: '',
      tee_submission_date: null,
      is_continuation: false,
      _raw: cells,
    });
  }
  return rows;
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
