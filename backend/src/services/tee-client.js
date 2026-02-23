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

    return match[1];
  }

  // Step 3: submit credentials to SSO auth endpoint
  async login() {
    let requestId;
    try {
      requestId = await this._getSsoRequestId();
    } catch (err) {
      throw new Error(`Δεν ήταν δυνατή η επικοινωνία με το ΤΕΕ: ${err.message}`);
    }

    const authRes = await fetch(`${SSO_URL}/oam/server/auth_cred_submit`, {
      method: 'POST',
      redirect: 'follow',
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

    // Oracle OAM authentication check.
    //
    // Two possible success paths:
    //   A) Simple HTTP 302 redirect → fetch follows it → authRes.url lands on services.tee.gr
    //   B) FORM POST binding: OAM returns 200 HTML with an auto-submitting <form action="…services.tee.gr…">
    //      Node fetch does NOT auto-submit HTML forms, so authRes.url stays on sso.tee.gr
    //      even on success. We must inspect the body.
    //
    // Failure: OAM returns the login page again with an error message (no services.tee.gr in body).

    const finalUrl = authRes.url || '';
    const responseText = await authRes.text();

    // Path A: redirected to services.tee.gr
    if (finalUrl.includes('services.tee.gr')) {
      return { ok: true };
    }

    // Path B: FORM POST binding — response body has a form pointing to services.tee.gr
    if (responseText.includes('services.tee.gr')) {
      return { ok: true };
    }

    // Failure: still on SSO — attach debug info as a non-enumerable property so
    // the route handler can log it server-side without exposing it to the client.
    const snippet = responseText.slice(0, 400).replace(/\s+/g, ' ');
    const err = new Error('Αδυναμία σύνδεσης στο ΤΕΕ e-Adeies. Ελέγξτε username και κωδικό.');
    err.teeDebug = { finalUrl, bodySnippet: snippet };
    throw err;
  }

  // Fetch list of engineer's applications (after login)
  // The exact REST path for the ADF application needs verification with real credentials.
  async fetchMyApplications() {
    const candidates = [
      `${BASE_URL}/adeia/rest/Aitiseis`,
      `${BASE_URL}/adeia/rest/MyAitiseis`,
      `${BASE_URL}/adeia/rest/applications`,
      `${BASE_URL}/adeia/rest/myapplications`,
      `${BASE_URL}/adeia/faces/myAitiseis`,
      `${BASE_URL}/adeia/faces/aitiseis`,
    ];

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: this._reqHeaders({
            Accept: 'application/json,text/html,*/*;q=0.8',
          }),
          redirect: 'manual', // redirect = session expired or wrong URL
        });

        if (res.status === 301 || res.status === 302) continue;

        if (res.ok) {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const data = await res.json();
            return normalizeApplicationList(data);
          }
        }
      } catch {
        continue;
      }
    }

    throw new Error(
      'Η ανάκτηση αιτήσεων από το ΤΕΕ e-Adeies δεν ήταν δυνατή. ' +
      'Επικοινωνήστε μαζί μας αν το πρόβλημα επιμένει.'
    );
  }

  async fetchApplicationDetails(teeCode) {
    const candidates = [
      `${BASE_URL}/adeia/rest/Aitiseis/${teeCode}`,
      `${BASE_URL}/adeia/rest/applications/${teeCode}`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          headers: this._reqHeaders({ Accept: 'application/json' }),
          redirect: 'manual',
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
