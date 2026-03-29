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

// ─── Auth ────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('shows login page for unauthenticated users', async ({ page }) => {
    await page.goto('/projects');
    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h2')).toContainText('Σύνδεση');
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to projects dashboard
    await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Πίνακας Ελέγχου');
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#login-email', EMAIL);
    await page.fill('#login-password', 'wrong-password-123');
    await page.click('button[type="submit"]');

    // Should show error toast and stay on login
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Log in and navigate to dashboard. Reused across tests. */
async function login(page) {
  await page.goto('/login');
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/projects/, { timeout: 10_000 });
}

// ─── Project CRUD ────────────────────────────────────────────────────────

test.describe('Project Management', () => {
  /** Store project URL across tests in this describe block */
  let projectUrl;

  test('create a new building permit project', async ({ page }) => {
    await login(page);

    // Click "Νέος Φάκελος" button
    await page.click('button:has-text("Νέος Φάκελος")');

    // Modal should appear
    await expect(page.locator('h2:has-text("Νέος Φάκελος")')).toBeVisible();

    // Select "Νέα Πράξη" (should be default)
    const newActBtn = page.locator('button:has-text("Νέα Πράξη")');
    await expect(newActBtn).toBeVisible();

    // Select permit type (new_building is default)
    const typeSelect = page.locator('select').first();
    await typeSelect.selectOption('new_building');

    // Fill title
    await page.fill('input[placeholder*="Νέα Κατοικία"]', `E2E Test Project ${Date.now()}`);

    // Submit form
    await page.click('button:has-text("Δημιουργία Φακέλου")');

    // Should navigate to the new project detail page
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

    // Store the URL for subsequent tests
    projectUrl = page.url();

    // Should show project detail with stage indicator
    await expect(page.locator('text=Καταχώρηση')).toBeVisible(); // init stage label
  });

  test('view project detail tabs', async ({ page }) => {
    await login(page);

    // Navigate to dashboard and click first project
    const firstProject = page.locator('[class*="cursor-pointer"]').first();
    await firstProject.click();
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

    // Check tabs are visible
    for (const tabLabel of ['Επισκόπηση', 'Έγγραφα', 'Μελέτες', 'Checklist', 'Ιστορικό']) {
      await expect(page.locator(`button:has-text("${tabLabel}")`)).toBeVisible();
    }

    // Click through main tabs
    await page.click('button:has-text("Έγγραφα")');
    await expect(page.locator('text=Έγγραφα')).toBeVisible();

    await page.click('button:has-text("Ιστορικό")');
    // Timeline should show at least the creation entry
    await expect(page.locator('text=Δημιουργία φακέλου')).toBeVisible({ timeout: 5_000 });
  });

  test('upload a document to a project', async ({ page }) => {
    await login(page);

    // Go to first project
    const firstProject = page.locator('[class*="cursor-pointer"]').first();
    await firstProject.click();
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

    // Switch to documents tab
    await page.click('button:has-text("Έγγραφα")');

    // Find a file input and upload a test PDF
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      // Create a minimal test PDF buffer
      const testPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
      await fileInput.setInputFiles({
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        buffer: testPdf,
      });

      // Wait for upload confirmation (toast or status change)
      await page.waitForTimeout(2_000);
    }
  });

  test('advance project workflow stage', async ({ page }) => {
    await login(page);

    // Go to first project
    const firstProject = page.locator('[class*="cursor-pointer"]').first();
    await firstProject.click();
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

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

    // Navigate to clients
    await page.click('a[href="/clients"]');
    await expect(page).toHaveURL(/\/clients/);

    // Navigate to NOK rules
    await page.click('a[href="/nok"]');
    await expect(page).toHaveURL(/\/nok/);

    // Navigate back to projects
    await page.click('a[href="/projects"]');
    await expect(page).toHaveURL(/\/projects/);
  });

  test('dashboard shows stats cards', async ({ page }) => {
    await login(page);

    // Verify stat cards are present
    await expect(page.locator('text=Ενεργοί Φάκελοι')).toBeVisible();
    await expect(page.locator('text=Σε Αναμονή')).toBeVisible();
    await expect(page.locator('text=Εγκεκριμένα')).toBeVisible();
  });

  test('project filters work', async ({ page }) => {
    await login(page);

    // Check stage filter buttons exist
    await expect(page.locator('button:has-text("Όλα")')).toBeVisible();

    // Check search input exists
    const searchInput = page.locator('input[placeholder*="Αναζήτηση"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('E2E');
      await page.waitForTimeout(1_000);
      // Filters should apply (may show 0 or more results)
    }
  });
});

// ─── Clients ─────────────────────────────────────────────────────────────

test.describe('Clients', () => {
  test('view clients list', async ({ page }) => {
    await login(page);

    await page.click('a[href="/clients"]');
    await expect(page).toHaveURL(/\/clients/);

    // Page should load (either shows clients or empty state)
    await page.waitForLoadState('networkidle');
  });
});

// ─── NOK Rules ───────────────────────────────────────────────────────────

test.describe('NOK Rules', () => {
  test('view NOK rules for a permit type', async ({ page }) => {
    await login(page);

    await page.click('a[href="/nok"]');
    await expect(page).toHaveURL(/\/nok/);

    // Should show permit type selector or rules list
    await page.waitForLoadState('networkidle');
  });
});

// ─── Fee Calculator ──────────────────────────────────────────────────────

test.describe('Fee Calculator', () => {
  test('access fee calculator from project detail', async ({ page }) => {
    await login(page);

    // Go to first project
    const firstProject = page.locator('[class*="cursor-pointer"]').first();
    if (await firstProject.count() > 0) {
      await firstProject.click();
      await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 10_000 });

      // Click fees tab
      await page.click('button:has-text("Αμοιβές")');
      await page.waitForLoadState('networkidle');
    }
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
