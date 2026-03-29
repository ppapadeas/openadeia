/**
 * email-templates.js
 * HTML email template renderer for OpenAdeia.
 * Reads HTML templates from src/templates/ and replaces {{variable}} placeholders.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'templates');

/**
 * Read an HTML template file and replace all {{key}} placeholders with values.
 * @param {string} filename - Template filename (e.g. 'welcome.html')
 * @param {Record<string, string>} vars - Key/value pairs to substitute
 * @returns {Promise<string>} Rendered HTML string
 */
async function renderTemplate(filename, vars = {}) {
  const filePath = join(TEMPLATES_DIR, filename);
  let html = await readFile(filePath, 'utf-8');
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll(`{{${key}}}`, value ?? '');
  }
  return html;
}

/**
 * Render the welcome email sent to a new user after signup.
 * @param {{ name: string, loginUrl: string }} vars
 * @returns {Promise<string>}
 */
export async function renderWelcome({ name, loginUrl }) {
  return renderTemplate('welcome.html', { name, loginUrl });
}

/**
 * Render the password-reset email.
 * @param {{ name: string, resetUrl: string }} vars
 * @returns {Promise<string>}
 */
export async function renderResetPassword({ name, resetUrl }) {
  return renderTemplate('reset-password.html', { name, resetUrl });
}

/**
 * Render the email-verification email.
 * @param {{ name: string, verifyUrl: string }} vars
 * @returns {Promise<string>}
 */
export async function renderVerifyEmail({ name, verifyUrl }) {
  return renderTemplate('verify-email.html', { name, verifyUrl });
}
