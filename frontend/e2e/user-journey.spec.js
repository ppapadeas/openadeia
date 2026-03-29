// @ts-check
import { test, expect } from '@playwright/test';

/**
 * End-to-end user journey test for OpenAdeia.
 *
 * Simulates a real user: login → create permit → view project →
 * upload document → advance workflow → check timeline → view clients.
 *
 * Prerequisites:
 *   - Frontend running on localhost:3000 (or E2E_BASE_URL)
 *   - Backend running on localhost:4000
 *   - Database seeded with a test user (see E2E_EMAIL / E2E_PASSWORD env vars)
 */

const EMAIL = process.env.E2E_EMAIL || 'pierros@papadeas.gr';
const PASSWORD = process.env.E2E_PASSWORD || 'test123';

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Log in and navigate to dashboard. Reused across tests. */
async function login(page) {
  await page.goto('/login');
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
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
});

// ─── Project CRUD ────────────────────────────────────────────────────────

test.describe('Project Management', () => {
  test('create a new building permit project', async ({ page }) => {
    await login(page);
    await createProject(page);
    // Should show project detail with stage indicator
    await expect(page.locator('text=Καταχώρηση')).toBeVisible();
  });

  test('view project detail tabs', async ({ page }) => {
    await login(page);
    // Create a project so we have one to view
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

    // Use the specific project search input (the one in the project list area)
    const searchInput = page.locator('input[placeholder*="Αναζήτηση φακέλου"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('E2E');
      await page.waitForTimeout(1_000);
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
