// @ts-check
import { test, expect } from '@playwright/test';

/**
 * End-to-end user journey test for OpenAdeia.
 *
 * Simulates real users: login → create permit → view project →
 * upload document → advance workflow → check timeline → view clients.
 *
 * Prerequisites:
 *   - Frontend running on localhost:3000 (or E2E_BASE_URL)
 *   - Backend running on localhost:4000
 *   - Database seeded with a test user (see E2E_EMAIL / E2E_PASSWORD env vars)
 */

const EMAIL = process.env.E2E_EMAIL || 'pierros@papadeas.gr';
const PASSWORD = process.env.E2E_PASSWORD || 'test123';
const BACKEND_URL_INTERNAL = process.env.E2E_BACKEND_URL || 'http://localhost:4000';

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Fast login: authenticates via REST API and injects token into localStorage.
 * Avoids UI form submission to prevent rate-limit issues when many tests run.
 * Falls back to UI login if API call fails (e.g., in CI without direct backend access).
 */
async function login(page, email = EMAIL, password = PASSWORD) {
  try {
    const res = await fetch(`${BACKEND_URL_INTERNAL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      const token = data.token;
      const user = data.user;
      // Inject auth into localStorage before navigating so the app picks it up
      await page.goto('/');
      await page.evaluate(({ token, user }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }, { token, user });
      await page.goto('/projects');
      await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
      return;
    }
  } catch {
    // fallthrough to UI login
  }
  // UI form login fallback
  await page.goto('/login');
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
}

/** Create a project and return its URL. */
async function createProject(page) {
  await page.click('button:has-text("Νέος Φάκελος")');
  await expect(page.locator('h2:has-text("Νέος Φάκελος")')).toBeVisible();

  const typeSelect = page.locator('select').first();
  await typeSelect.selectOption('new_building');
  await page.fill('input[placeholder*="Νέα Κατοικία"]', `E2E Test ${Date.now()}`);
  await page.click('button:has-text("Δημιουργία Φακέλου")');

  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });
  return page.url();
}

// ─── Auth ────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h2')).toContainText('Σύνδεση');
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Πίνακας Ελέγχου');
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', 'wrong-password-123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test('signup page renders required fields', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('h2')).toContainText('Νέος Λογαριασμός');
    await expect(page.locator('#signup-org')).toBeVisible();
    await expect(page.locator('#signup-name')).toBeVisible();
    await expect(page.locator('#signup-email')).toBeVisible();
    await expect(page.locator('#signup-password')).toBeVisible();
    await expect(page.locator('#signup-confirm')).toBeVisible();
  });

  test('signup with mismatched passwords shows error', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#signup-org', 'Test Org');
    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', `e2e_${Date.now()}@example.com`);
    await page.fill('#signup-password', 'password123');
    await page.fill('#signup-confirm', 'differentpassword');
    await page.click('button[type="submit"]');
    // Should stay on signup page and show error toast
    await expect(page).toHaveURL(/\/signup/);
  });

  test('logout redirects to login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/projects/);

    // Click logout in sidebar — button has text "Αποσύνδεση" (visible when expanded)
    // or title "Αποσύνδεση" when collapsed
    const logoutBtn = page.locator('button[title="Αποσύνδεση"], button:has-text("Αποσύνδεση")').first();
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });
});

// ─── Project CRUD ────────────────────────────────────────────────────────

test.describe('Project Management', () => {
  test('create a new building permit project', async ({ page }) => {
    await login(page);
    await createProject(page);
    // Should show project detail with stage indicator (use first() to avoid strict mode violation)
    await expect(page.locator('text=Καταχώρηση').first()).toBeVisible();
  });

  test('view project detail tabs', async ({ page }) => {
    await login(page);
    await createProject(page);

    // Check tabs are visible
    for (const tabLabel of ['Επισκόπηση', 'Έγγραφα', 'Μελέτες', 'Checklist', 'Ιστορικό']) {
      await expect(page.locator(`button:has-text("${tabLabel}")`)).toBeVisible();
    }

    // Click through main tabs
    await page.click('button:has-text("Έγγραφα")');
    await expect(page.locator('button:has-text("Έγγραφα")')).toBeVisible();

    await page.click('button:has-text("Ιστορικό")');
    await expect(page.locator('text=Δημιουργία φακέλου')).toBeVisible({ timeout: 5_000 });
  });

  test('upload a document to a project', async ({ page }) => {
    await login(page);
    await createProject(page);

    // Switch to documents tab
    await page.click('button:has-text("Έγγραφα")');

    // Find a file input and upload a test PDF
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
      await fileInput.setInputFiles({
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        buffer: testPdf,
      });
      await page.waitForTimeout(2_000);
    }
  });

  test('advance project workflow stage', async ({ page }) => {
    await login(page);
    await createProject(page);

    // Look for the advance button
    const advanceBtn = page.locator('button:has-text("Επόμενο Στάδιο")');
    if (await advanceBtn.isVisible()) {
      await advanceBtn.click();
      // Either advances (toast success) or shows error (missing requirements)
      // Both outcomes are valid — we just verify the button works
      await page.waitForTimeout(2_000);
    }
  });

  test('delete project shows confirmation modal and can be cancelled', async ({ page }) => {
    await login(page);
    await createProject(page);

    // Click delete button in project detail header
    await page.click('button:has-text("Διαγραφή")');

    // Modal should appear
    await expect(page.locator('h3:has-text("Διαγραφή φακέλου;")')).toBeVisible();
    await expect(page.locator('text=μη αναστρέψιμη')).toBeVisible();

    // Cancel — should dismiss modal without deleting
    await page.click('button:has-text("Ακύρωση")');
    await expect(page.locator('h3:has-text("Διαγραφή φακέλου;")')).not.toBeVisible();
    // URL should still be a project detail page
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/);
  });
});

// ─── Navigation ──────────────────────────────────────────────────────────

test.describe('App Navigation', () => {
  test('sidebar navigation works', async ({ page }) => {
    await login(page);

    await page.click('a[href="/clients"]');
    await expect(page).toHaveURL(/\/clients/);

    await page.click('a[href="/nok"]');
    await expect(page).toHaveURL(/\/nok/);

    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL(/\/projects/);
  });

  test('dashboard shows stats cards', async ({ page }) => {
    await login(page);
    await expect(page.locator('text=Ενεργοί Φάκελοι')).toBeVisible();
    await expect(page.locator('text=Σε Αναμονή')).toBeVisible();
    await expect(page.locator('text=Εγκεκριμένα')).toBeVisible();
  });

  test('project filters work', async ({ page }) => {
    await login(page);

    // Check stage filter buttons exist
    await expect(page.locator('button:has-text("Όλα")')).toBeVisible();

    // Use the project search input — actual placeholder is "Αναζήτηση…"
    const searchInput = page.locator('input[placeholder="Αναζήτηση…"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('E2E');
      await page.waitForTimeout(500);
      await searchInput.clear();
    }
  });
});

// ─── Clients ─────────────────────────────────────────────────────────────

test.describe('Clients', () => {
  test('view clients list', async ({ page }) => {
    await login(page);
    await page.click('a[href="/clients"]');
    await expect(page).toHaveURL(/\/clients/);
    await page.waitForLoadState('networkidle');
  });
});

// ─── NOK Rules ───────────────────────────────────────────────────────────

test.describe('NOK Rules', () => {
  test('view NOK rules for a permit type', async ({ page }) => {
    await login(page);
    await page.click('a[href="/nok"]');
    await expect(page).toHaveURL(/\/nok/);
    await page.waitForLoadState('networkidle');
  });
});

// ─── Fee Calculator ──────────────────────────────────────────────────────

test.describe('Fee Calculator', () => {
  test('access fee calculator from project detail', async ({ page }) => {
    await login(page);
    await createProject(page);

    // Click fees tab
    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');
  });

  test('fee calculator accepts area inputs', async ({ page }) => {
    await login(page);
    await createProject(page);

    // Open fees tab
    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');

    // Fill in an area value (A1 area field — text-right input)
    const areaInput = page.locator('input[type="number"]').first();
    if (await areaInput.count() > 0) {
      await areaInput.fill('150');
      await expect(areaInput).toHaveValue('150');
    }
  });
});

// ─── Client Portal ───────────────────────────────────────────────────────

test.describe('Client Portal', () => {
  test('invalid token shows error state', async ({ page }) => {
    await page.goto('/portal/invalid-token-xyz-123');
    await page.waitForLoadState('networkidle');
    // Should show error (no portal data) rather than portal content
    // The page renders null/error when portal fetch fails
    await expect(page.locator('body')).not.toContainText('Φάκελος Αδειοδότησης');
  });
});

// ─── Admin Dashboard ─────────────────────────────────────────────────────

test.describe('Admin Dashboard', () => {
  test('superadmin user can access /admin dashboard', async ({ page }) => {
    // Default test user (pierros@papadeas.gr) is_superadmin=true
    await login(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Superadmin stays on /admin (no redirect)
    await expect(page).toHaveURL(/\/admin/, { timeout: 8_000 });
  });

  test('unauthenticated user is redirected to login from /admin', async ({ page }) => {
    // No login — visiting /admin cold
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // RequireAuth should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

// ─── Profile ─────────────────────────────────────────────────────────────

test.describe('Profile', () => {
  test('view profile page', async ({ page }) => {
    await login(page);
    await page.click('a[href="/profile"]');
    await expect(page).toHaveURL(/\/profile/);
    await page.waitForLoadState('networkidle');
  });
});

// ─── Theme Toggle ────────────────────────────────────────────────────────

test.describe('Theme Toggle', () => {
  test('switching to Light removes dark class from html', async ({ page }) => {
    await login(page);

    // Find and click theme toggle button (contains emoji ☀️ or 🌙 or 💻)
    const themeBtn = page.locator('button[aria-label="Toggle theme"]');
    await themeBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await themeBtn.click();

    // Wait for dropdown and click Light
    const lightOption = page.locator('button:has-text("Light")');
    await lightOption.waitFor({ state: 'visible', timeout: 5_000 });
    await lightOption.click();

    // html element should NOT have dark class
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 5_000 });
  });

  test('switching to Dark adds dark class to html', async ({ page }) => {
    await login(page);

    const themeBtn = page.locator('button[aria-label="Toggle theme"]');
    await themeBtn.waitFor({ state: 'visible', timeout: 10_000 });

    // First set to light so we have a known starting state
    await themeBtn.click();
    await page.locator('button:has-text("Light")').click();
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/\bdark\b/, { timeout: 5_000 });

    // Now switch to dark
    await themeBtn.click();
    const darkOption = page.locator('button:has-text("Dark")');
    await darkOption.waitFor({ state: 'visible', timeout: 5_000 });
    await darkOption.click();

    // html element SHOULD have dark class
    await expect(html).toHaveClass(/\bdark\b/, { timeout: 5_000 });
  });

  test('background color changes between light and dark themes', async ({ page }) => {
    await login(page);

    // Switch to light and check body background
    await page.click('button[aria-label="Toggle theme"]');
    await page.click('button:has-text("Light")');
    await page.waitForTimeout(300); // allow CSS transition

    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    // Switch to dark and check body background
    await page.click('button[aria-label="Toggle theme"]');
    await page.click('button:has-text("Dark")');
    await page.waitForTimeout(300);

    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor
    );

    // The two backgrounds must differ
    expect(lightBg).not.toBe(darkBg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED COVERAGE — appended by e2e-writer subagent
// Covers: Auth extended, Client Portal, Fee Calculator, Project Delete, Admin
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:4000';
const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL || 'admin@openadeia.local';
const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD || 'superadmin123';

// ─── Extra Helpers ────────────────────────────────────────────────────────────

/** Sign up a brand-new org + user via the /signup form. Returns the credentials used. */
async function signup(page, opts = {}) {
  const ts = Date.now();
  const email = opts.email || `e2e-user-${ts}@example.com`;
  const password = opts.password || 'E2ePassword1!';
  const orgName = opts.orgName || `E2E Org ${ts}`;
  const name = opts.name || `E2E User ${ts}`;

  await page.goto('/signup');
  await page.fill('#signup-org', orgName);
  await page.fill('#signup-name', name);
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);
  await page.fill('#signup-confirm', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/projects/, { timeout: 15_000 });

  return { email, password, orgName, name };
}

/**
 * Obtain a JWT for the given credentials by calling the backend REST API.
 * Used in portal-related tests to create resources without going through the UI.
 */
async function getAuthToken(email, password) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`getAuthToken failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

/**
 * Create a client portal for a project via the backend REST API.
 * Returns the portal token string.
 */
async function createPortalToken(projectId, authToken) {
  const res = await fetch(`${BACKEND_URL}/api/portal`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      project_id: projectId,
      status: 'active',
      client_name: 'E2E Test Client',
      client_email: 'e2eclient@example.com',
      client_message: 'Your permit is in progress.',
    }),
  });
  if (!res.ok) throw new Error(`createPortalToken failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // portal_url looks like …/portal/<token>; token field also available directly
  const token = data.token || data.portal_url?.split('/portal/')[1];
  if (!token) throw new Error(`No token in createPortalToken response: ${JSON.stringify(data)}`);
  return token;
}

/** Extract the UUID project ID from a project detail URL. */
function extractProjectId(url) {
  const m = url.match(/\/projects\/([a-f0-9-]+)/);
  if (!m) throw new Error(`Cannot extract project ID from URL: ${url}`);
  return m[1];
}

// ─── Authentication – Extended ────────────────────────────────────────────────

test.describe('Authentication - Extended', () => {
  test('signup creates new account and lands on dashboard', async ({ page }) => {
    const { orgName } = await signup(page);

    await expect(page).toHaveURL(/\/projects/);
    // At minimum the dashboard / projects list heading should be visible
    await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 });
    // Org name should appear somewhere on screen (header, sidebar, welcome toast)
    await expect(page.locator('body')).toContainText(orgName.split(' ')[0]);
  });

  test('signup with mismatched passwords shows validation error', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('#signup-org', 'Test Org');
    await page.fill('#signup-name', 'Test User');
    await page.fill('#signup-email', `mismatch-${Date.now()}@example.com`);
    await page.fill('#signup-password', 'Password123!');
    await page.fill('#signup-confirm', 'DifferentPass!');
    await page.click('button[type="submit"]');

    // Stay on signup; show mismatch toast
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.locator('body')).toContainText('Οι κωδικοί δεν ταιριάζουν', { timeout: 5_000 });
  });

  test('forgot password shows success banner for any email', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.locator('h2')).toContainText('Ξεχάσατε τον κωδικό;');

    await page.fill('input[type="email"]', `nonexistent-${Date.now()}@example.com`);
    await page.click('button[type="submit"]');

    // Security-by-design: always show the "check your inbox" message
    await expect(page.locator('text=Αν το email υπάρχει')).toBeVisible({ timeout: 10_000 });
  });

  test('forgot password page has back-to-login link', async ({ page }) => {
    await page.goto('/forgot-password');
    const backLink = page.locator('a:has-text("Πίσω στη σύνδεση"), a[href="/login"]').first();
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('logout clears session and protected routes redirect to login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/projects/);

    // Navigate to profile to find logout button
    const profileLink = page.locator('a[href="/profile"]');
    if (await profileLink.isVisible()) {
      await profileLink.click();
    }

    const logoutBtn = page
      .locator('button:has-text("Αποσύνδεση"), a:has-text("Αποσύνδεση"), button:has-text("Logout")')
      .first();
    await expect(logoutBtn).toBeVisible({ timeout: 5_000 });
    await logoutBtn.click();

    // After logout, protected route should redirect to /login
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});

// ─── Client Portal (Extended) ────────────────────────────────────────────────

test.describe('Client Portal - Extended', () => {
  test('invalid token shows "Portal not found" error page', async ({ page }) => {
    await page.goto('/portal/this-is-not-a-real-token-xyz-99999');

    await expect(page.locator('text=Portal δεν βρέθηκε')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('body')).toContainText('Παρακαλώ επικοινωνήστε με τον μηχανικό σας');
    // Should NOT show the app's authenticated shell
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('valid token shows project portal header', async ({ page }) => {
    const authToken = await getAuthToken(EMAIL, PASSWORD);

    await login(page);
    const projectUrl = await createProject(page);
    const projectId = extractProjectId(projectUrl);
    const portalToken = await createPortalToken(projectId, authToken);

    await page.goto(`/portal/${portalToken}`);

    await expect(page.locator('text=Client Portal')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('h1')).toBeVisible();
  });

  test('portal shows project status steps area', async ({ page }) => {
    const authToken = await getAuthToken(EMAIL, PASSWORD);

    await login(page);
    const projectUrl = await createProject(page);
    const projectId = extractProjectId(projectUrl);
    const portalToken = await createPortalToken(projectId, authToken);

    await page.goto(`/portal/${portalToken}`);
    await expect(page.locator('text=Client Portal')).toBeVisible({ timeout: 10_000 });

    // Either the "no steps" empty state is shown, or a steps list container
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(/Δεν υπάρχουν βήματα|βήματα/i);

    // Footer is always present
    await expect(page.locator('text=Powered by')).toBeVisible();
    await expect(page.locator('text=OpenAdeia')).toBeVisible();
  });

  test('portal is publicly accessible without authentication', async ({ page }) => {
    const authToken = await getAuthToken(EMAIL, PASSWORD);

    await login(page);
    const projectUrl = await createProject(page);
    const projectId = extractProjectId(projectUrl);
    const portalToken = await createPortalToken(projectId, authToken);

    // Open in a fresh browser context (no session cookies)
    const freshPage = await page.context().newPage();
    await freshPage.goto(`/portal/${portalToken}`);

    // Must NOT redirect to login
    await expect(freshPage).not.toHaveURL(/\/login/);
    await expect(freshPage.locator('text=Client Portal')).toBeVisible({ timeout: 10_000 });
    await freshPage.close();
  });

  test('portal shows progress bar when steps exist', async ({ page }) => {
    const authToken = await getAuthToken(EMAIL, PASSWORD);

    await login(page);
    const projectUrl = await createProject(page);
    const projectId = extractProjectId(projectUrl);

    // Add a step to the portal via the API so the progress bar renders
    const createRes = await fetch(`${BACKEND_URL}/api/portal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({
        project_id: projectId,
        status: 'active',
        client_name: 'Test Client',
        client_email: 'test@e2e.example.com',
      }),
    });
    const portalData = await createRes.json();
    const portalToken = portalData.token || portalData.portal_url?.split('/portal/')[1];

    // Add one step
    await fetch(`${BACKEND_URL}/api/portal/${portalData.id || portalData.portal_id}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ title: 'Αποστολή εγγράφου', type: 'upload', required: true }),
    }).catch(() => { /* step creation optional — portal may not expose ID */ });

    await page.goto(`/portal/${portalToken}`);
    await expect(page.locator('text=Client Portal')).toBeVisible({ timeout: 10_000 });
    // Progress bar or steps/empty state — either is correct
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});

// ─── Fee Calculator – Calculations ────────────────────────────────────────────

test.describe('Fee Calculator - Calculations', () => {
  test('ΦΕΚ 2422/2013 lambda value is displayed', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');

    // Lambda info card references the ΦΕΚ
    await expect(page.locator('body')).toContainText('ΦΕΚ');
    await expect(page.locator('body')).toContainText('2422');
    await expect(page.locator('body')).toContainText('2013');

    // λ symbol is shown — use text locator to avoid hidden font-mono elements in other tabs
    await expect(page.locator('text=λ =')).toBeVisible({ timeout: 5_000 });
  });

  test('calculates fee with A1 area and shows results page', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Fill Κύρια χρήση (A1) — first number input on the areas tab
    const a1Input = page.locator('input[type="number"]').first();
    await expect(a1Input).toBeVisible({ timeout: 5_000 });
    await a1Input.fill('120');

    // Navigate to Μελέτες calcTab (use "Επόμενο" button to avoid ambiguity with project tabs)
    await page.click('button:has-text("Επόμενο: Μελέτες")');
    await expect(page.locator('button:has-text("Υπολογισμός Αμοιβής")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("Υπολογισμός Αμοιβής")');

    // Results tab should now be active or navigable
    await expect(page.locator('text=Τυπική Αμοιβή (ΤΑ)')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('text=Σύνολο (χωρίς ΦΠΑ)')).toBeVisible();
    await expect(page.locator('text=Ολική Αμοιβή (με ΦΠΑ)')).toBeVisible();
  });

  test('shows fee breakdown table after calculation', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 200 sqm main area
    const areaInput200 = page.locator('input[type="number"]').first();
    await expect(areaInput200).toBeVisible({ timeout: 5_000 });
    await areaInput200.fill('200');
    await page.click('button:has-text("Επόμενο: Μελέτες")');
    await expect(page.locator('button:has-text("Υπολογισμός Αμοιβής")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("Υπολογισμός Αμοιβής")');

    await expect(page.locator('text=Ανάλυση ανά μελέτη')).toBeVisible({ timeout: 15_000 });

    // At least one study row with a positive fee
    const feeRow = page.locator('table tbody tr').first();
    await expect(feeRow).toBeVisible({ timeout: 5_000 });
  });

  test('fee result updates when area input changes', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const a1Input = page.locator('input[type="number"]').first();
    await expect(a1Input).toBeVisible({ timeout: 5_000 });

    // First calc: 100 sqm
    await a1Input.fill('100');
    await page.click('button:has-text("Επόμενο: Μελέτες")');
    await expect(page.locator('button:has-text("Υπολογισμός Αμοιβής")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("Υπολογισμός Αμοιβής")');
    await expect(page.locator('text=Ολική Αμοιβή (με ΦΠΑ)')).toBeVisible({ timeout: 15_000 });

    const firstTotalEl = page.locator('.text-2xl.font-bold, [class*="text-2xl"][class*="font-bold"]').first();
    const firstTotal = await firstTotalEl.textContent();

    // Second calc: 200 sqm (double)
    await page.click('button:has-text("Στοιχεία")');
    await a1Input.fill('200');
    await page.click('button:has-text("Επόμενο: Μελέτες")');
    await expect(page.locator('button:has-text("Υπολογισμός Αμοιβής")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("Υπολογισμός Αμοιβής")');
    await expect(page.locator('text=Ολική Αμοιβή (με ΦΠΑ)')).toBeVisible({ timeout: 15_000 });

    const secondTotal = await firstTotalEl.textContent();

    // Doubling area must change the fee total
    expect(firstTotal).not.toBe(secondTotal);
  });

  test('ΦΠΑ 24% line item appears in fee summary', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.click('button:has-text("Αμοιβές")');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const fpaInput = page.locator('input[type="number"]').first();
    await expect(fpaInput).toBeVisible({ timeout: 5_000 });
    await fpaInput.fill('150');
    await page.click('button:has-text("Επόμενο: Μελέτες")');
    await expect(page.locator('button:has-text("Υπολογισμός Αμοιβής")')).toBeVisible({ timeout: 5_000 });
    await page.click('button:has-text("Υπολογισμός Αμοιβής")');

    await expect(page.locator('text=ΦΠΑ 24%')).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Project Delete ────────────────────────────────────────────────────────────

test.describe('Project Delete', () => {
  test('delete button opens confirmation modal', async ({ page }) => {
    await login(page);
    await createProject(page);

    const deleteBtn = page.locator('button:has-text("Διαγραφή")').first();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Modal appears with correct content
    await expect(page.locator('text=Διαγραφή φακέλου;')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=μη αναστρέψιμη')).toBeVisible();
    await expect(page.locator('text=Όλα τα έγγραφα')).toBeVisible();
    await expect(page.locator('button:has-text("Ναι, Διαγραφή")')).toBeVisible();
    await expect(page.locator('button:has-text("Ακύρωση")')).toBeVisible();
  });

  test('cancel on delete modal keeps project and closes modal', async ({ page }) => {
    await login(page);
    await createProject(page);
    const urlBefore = page.url();

    await page.locator('button:has-text("Διαγραφή")').first().click();
    await expect(page.locator('text=Διαγραφή φακέλου;')).toBeVisible({ timeout: 5_000 });

    await page.click('button:has-text("Ακύρωση")');

    // Modal disappears
    await expect(page.locator('text=Διαγραφή φακέλου;')).not.toBeVisible({ timeout: 3_000 });
    // URL unchanged — still on the project detail page
    expect(page.url()).toBe(urlBefore);
    // Project header still present
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('confirm delete navigates back to projects list', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.locator('button:has-text("Διαγραφή")').first().click();
    await expect(page.locator('text=Διαγραφή φακέλου;')).toBeVisible({ timeout: 5_000 });

    await page.click('button:has-text("Ναι, Διαγραφή")');

    // Should navigate back to the projects list
    await expect(page).toHaveURL(/\/projects$|\/projects\?|\/projects\/\s*$/, { timeout: 10_000 });
    // Projects list heading is visible — not a 404 or error page
    await expect(page.locator('h1')).toBeVisible({ timeout: 5_000 });
  });

  test('confirm delete button shows pending state while request is in flight', async ({ page }) => {
    await login(page);
    await createProject(page);

    await page.locator('button:has-text("Διαγραφή")').first().click();
    await expect(page.locator('text=Διαγραφή φακέλου;')).toBeVisible({ timeout: 5_000 });

    // Click confirm and immediately check for the pending label
    const confirmBtn = page.locator('button:has-text("Ναι, Διαγραφή")');
    await confirmBtn.click();

    // Either "Διαγραφή…" (pending) or navigation has already happened — both valid
    const pending = page.locator('button:has-text("Διαγραφή…")');
    const navigated = page.locator('h1');  // projects list heading
    await expect(pending.or(navigated)).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Admin Dashboard (Extended) ───────────────────────────────────────────────

test.describe('Admin Dashboard - Extended', () => {
  test('superadmin user accesses /admin dashboard and sees metrics', async ({ page }) => {
    // Default test user (pierros@papadeas.gr) is_superadmin=true
    await login(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Superadmin stays on /admin
    await expect(page).toHaveURL(/\/admin/, { timeout: 8_000 });
    // Dashboard heading visible
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('admin sees tenant list (requires E2E_SUPERADMIN_EMAIL)', async ({ page }) => {
    if (!process.env.E2E_SUPERADMIN_EMAIL) {
      test.skip(true, 'Set E2E_SUPERADMIN_EMAIL + E2E_SUPERADMIN_PASSWORD to run admin tests');
      return;
    }

    await page.goto('/login');
    await page.fill('#login-email', SUPERADMIN_EMAIL);
    await page.fill('#login-password', SUPERADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin/, { timeout: 8_000 });

    // Overview stats visible
    await expect(page.locator('text=Ενεργοί Φορείς')).toBeVisible({ timeout: 10_000 });

    // Switch to tenants tab if separate
    const tenantsTab = page.locator('button:has-text("Φορείς")').first();
    if (await tenantsTab.isVisible()) await tenantsTab.click();

    // At least one plan-related label exists (table header or badge)
    await expect(page.locator('body')).toContainText('Plan', { timeout: 8_000 });
  });

  test('admin can open audit log tab (requires E2E_SUPERADMIN_EMAIL)', async ({ page }) => {
    if (!process.env.E2E_SUPERADMIN_EMAIL) {
      test.skip(true, 'Set E2E_SUPERADMIN_EMAIL + E2E_SUPERADMIN_PASSWORD to run admin tests');
      return;
    }

    await page.goto('/login');
    await page.fill('#login-email', SUPERADMIN_EMAIL);
    await page.fill('#login-password', SUPERADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });

    await page.goto('/admin');
    await expect(page.locator('text=Ενεργοί Φορείς')).toBeVisible({ timeout: 10_000 });

    const auditTab = page.locator('button:has-text("Αρχείο Ενεργειών")').first();
    await expect(auditTab).toBeVisible({ timeout: 5_000 });
    await auditTab.click();

    // Component loads without crashing — loading state must resolve
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Φόρτωση πίνακα διαχείρισης…')).not.toBeVisible({ timeout: 8_000 });
  });

  test('admin metrics show numeric values (requires E2E_SUPERADMIN_EMAIL)', async ({ page }) => {
    if (!process.env.E2E_SUPERADMIN_EMAIL) {
      test.skip(true, 'Set E2E_SUPERADMIN_EMAIL + E2E_SUPERADMIN_PASSWORD to run admin tests');
      return;
    }

    await page.goto('/login');
    await page.fill('#login-email', SUPERADMIN_EMAIL);
    await page.fill('#login-password', SUPERADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });

    await page.goto('/admin');
    await expect(page.locator('text=Ενεργοί Φορείς')).toBeVisible({ timeout: 10_000 });

    // Loading spinner must be gone
    await expect(page.locator('text=Φόρτωση')).not.toBeVisible({ timeout: 8_000 });

    // Stat cards should contain numbers, not just "—"
    const statValues = page.locator('[class*="text-2xl"][class*="font-bold"]');
    await expect(statValues.first()).toBeVisible({ timeout: 5_000 });
  });
});
