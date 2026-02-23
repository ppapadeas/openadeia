/**
 * TEE e-Adeies portal client
 * Authenticates with https://eadeies.tee.gr and fetches the engineer's
 * existing permit applications.
 *
 * The portal uses cookie-based session auth. After POST /login we keep
 * the JSESSIONID / XSRF-TOKEN cookie and use it for subsequent calls.
 */

const BASE_URL = process.env.TEE_API_BASE || 'https://eadeies.tee.gr';

// ── Helpers ────────────────────────────────────────────────────────

function parseCookies(headers) {
  const raw = headers.get('set-cookie') || '';
  const cookies = {};
  // Multiple Set-Cookie headers come concatenated with commas in some runtimes
  // Use a simple split on ';' per cookie directive
  for (const part of raw.split(/,(?=[^;]+=[^;]+)/)) {
    const [pair] = part.trim().split(';');
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

function cookieHeader(cookies) {
  return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── TEE Client ─────────────────────────────────────────────────────

export class TeeClient {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.cookies = {};
    this.csrfToken = null;
  }

  _headers(extra = {}) {
    const h = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'OpenAdeia/1.1 (openadeia.org)',
      ...extra,
    };
    if (Object.keys(this.cookies).length) {
      h.Cookie = cookieHeader(this.cookies);
    }
    if (this.csrfToken) {
      h['X-XSRF-TOKEN'] = this.csrfToken;
    }
    return h;
  }

  _storeCookies(response) {
    const incoming = parseCookies(response.headers);
    Object.assign(this.cookies, incoming);
    if (incoming['XSRF-TOKEN']) this.csrfToken = incoming['XSRF-TOKEN'];
  }

  async _fetch(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      redirect: 'follow',
      ...options,
      headers: this._headers(options.headers || {}),
    });
    this._storeCookies(res);
    return res;
  }

  // ── Step 1: get the login page to collect any initial CSRF token ──
  async _primeSession() {
    try {
      await this._fetch('/login');
    } catch {
      // Ignore — just collecting cookies
    }
  }

  // ── Step 2: authenticate ──────────────────────────────────────────
  async login() {
    await this._primeSession();

    // Try JSON login (most modern portals)
    const res = await this._fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: this.username, password: this.password }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.token) {
        this.cookies['Authorization'] = `Bearer ${data.token}`;
        this.bearerToken = data.token;
      }
      return { ok: true };
    }

    // Fallback: form-encoded login (older portals)
    const formRes = await this._fetch('/j_spring_security_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        j_username: this.username,
        j_password: this.password,
        _spring_security_remember_me: 'on',
      }).toString(),
    });

    // If we get a redirect away from /login, we're authenticated
    const finalUrl = formRes.url || '';
    if (!finalUrl.includes('/login')) {
      return { ok: true };
    }

    // Last attempt: username/password JSON with different endpoint
    const alt = await this._fetch('/rest/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: this.username, password: this.password }),
    });

    if (alt.ok) return { ok: true };

    throw new Error('Αδυναμία σύνδεσης στο ΤΕΕ e-Adeies. Ελέγξτε το username/password.');
  }

  // ── Step 3: fetch list of engineer's applications ────────────────
  async fetchMyApplications() {
    const endpoints = [
      '/api/myApps',
      '/api/engineer/myApps',
      '/api/apps/my',
      '/rest/api/myApps',
      '/api/aitiseis/mou',
      '/api/engineer/applications',
    ];

    for (const ep of endpoints) {
      try {
        const res = await this._fetch(ep);
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
      'Δεν ήταν δυνατή η ανάκτηση αιτήσεων από το ΤΕΕ e-Adeies. ' +
      'Το API endpoint ενδέχεται να έχει αλλάξει.'
    );
  }

  // ── Step 4: fetch details of a single application ────────────────
  async fetchApplicationDetails(teeCode) {
    const endpoints = [
      `/api/myApps/${teeCode}`,
      `/api/apps/${teeCode}`,
      `/rest/api/apps/${teeCode}`,
    ];

    for (const ep of endpoints) {
      try {
        const res = await this._fetch(ep);
        if (res.ok) {
          const data = await res.json();
          return normalizeApplication(data);
        }
      } catch {
        continue;
      }
    }

    return null;
  }
}

// ── Normalize TEE API responses to our schema ─────────────────────
// These normalizers handle the most common TEE API response shapes.
// The exact field names may need adjustment once the live API is confirmed.

function normalizeApplicationList(data) {
  // Handle array directly or wrapped in a property
  const items = Array.isArray(data) ? data
    : (data.content || data.data || data.items || data.aitiseis || data.apps || []);

  return items.map(normalizeApplication);
}

function normalizeApplication(item) {
  // Map common TEE field names to our schema
  return {
    // TEE permit code (κωδικός πράξης)
    tee_permit_code: String(
      item.codeAdeias || item.code_adeias || item.permitCode || item.aitisiCode ||
      item.code || item.id || ''
    ),
    // Title / description
    title: item.titleAdeias || item.title || item.perigrafi || item.descr ||
           item.projectTitle || `Άδεια ${item.codeAdeias || item.id || ''}`,
    // AITISI_TYPE code (integer)
    aitisi_type_code: Number(item.aitisiType || item.aitisi_type || item.typeCode || 0) || null,
    // YD_ID (Υπηρεσία Δόμησης)
    yd_id: Number(item.ydId || item.yd_id || item.ypiresiaDomisis || 0) || null,
    // DIMOS_AA (municipality code)
    dimos_aa: Number(item.dimosAa || item.dimos_aa || item.dimosId || 0) || null,
    // Address fields
    address: item.address || item.addr || item.dieuthinsi || '',
    city: item.city || item.poli || item.dimos || '',
    // KAEK
    kaek: item.kaek || item.KAEK || '',
    // Status/stage from TEE
    tee_status: item.status || item.katastasi || item.statusDescr || '',
    tee_status_code: item.statusCode || item.katastasiCode || '',
    // Submission date
    tee_submission_date: item.submissionDate || item.dateSubmit || item.hmerominia || null,
    // Is it a new act or continuation?
    is_continuation: Boolean(
      item.prevPraxis || item.prev_praxis || item.isContinuation ||
      (item.aitisiType && [2, 3, 4].includes(Number(item.aitisiType)))
    ),
    // Raw data for reference
    _raw: item,
  };
}

// ── Map TEE status to our workflow stage ──────────────────────────
export function teeStatusToStage(teeStatus, teeStatusCode) {
  const s = (teeStatus || '').toLowerCase();
  const c = String(teeStatusCode || '');

  if (s.includes('εγκρίθ') || s.includes('εκδόθ') || c === '5') return 'approved';
  if (s.includes('έλεγχ') || s.includes('review') || c === '4') return 'review';
  if (s.includes('υποβολ') || s.includes('submit') || c === '3') return 'submission';
  if (s.includes('υπογραφ') || c === '2') return 'signatures';
  if (s.includes('μελέτ') || c === '1') return 'studies';
  return 'data_collection';
}

// ── Map TEE aitisi_type_code to our permit type string ────────────
// These are approximate mappings — adjust as real codes become known.
export function teeTypeCodeToPermitType(aitisiTypeCode, isContinuation) {
  if (isContinuation) {
    const code = Number(aitisiTypeCode);
    if (code === 3) return 'file_update';
    if (code === 4) return 'revision_ext';
    return 'revision';
  }
  const code = Number(aitisiTypeCode);
  if (code === 1) return 'new_building';
  if (code === 5 || code === 6) return 'minor_cat1';
  if (code === 7 || code === 8) return 'minor_cat2';
  if (code === 9) return 'vod';
  if (code === 10) return 'preapproval';
  return 'new_building';
}
